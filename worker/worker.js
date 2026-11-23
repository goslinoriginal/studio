/* =====================================================================
   Studio reminders — a tiny Cloudflare Worker (free plan is plenty).

   Every minute it reads studio-data.json from your private GitHub repo,
   finds reminders that are due right now, and sends a notification to
   the phones that switched notifications on in the app.

   Setup is in the README ("Notifications"). It needs two secrets:
     GITHUB_TOKEN       the same access token the app uses
     VAPID_PRIVATE_KEY  the "notification key" the app showed you
   and optionally one variable:
     DATA_REPO          defaults to goslinoriginal/studio-data
   ===================================================================== */

const DEFAULT_REPO = "goslinoriginal/studio-data";
const DATA_FILE = "studio-data.json";
const NO_TIME_HOUR = "08:00"; // reminders without a time go off at 8am on the day

export default {
  // Runs every minute (Cron Trigger "* * * * *").
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkReminders(env, event.scheduledTime));
  },

  // Visit the Worker's link to check it's set up. The app also calls /test.
  async fetch(req, env) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    const url = new URL(req.url);
    const reply = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), { status, headers: { ...cors, "Content-Type": "application/json" } });
    try {
      if (url.pathname === "/test" && req.method === "POST") {
        // Only the app (which knows the access token) may send a test.
        if (!env.GITHUB_TOKEN || req.headers.get("Authorization") !== "Bearer " + env.GITHUB_TOKEN)
          return reply({ ok: false, error: "The Worker's GITHUB_TOKEN isn't the same token the app uses." }, 401);
        const { deviceId } = await req.json();
        const data = await loadData(env);
        const dev = (data.devices || []).find(d => d.id === deviceId);
        if (!dev) return reply({ ok: false, error: "This phone isn't in the shared data yet. Wait for it to sync, then try again." }, 404);
        const r = await sendPush(dev.sub, { title: "Test notification", body: "Notifications are working 🎉", tag: "studio-test" }, data.settings.pushKey, env);
        return reply({ ok: r.ok, status: r.status, error: r.ok ? undefined : await r.text() }, r.ok ? 200 : 502);
      }
      // Health check: says what's set up, without showing any of your data.
      const out = { ok: true, githubToken: !!env.GITHUB_TOKEN, notificationKey: !!env.VAPID_PRIVATE_KEY };
      try {
        const data = await loadData(env);
        out.canReadData = true;
        out.keyInApp = !!data.settings.pushKey;
        out.devices = (data.devices || []).map(d => d.who + " (" + d.label + ")");
      } catch (e) { out.ok = false; out.canReadData = false; out.problem = e.message; }
      if (!out.githubToken || !out.notificationKey || !out.keyInApp) out.ok = false;
      return reply(out);
    } catch (e) {
      return reply({ ok: false, error: e.message }, 500);
    }
  },
};

/* ---------- The every-minute check ---------- */
export async function checkReminders(env, when = Date.now()) {
  const data = await loadData(env);
  const s = data.settings || {};
  if (!s.pushKey || !env.VAPID_PRIVATE_KEY) return [];
  const tz = s.tz || "Africa/Johannesburg";
  const nowKey = minuteKey(when, tz);
  const devices = data.devices || [];
  const sent = [];
  for (const t of data.tasks || []) {
    if (t.done) continue;
    if (dueKey(t, tz) !== nowKey) continue;
    const people = !t.who || t.who === "Both" ? null : t.who;
    const targets = devices.filter(d => !people || d.who === people);
    const link = t.linkId && [...(data.clients || []), ...(data.leads || [])].find(x => x.id === t.linkId);
    const body = [link && link.business, t.notes].filter(Boolean).join(" · ").slice(0, 180) || (t.snoozeUntil ? "Snoozed reminder" : "Reminder");
    for (const d of targets) {
      const r = await sendPush(d.sub, { title: t.title, body, tag: "task-" + t.id, taskId: t.id }, s.pushKey, env).catch(e => ({ ok: false, status: 0, e }));
      sent.push({ task: t.id, device: d.id, status: r.status });
    }
  }
  return sent;
}

// The minute a reminder should go off, as "YYYY-MM-DDTHH:MM" in the business's time zone.
export function dueKey(t, tz) {
  if (t.snoozeUntil) return minuteKey(t.snoozeUntil, tz);
  if (!t.date) return null;
  return `${t.date}T${t.time || NO_TIME_HOUR}`;
}
export function minuteKey(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/* ---------- Reading the shared data from GitHub ---------- */
async function loadData(env) {
  if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN secret is missing");
  const repo = env.DATA_REPO || DEFAULT_REPO;
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${DATA_FILE}`, {
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github.raw+json", "User-Agent": "studio-reminders", "X-GitHub-Api-Version": "2022-11-28" },
  });
  if (!res.ok) throw new Error(`GitHub said ${res.status} when reading ${repo}`);
  const data = await res.json();
  data.settings ||= {};
  return data;
}

/* ---------- Web Push (RFC 8291 encryption + RFC 8292 VAPID) ---------- */
const enc = new TextEncoder();
const b64u = buf => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)), c => c.charCodeAt(0));
const concat = (...arrs) => { const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0)); let i = 0; for (const a of arrs) { out.set(a, i); i += a.length; } return out; };
async function hmac(key, data) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

export async function vapidHeader(endpoint, publicKeyB64, privateKeyB64, subject) {
  const pub = unb64u(publicKeyB64);
  const key = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: privateKeyB64, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true },
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + body));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKeyB64}`;
}

export async function encryptPayload(sub, payload) {
  const uaPublic = unb64u(sub.keys.p256dh), authSecret = unb64u(sub.keys.auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const prkKey = await hmac(authSecret, shared);
  const ikm = await hmac(prkKey, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic, new Uint8Array([1])));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(enc.encode(payload), new Uint8Array([2]))));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPublic.length]), asPublic); // record size 4096
  return concat(header, cipher);
}

export async function sendPush(sub, message, publicKey, env) {
  const body = await encryptPayload(sub, JSON.stringify(message));
  return fetch(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidHeader(sub.endpoint, publicKey, env.VAPID_PRIVATE_KEY, "https://goslinoriginal.github.io/studio/"),
      "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
      TTL: "3600", Urgency: "high",
    },
    body,
  });
}
