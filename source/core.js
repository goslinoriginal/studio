"use strict";
/* =====================================================================
   Studio — a shared business app for Mari & Damien.
   Everything is in this one file: data, sync, screens and pop-ups.
   ===================================================================== */

/* ---------- Small helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const num = v => { const n = parseFloat(String(v ?? "").replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; };
const ymd = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const today = () => ymd(new Date());
const addDays = (dateStr, n) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n); return ymd(d); };
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5);
const money = n => "R " + Number(n || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const moneyShort = n => { n = Number(n || 0); return "R " + (Math.abs(n) >= 100000 ? (n / 1000).toFixed(0) + "k" : Math.round(n).toLocaleString("en-ZA")); };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function niceDate(s, withYear) {
  if (!s) return "";
  const d = new Date(s + "T12:00:00"), t = today();
  const diff = daysBetween(t, s);
  if (!withYear) { if (diff === 0) return "Today"; if (diff === 1) return "Tomorrow"; if (diff === -1) return "Yesterday"; }
  return `${d.getDate()} ${MONTHS[d.getMonth()]}` + (withYear || d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "");
}
function timeAgo(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago"; if (s < 604800) return Math.floor(s / 86400) + "d ago";
  return niceDate(ymd(ts));
}
const initials = s => (String(s || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("") || "?").toUpperCase();
function waLink(phone, text) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("0")) d = "27" + d.slice(1);
  return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "");
}
function toast(msg) {
  $$(".toast").forEach(t => t.remove());
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- Icons (inline SVG, stroke style) ---------- */
const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  leads: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6c2.4.2 4 1.8 4.5 4.4"/>',
  money: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 9v.01M18 15v.01"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  phone: '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 7 7L16 14l5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  chat: '<path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  job: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 8h18M7 21h10M12 18v3"/>',
  cash: '<path d="M12 3v18M16.5 7.5C16 5.9 14.3 5 12 5c-2.8 0-4.5 1.3-4.5 3.3 0 4.5 9 2.2 9 7 0 2-1.8 3.4-4.5 3.4-2.4 0-4.2-1-4.7-2.8"/>',
  out: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const icon = (n, extra = "") => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON[n] || ""}</svg>`;

/* ---------- Lists the app uses ---------- */
const LEAD_STAGES = [
  { k: "new", label: "New", c: "sky" },
  { k: "contacted", label: "Contacted", c: "lilac" },
  { k: "meeting", label: "Interested", c: "butter" },
  { k: "quoted", label: "Quote sent", c: "accent" },
  { k: "won", label: "Won", c: "sage" },
  { k: "lost", label: "Not now", c: "" },
];
const OPEN_STAGES = ["new", "contacted", "meeting", "quoted"];
const stageOf = k => LEAD_STAGES.find(s => s.k === k) || LEAD_STAGES[0];
const LEAD_SOURCES = ["Walked past", "Google Maps", "Facebook", "Instagram", "Referral", "Cold call", "Other"];
const SITE_STATUS = ["No website", "Outdated website", "Facebook page only", "Has a decent site"];
const JOB_STATUS = [
  { k: "todo", label: "Not started", c: "" },
  { k: "content", label: "Getting content", c: "butter" },
  { k: "building", label: "Building", c: "sky" },
  { k: "review", label: "Client review", c: "lilac" },
  { k: "live", label: "Live", c: "sage" },
  { k: "hold", label: "On hold", c: "bad" },
];
const jobStatusOf = k => JOB_STATUS.find(s => s.k === k) || JOB_STATUS[0];
const EXPENSE_CATS = ["Hosting", "Domain", "Software / AI", "Ads & marketing", "Data & airtime", "Transport", "Other"];
const PAY_METHODS = ["EFT", "Cash", "Card", "SnapScan / Zapper", "Other"];

/* ---------- Data ---------- */
const COLLS = ["clients", "leads", "jobs", "tasks", "docs", "payments", "expenses"];
// Everything that gets saved and synced. "devices" = phones with notifications switched on.
const DATA_COLLS = [...COLLS, "devices"];
const DEFAULT_SETTINGS = {
  people: ["Damien", "Mari"],
  bizName: "Mari & Damien",
  bizTagline: "Websites for local businesses",
  bizEmail: "", bizPhone: "", bizAddress: "",
  bank: "",
  invPrefix: "INV-", quotePrefix: "Q-",
  terms: 7, quoteValid: 14, vat: 0,
  footer: "Thank you for your business!",
  pushKey: "", pushWorker: "", tz: "Africa/Johannesburg",
  checklist: ["Get logo & photos", "Get business info & text", "Register domain", "Build first draft", "Client feedback", "Final changes", "Go live", "Send final invoice"],
  updatedAt: 0,
};
const blank = () => ({ v: 1, ...Object.fromEntries(DATA_COLLS.map(c => [c, []])), settings: { ...DEFAULT_SETTINGS }, deleted: {} });

const LS_DATA = "studio_data", LS_CFG = "studio_cfg";
let S = (() => { try { const d = JSON.parse(localStorage.getItem(LS_DATA)); if (d && d.v) { for (const c of DATA_COLLS) d[c] ||= []; d.deleted ||= {}; d.settings = { ...DEFAULT_SETTINGS, ...d.settings }; return d; } } catch {} return blank(); })();
let CFG = (() => { try { return JSON.parse(localStorage.getItem(LS_CFG)) || {}; } catch { return {}; } })();
const saveLocal = () => { try { localStorage.setItem(LS_DATA, JSON.stringify(S)); } catch (e) { toast("Couldn't save on this device: " + e.message); } };
const saveCfg = () => { localStorage.setItem(LS_CFG, JSON.stringify(CFG)); shareWithWorker(); };
// The background helper (sw.js) can't read localStorage, so it gets its own copy of
// the sync details in IndexedDB. It needs them to snooze or tick off a reminder
// straight from a notification.
function idbKV() {
  return new Promise((res, rej) => { const r = indexedDB.open("studio", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function shareWithWorker() {
  try { const db = await idbKV(); const tx = db.transaction("kv", "readwrite"); tx.objectStore("kv").put({ sync: CFG.sync || null, me: CFG.me || "" }, "cfg"); } catch {}
}
const ME = () => CFG.me || S.settings.people[0];
const OTHER = () => S.settings.people.find(p => p !== ME()) || S.settings.people[1];

const get = (coll, id) => S[coll].find(r => r.id === id);
function upsert(coll, rec) {
  const now = Date.now();
  if (!rec.id) { rec.id = uid(); rec.createdAt = now; }
  rec.updatedAt = now; rec.by = ME();
  const i = S[coll].findIndex(r => r.id === rec.id);
  if (i >= 0) S[coll][i] = rec; else S[coll].push(rec);
  commit();
  return rec;
}
function removeRec(coll, id) {
  S[coll] = S[coll].filter(r => r.id !== id);
  S.deleted[id] = Date.now();
  commit();
}
function saveSettings(patch) {
  S.settings = { ...S.settings, ...patch, updatedAt: Date.now() };
  commit();
}
function commit() { saveLocal(); render(); refreshDetail(); scheduleSync(); }

/* Merge two copies of the data. For every record the newest edit wins;
   deleted records stay deleted unless someone edited them afterwards. */
function merge(a, b) {
  if (!b) return canon(a);
  const out = blank();
  out.deleted = { ...(a.deleted || {}) };
  for (const [id, ts] of Object.entries(b.deleted || {})) out.deleted[id] = Math.max(out.deleted[id] || 0, ts);
  for (const c of DATA_COLLS) {
    const map = new Map();
    for (const r of [...(a[c] || []), ...(b[c] || [])]) {
      const cur = map.get(r.id);
      if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) map.set(r.id, r);
    }
    out[c] = [...map.values()].filter(r => !(out.deleted[r.id] >= (r.updatedAt || 0)));
  }
  const sa = a.settings || {}, sb = b.settings || {};
  out.settings = { ...DEFAULT_SETTINGS, ...((sb.updatedAt || 0) > (sa.updatedAt || 0) ? sb : sa) };
  return canon(out);
}
// Same data always serialises the same way, so we can tell if anything really changed.
function canon(d) {
  const out = { v: 1 };
  for (const c of DATA_COLLS) out[c] = [...(d[c] || [])].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  out.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
  // forget deletion markers older than 120 days to keep the file small
  const cutoff = Date.now() - 120 * 864e5;
  out.deleted = Object.fromEntries(Object.entries(d.deleted || {}).filter(([, t]) => t > cutoff).sort());
  return out;
}

/* ---------- Sharing between phones: a data file in a private GitHub repo ----------
   Each save is a commit, so GitHub also keeps a full history (a free backup). */
const SYNC = { state: CFG.sync ? "idle" : "off", msg: "", last: 0, busy: false, again: false, timer: null };
const b64enc = s => { const bytes = new TextEncoder().encode(s); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
const b64dec = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, "")), c => c.charCodeAt(0)));

async function ghFetch(path, opts = {}) {
  const { token } = CFG.sync;
  const res = await fetch("https://api.github.com" + path, {
    cache: "no-store", ...opts,
    headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.headers || {}) },
  });
  return res;
}
function ghError(res, j) {
  if (res.status === 401) return "GitHub didn't accept the access token. It may have expired — make a new one in Settings → Sharing.";
  if (res.status === 403) return "The access token isn't allowed to change this repository. Give it Contents: Read and write.";
  if (res.status === 404) return "Couldn't find that repository. Check the name, and that the token can see it.";
  return (j && j.message) || "GitHub error " + res.status;
}
const dataPath = () => `/repos/${encodeURIComponent(CFG.sync.owner)}/${encodeURIComponent(CFG.sync.repo)}/contents/${CFG.sync.path || "studio-data.json"}`;

async function pullRemote() {
  const res = await ghFetch(dataPath() + "?t=" + Date.now());
  if (res.status === 404) {
    const repo = await ghFetch(`/repos/${encodeURIComponent(CFG.sync.owner)}/${encodeURIComponent(CFG.sync.repo)}`);
    if (!repo.ok) throw new Error(ghError(repo));
    return null; // repo exists, data file not created yet
  }
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new Error(ghError(res, j));
  let text;
  if (j.content && j.encoding === "base64") text = b64dec(j.content);
  else { // big file (over 1 MB): ask for the raw contents
    const raw = await ghFetch(dataPath() + "?t=" + Date.now(), { headers: { Accept: "application/vnd.github.raw+json" } });
    text = await raw.text();
  }
  return { sha: j.sha, data: JSON.parse(text) };
}
async function pushRemote(data, sha) {
  const res = await ghFetch(dataPath(), {
    method: "PUT",
    body: JSON.stringify({ message: `Update from ${ME()}'s ${/Mobi|Android|iPhone/i.test(navigator.userAgent) ? "phone" : "computer"}`, content: b64enc(JSON.stringify(data, null, 1)), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) return false; // someone else saved first — merge again
  if (!res.ok) { const j = await res.json().catch(() => null); throw new Error(ghError(res, j)); }
  return true;
}
async function syncNow(quiet) {
  if (!CFG.sync) return;
  if (!navigator.onLine) { setSync("offline"); return; }
  if (SYNC.busy) { SYNC.again = true; return; }
  SYNC.busy = true; setSync("syncing");
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      const remote = await pullRemote();
      const merged = merge(S, remote && remote.data);
      const before = JSON.stringify(canon(S));
      S = merged; saveLocal();
      const same = remote && JSON.stringify(canon(remote.data)) === JSON.stringify(merged);
      if (JSON.stringify(merged) !== before) { render(); refreshDetail(); }
      if (same) break;
      if (await pushRemote(merged, remote && remote.sha)) break;
      await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    }
    SYNC.last = Date.now(); setSync("ok");
    if (!quiet && SYNC.manual) { toast("All synced"); SYNC.manual = false; }
  } catch (e) {
    setSync("error", e.message || String(e));
  } finally {
    SYNC.busy = false;
    if (SYNC.again) { SYNC.again = false; syncNow(true); }
  }
}
function scheduleSync() { if (!CFG.sync) return; clearTimeout(SYNC.timer); setSync("pending"); SYNC.timer = setTimeout(() => syncNow(true), 1200); }
function setSync(state, msg = "") { SYNC.state = state; SYNC.msg = msg; const el = $("#syncBadge"); if (el) el.outerHTML = syncBadge(); }
function syncBadge() {
  const m = {
    off: ["var(--muted)", "This device only"], idle: ["var(--muted)", "Shared"], pending: ["var(--butter)", "Saving…"],
    syncing: ["var(--sky)", "Syncing…"], ok: ["var(--sage)", "Synced"], offline: ["var(--butter)", "Offline — will sync later"], error: ["var(--bad)", "Sync problem"],
  }[SYNC.state] || ["var(--muted)", ""];
  return `<button class="sync" id="syncBadge" data-act="sync-info" title="${esc(SYNC.msg)}"><span class="dot" style="background:${m[0]}"></span>${m[1]}</button>`;
}
// Keep both phones up to date: sync when the app opens, comes back into view, or every minute while open.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(true); });
window.addEventListener("online", () => syncNow(true));
setInterval(() => { if (document.visibilityState === "visible") syncNow(true); }, 60000);

