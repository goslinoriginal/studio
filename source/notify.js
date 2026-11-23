/* =====================================================================
   Notifications: reminders that pop up on your phone even when the app
   is closed. A small Cloudflare Worker (worker/worker.js) checks the
   shared data every minute and sends them. This part switches them on
   for this device and handles snoozing.
   ===================================================================== */
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const b64url = buf => { let s = ""; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64url = str => Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)), c => c.charCodeAt(0));
let NOTIFY_PRIV = ""; // the private key, shown once while setting up; never saved or synced

function deviceId() { if (!CFG.deviceId) { CFG.deviceId = uid(); saveCfg(); } return CFG.deviceId; }
const myDevice = () => S.devices.find(d => d.id === CFG.deviceId);
function deviceLabel() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) || isIOS() ? "iPad" : /Android/.test(ua) ? "Android phone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows computer" : "computer";
}
const pushReady = () => !!(S.settings.pushKey && S.settings.pushWorker);

// What the Notifications card should show for this device.
function pushState() {
  if (!pushReady()) return "not-setup";
  if (isIOS() && !isInstalled()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (CFG.pushOn && Notification.permission === "granted" && myDevice()) return "on";
  return "off";
}

async function subscribeThisDevice() {
  const reg = await navigator.serviceWorker.ready;
  const key = S.settings.pushKey;
  let sub = await reg.pushManager.getSubscription();
  // A new notification key was made: swap the old subscription for a new one.
  if (sub && (!myDevice() || myDevice().key !== key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64url(key) });
  return sub;
}
function saveDevice(sub) {
  const j = sub.toJSON(), cur = myDevice();
  const rec = { id: deviceId(), who: ME(), label: deviceLabel(), key: S.settings.pushKey, sub: { endpoint: j.endpoint, keys: j.keys } };
  // Only save when something really changed, so we don't make a GitHub commit every time the app opens.
  if (cur && cur.who === rec.who && cur.key === rec.key && cur.sub && cur.sub.endpoint === rec.sub.endpoint && cur.sub.keys.auth === rec.sub.keys.auth) return;
  upsert("devices", { ...(cur || {}), ...rec });
}

async function turnOnPush() {
  const st = pushState();
  if (st === "needs-install") { toast("Add Studio to your Home Screen first, then open it from there"); return; }
  if (st === "unsupported") { toast("This browser can't show notifications"); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { toast("Notifications are blocked. Allow them for Studio in your phone's settings."); refreshTop(settingsSheet); return; }
  try {
    const sub = await subscribeThisDevice();
    CFG.pushOn = true; saveCfg();
    saveDevice(sub);
    toast("Notifications on for this " + deviceLabel());
  } catch (e) { toast("Couldn't switch on notifications: " + e.message); }
  refreshTop(settingsSheet);
}
async function turnOffPush() {
  try { const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch {}
  CFG.pushOn = false; saveCfg();
  if (myDevice()) removeRec("devices", CFG.deviceId);
  toast("Notifications off for this device"); refreshTop(settingsSheet);
}
// Runs when the app opens: keeps this device's subscription fresh, and tidies up
// if notifications were switched off in the phone's settings.
async function checkPush() {
  if (!CFG.pushOn || !pushReady() || !pushSupported() || !CFG.me) return;
  if (Notification.permission !== "granted") { CFG.pushOn = false; saveCfg(); if (myDevice()) removeRec("devices", CFG.deviceId); return; }
  try { saveDevice(await subscribeThisDevice()); } catch {}
}

// Damien does this once. The public half goes into the shared data (so both phones
// can use it); the private half is pasted into the Cloudflare Worker.
async function makeNotifyKey() {
  if (S.settings.pushKey && !confirm("Make a new notification key? You'll need to paste the new one into Cloudflare too.")) return;
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const pub = await crypto.subtle.exportKey("raw", kp.publicKey);
  NOTIFY_PRIV = (await crypto.subtle.exportKey("jwk", kp.privateKey)).d;
  saveSettings({ pushKey: b64url(pub), tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg" });
  refreshTop(settingsSheet);
}
async function sendTestPush() {
  toast("Sending…");
  await syncNow(true); // make sure the Worker can see this device
  try {
    const res = await fetch(S.settings.pushWorker.replace(/\/+$/, "") + "/test", { method: "POST", headers: { Authorization: "Bearer " + CFG.sync.token, "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: CFG.deviceId }) });
    const j = await res.json().catch(() => ({}));
    toast(res.ok ? "Sent! It should pop up in a few seconds" : (j.error || "The Worker said " + res.status));
  } catch { toast("Couldn't reach the Worker. Check the link in Settings."); }
}

/* ---------- Snooze ---------- */
const SNOOZES = [["15m", "15 min"], ["1h", "1 hour"], ["3h", "3 hours"], ["tmr", "Tomorrow 8am"]];
function snoozeTime(k) {
  if (k === "tmr") { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.getTime(); }
  const min = { "15m": 15, "1h": 60, "3h": 180 }[k] || 60;
  return Math.ceil((Date.now() + min * 60000) / 60000) * 60000; // on the minute
}
function snoozeLabel(ts) {
  const d = new Date(ts), hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return (ymd(d) === today() ? "" : niceDate(ymd(d)) + " ") + hm;
}
const isSnoozed = t => t.snoozeUntil && t.snoozeUntil > Date.now() && !t.done;

/* ---------- Settings card ---------- */
function notifySection() {
  const st = S.settings, state = pushState();
  if (!CFG.sync) return `<p class="small muted" style="margin:0">Set up “Share between your phones” first. Notifications are sent from the shared data.</p>`;
  const thisDevice = {
    "needs-install": `<p class="small" style="margin:0">On iPhone, notifications only work from the Home Screen app. In Safari tap Share → <b>Add to Home Screen</b>, open Studio from there, then come back here.</p>`,
    unsupported: `<p class="small muted" style="margin:0">This browser can't show notifications. Try Chrome on Android or the Home Screen app on iPhone.</p>`,
    denied: `<p class="small" style="margin:0">Notifications are blocked for Studio. Allow them in your phone's settings (Settings → Notifications → Studio), then come back here.</p>`,
    off: `<p class="small" style="margin:0 0 10px">Get a notification when a reminder is due, even when the app is closed. Reminders without a time ping at 8am on the day.</p>
      <button class="btn primary" style="width:100%" data-act="push-on">${icon("bell")}Turn on for this ${esc(deviceLabel())}</button>`,
    on: `<p style="margin:0 0 10px"><span class="pill p-sage">${icon("check", 'style="width:13px;height:13px"')} On for this ${esc(deviceLabel())}</span></p>
      <p class="small muted" style="margin:0 0 10px">You'll get ${esc(ME())}'s reminders and ones for “Both”. ${S.devices.length > 1 ? "Also on: " + esc(S.devices.filter(d => d.id !== CFG.deviceId).map(d => d.who + "'s " + d.label).join(", ")) + "." : ""}</p>
      <div class="actions" style="margin:0"><button class="btn sm" data-act="push-test">${icon("bell")}Send a test</button><button class="btn sm danger" data-act="push-off">Turn off</button></div>`,
  };
  if (state !== "not-setup") return thisDevice[state] + `<details style="margin-top:12px"><summary class="small muted" style="cursor:pointer">Notification setup</summary>${setupSteps()}</details>`;
  return `<p class="small" style="margin:0 0 6px">Get a notification on your phone when a reminder is due, even when Studio is closed.</p>
    <p class="small muted" style="margin:0 0 6px">${esc(st.people[0])} sets this up once (10 minutes, on a laptop is easiest). After that, each of you taps “Turn on” on your own phone.</p>${setupSteps(true)}`;
}
function setupSteps(open) {
  const st = S.settings;
  const keyBox = NOTIFY_PRIV ? `<div class="card pad" style="background:var(--butter-soft);margin:8px 0"><div class="small" style="margin-bottom:6px"><b>Your private notification key</b>. Copy it now — it's only shown once.</div>
      <code style="word-break:break-all;font-size:12px">${esc(NOTIFY_PRIV)}</code><br><button class="btn sm" style="margin-top:8px" data-act="copy-text" data-id="${esc(NOTIFY_PRIV)}">${icon("copy")}Copy key</button></div>` : "";
  return `<ol class="small" style="padding-left:18px;line-height:1.65;margin:8px 0">
      <li><b>Make a key.</b> ${st.pushKey ? `Done ✓ <button class="btn sm ghost" data-act="push-key">Make a new one</button>` : `<button class="btn sm primary" data-act="push-key">Make notification key</button>`}${keyBox}</li>
      <li><b>Make the Worker.</b> On <b>dash.cloudflare.com</b> go to <b>Workers &amp; Pages → Create → Worker</b>. Call it <b>studio-reminders</b> and deploy the “Hello World” starter. Then tap <b>Edit code</b>, delete everything, paste the Worker code and deploy. <button class="btn sm" data-act="copy-worker">${icon("copy")}Copy Worker code</button></li>
      <li><b>Add two secrets.</b> In the Worker's <b>Settings → Variables and Secrets</b>, add two of type <b>Secret</b>:<br>
        <b>GITHUB_TOKEN</b> = your access token <button class="btn sm" data-act="copy-token">${icon("copy")}Copy token</button><br>
        <b>VAPID_PRIVATE_KEY</b> = the private key from step 1</li>
      <li><b>Run it every minute.</b> In <b>Settings → Trigger events</b> (or Triggers), add a <b>Cron Trigger</b> and choose every minute (<code>* * * * *</code>).</li>
      <li><b>Paste the Worker's link here</b> (it looks like https://studio-reminders.yourname.workers.dev):</li>
    </ol>
    <div style="display:flex;gap:8px"><input id="workerUrl" value="${esc(st.pushWorker)}" placeholder="https://studio-reminders….workers.dev" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--surface);font-size:16px"><button class="btn" data-act="push-worker">Save</button></div>
    ${st.pushWorker ? `<p class="small muted" style="margin:8px 0 0">To check it's all working, open the Worker's link in your browser. It should say <code>"ok": true</code>.</p>` : ""}`;
}
async function saveWorkerUrl() {
  let v = ($("#workerUrl") || {}).value.trim().replace(/\/+$/, "");
  if (v && !/^https?:\/\//.test(v)) v = "https://" + v;
  if (v && !/^https:\/\/[^/]+\.[^/]+/.test(v)) { toast("That doesn't look like a link"); return; }
  saveSettings({ pushWorker: v });
  toast(v ? "Saved. Now tap “Turn on” on each phone" : "Removed"); refreshTop(settingsSheet);
}
async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg || "Copied"); } catch { prompt("Copy this:", text); }
}
async function copyWorkerCode() {
  try { const r = await fetch("worker/worker.js", { cache: "no-store" }); if (!r.ok) throw 0; await copyText(await r.text(), "Worker code copied"); }
  catch { toast("Couldn't load it. It's in the studio repo on GitHub: worker/worker.js"); }
}

// When a notification is tapped, or the helper changed something in the background.
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", e => {
  const m = e.data || {};
  if (m.type === "open-task" && m.id) { syncNow(true).finally(() => { if (get("tasks", m.id)) { closeAll(); editTask({ ...get("tasks", m.id) }); } }); }
  if (m.type === "changed") syncNow(true);
});
