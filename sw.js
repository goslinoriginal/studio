// Bump VERSION whenever you change the app so phones pick up the new files.
const VERSION = "studio-v3";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Never cache the shared data — always go straight to GitHub for it.
  if (url.hostname === "api.github.com") return;
  // App page: network first so updates arrive, cached copy when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put("./index.html", copy)); return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  // Icons and fonts: cached copy first, refreshed in the background.
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});

/* ---------- Notifications ---------- */
// The Cloudflare Worker sends a push when a reminder is due; this shows it.
self.addEventListener("push", e => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { body: e.data && e.data.text() }; }
  const opts = { body: m.body || "", tag: m.tag || "studio", renotify: true, icon: "icons/icon-192.png", data: { taskId: m.taskId || null } };
  // Buttons show on Android and computers (iPhones ignore them; tapping opens the reminder instead).
  if (m.taskId) opts.actions = [{ action: "snooze", title: "Snooze 1 hour" }, { action: "done", title: "Done ✓" }];
  e.waitUntil(self.registration.showNotification(m.title || "Studio", opts));
});

self.addEventListener("notificationclick", e => {
  const n = e.notification, id = n.data && n.data.taskId;
  n.close();
  if (id && (e.action === "snooze" || e.action === "done")) {
    e.waitUntil(changeTask(id, e.action).then(tellApp).catch(err =>
      self.registration.showNotification(e.action === "done" ? "Couldn't tick that off" : "Couldn't snooze that", { body: "Open Studio and do it there. (" + err.message + ")", tag: "studio-error", icon: "icons/icon-192.png" })));
    return;
  }
  e.waitUntil(openApp(id));
});

async function openApp(id) {
  const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const w of wins) {
    if ("focus" in w) { await w.focus(); w.postMessage({ type: "open-task", id }); return; }
  }
  return self.clients.openWindow(new URL("./" + (id ? "#task=" + id : ""), self.registration.scope).href);
}
async function tellApp() {
  for (const w of await self.clients.matchAll({ type: "window", includeUncontrolled: true })) w.postMessage({ type: "changed" });
}

// Snooze or tick off a reminder straight from the notification, by saving to the shared data on GitHub.
function readCfg() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("studio", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("kv");
    r.onerror = () => rej(r.error);
    r.onsuccess = () => { const q = r.result.transaction("kv").objectStore("kv").get("cfg"); q.onsuccess = () => res(q.result || {}); q.onerror = () => rej(q.error); };
  });
}
const b64enc = s => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));

async function changeTask(id, action) {
  const { sync, me } = await readCfg();
  if (!sync) throw new Error("not linked");
  const url = `https://api.github.com/repos/${encodeURIComponent(sync.owner)}/${encodeURIComponent(sync.repo)}/contents/${sync.path || "studio-data.json"}`;
  const headers = { Authorization: "Bearer " + sync.token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url + "?t=" + Date.now(), { headers, cache: "no-store" });
    if (!res.ok) throw new Error("GitHub " + res.status);
    const j = await res.json();
    const text = j.content ? b64dec(j.content) : await (await fetch(url + "?t=" + Date.now(), { headers: { ...headers, Accept: "application/vnd.github.raw+json" }, cache: "no-store" })).text();
    const data = JSON.parse(text);
    const t = (data.tasks || []).find(x => x.id === id);
    if (!t) return; // deleted in the meantime
    const now = Date.now();
    if (action === "done") { t.done = true; t.doneAt = now; t.snoozeUntil = null; }
    else t.snoozeUntil = Math.ceil((now + 3600000) / 60000) * 60000;
    t.updatedAt = now; t.by = me || t.by;
    const put = await fetch(url, { method: "PUT", headers, body: JSON.stringify({ message: `${action === "done" ? "Done" : "Snoozed"} from ${me || "someone"}'s notification`, content: b64enc(JSON.stringify(data, null, 1)), sha: j.sha }) });
    if (put.ok) return;
    if (put.status !== 409 && put.status !== 422) throw new Error("GitHub " + put.status);
    await new Promise(r => setTimeout(r, 500 + Math.random() * 800)); // someone saved at the same moment; try again
  }
  throw new Error("busy, try again");
}