/* ---------- Derived numbers ---------- */
const docTotal = d => {
  const sub = (d.items || []).reduce((a, it) => a + num(it.q || 1) * num(it.p), 0);
  const disc = num(d.discount);
  const vat = d.type === "invoice" || d.type === "quote" ? (sub - disc) * num(d.vat ?? 0) / 100 : 0;
  return { sub, disc, vat, total: sub - disc + vat };
};
const paidOn = d => S.payments.filter(p => p.docId === d.id).reduce((a, p) => a + num(p.amount), 0);
const balance = d => docTotal(d).total - paidOn(d);
function invStatus(d) {
  if (d.type === "quote") {
    if (d.status === "accepted" || d.status === "declined" || d.status === "invoiced") return d.status;
    if (d.status === "sent" && d.validUntil && d.validUntil < today()) return "expired";
    return d.status || "draft";
  }
  const t = docTotal(d).total, p = paidOn(d);
  if (t > 0 && p >= t - 0.005) return "paid";
  if (d.status === "draft" || !d.status) return p > 0 ? "part" : "draft";
  if (d.dueDate && d.dueDate < today()) return "overdue";
  return p > 0 ? "part" : "sent";
}
const STATUS_PILL = {
  draft: ["Draft", ""], sent: ["Sent", "p-sky"], paid: ["Paid", "p-sage"], part: ["Part paid", "p-butter"], overdue: ["Overdue", "p-bad"],
  accepted: ["Accepted", "p-sage"], declined: ["Declined", ""], expired: ["Expired", "p-butter"], invoiced: ["Invoiced", "p-lilac"],
};
const statusPill = d => { const [l, c] = STATUS_PILL[invStatus(d)] || ["", ""]; return `<span class="pill ${c}">${l}</span>`; };
const clientName = id => (get("clients", id) || {}).business || "No client";
function nextDocNumber(type) {
  const prefix = type === "quote" ? S.settings.quotePrefix : S.settings.invPrefix;
  let max = 0;
  for (const d of S.docs) if (d.type === type) { const m = String(d.number || "").match(/(\d+)\s*$/); if (m) max = Math.max(max, +m[1]); }
  return prefix + String(max + 1).padStart(4, "0");
}
function inPeriod(dateStr, period) {
  if (!dateStr) return false;
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const [dy, dm] = dateStr.split("-").map(Number);
  if (period === "month") return dy === y && dm - 1 === m;
  if (period === "last") { const lm = m === 0 ? 11 : m - 1, ly = m === 0 ? y - 1 : y; return dy === ly && dm - 1 === lm; }
  if (period === "year") return dy === y;
  return true;
}
