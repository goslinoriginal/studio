/* =====================================================================
   Pop-up sheets: details, forms, settings
   ===================================================================== */
const SHEETS = [];
let ignorePop = false;
function openSheet({ title, body, foot = "", onMount, key }) {
  const ov = document.createElement("div");
  ov.className = "overlay"; ov.dataset.key = key || "";
  if (NOANIM) ov.style.animation = "none";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"${NOANIM ? ' style="animation:none"' : ""}><div class="sheet-h"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Close">${icon("x")}</button></div>
    <div class="sheet-b">${body}</div>${foot ? `<div class="sheet-f">${foot}</div>` : ""}</div>`;
  document.body.appendChild(ov); SHEETS.push(ov);
  if (!(history.state && history.state.sheet)) history.pushState({ sheet: 1 }, "");
  ov.addEventListener("mousedown", e => { ov._down = e.target === ov; });
  ov.addEventListener("click", e => { if ((e.target === ov && ov._down) || e.target.closest("[data-close]")) closeSheet(); });
  document.body.style.overflow = "hidden";
  onMount && onMount(ov);
  return ov;
}
function closeSheet() {
  const ov = SHEETS.pop(); if (ov) ov.remove();
  if (!SHEETS.length) {
    document.body.style.overflow = "";
    setTimeout(() => { if (!SHEETS.length && history.state && history.state.sheet) { ignorePop = true; history.back(); } }, 60);
  }
}
function closeAll() { while (SHEETS.length) closeSheet(); }
window.addEventListener("popstate", () => {
  if (ignorePop) { ignorePop = false; return; }
  const ov = SHEETS.pop(); if (ov) ov.remove();
  if (SHEETS.length) history.pushState({ sheet: 1 }, ""); else document.body.style.overflow = "";
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && SHEETS.length) closeSheet(); });
// Re-open a detail sheet in place after an edit, so it shows fresh data.
let NOANIM = false;
function refreshTop(fn) {
  const ov = SHEETS.pop(); const sc = ov ? ov.querySelector(".sheet-b").scrollTop : 0;
  if (ov) ov.remove();
  NOANIM = true; try { fn(); } finally { NOANIM = false; }
  const top = SHEETS[SHEETS.length - 1];
  if (ov && top && top !== ov) top.querySelector(".sheet-b").scrollTop = sc;
  if (!SHEETS.length) { document.body.style.overflow = ""; setTimeout(() => { if (!SHEETS.length && history.state && history.state.sheet) { ignorePop = true; history.back(); } }, 60); }
}
// After any change, redraw the detail sheet on top so it shows fresh data
// (unless someone is halfway through typing in it).
function refreshDetail() {
  const top = SHEETS[SHEETS.length - 1]; if (!top || !top.dataset.key) return;
  const a = document.activeElement;
  if (a && top.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== "checkbox" && a.value) return;
  const [k, id] = top.dataset.key.split(":");
  const fn = { lead: leadDetail, client: clientDetail, job: jobDetail, doc: docDetail }[k];
  if (fn) refreshTop(() => fn(id));
}

/* ---------- Generic form ---------- */
function fieldHTML(f, v) {
  const id = "f_" + f.k, cls = `f${f.half ? " half" : ""}`;
  v = v ?? f.def ?? "";
  const lab = `<label for="${id}">${esc(f.label)}${f.req ? " *" : ""}</label>`;
  const hint = f.hint ? `<span class="hint">${f.hint}</span>` : "";
  if (f.type === "select") return `<div class="${cls}">${lab}<select id="${id}" name="${f.k}">${f.options.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}" ${String(ov) === String(v) ? "selected" : ""}>${esc(ol)}</option>`; }).join("")}</select>${hint}</div>`;
  if (f.type === "textarea") return `<div class="${cls}">${lab}<textarea id="${id}" name="${f.k}" placeholder="${esc(f.ph || "")}">${esc(v)}</textarea>${hint}</div>`;
  const type = f.type === "money" ? "text" : f.type || "text";
  const extra = f.type === "money" ? 'inputmode="decimal"' : f.type === "tel" ? 'inputmode="tel"' : "";
  return `<div class="${cls}">${lab}<input id="${id}" name="${f.k}" type="${type}" ${extra} value="${esc(f.type === "money" && v !== "" ? num(v) : v)}" placeholder="${esc(f.ph || "")}" ${f.req ? "required" : ""} autocomplete="off">${hint}</div>`;
}
function formSheet({ title, fields, rec = {}, onSave, onDelete, saveLabel = "Save", onMount }) {
  openSheet({
    title,
    body: `<form class="form" id="frm" novalidate>${fields.map(f => fieldHTML(f, rec[f.k])).join("")}</form>`,
    foot: `${onDelete ? `<button class="btn danger" data-del style="flex:0 0 auto">${icon("trash")}</button>` : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>${saveLabel}</button>`,
    onMount: ov => {
      const save = () => {
        const out = { ...rec };
        for (const f of fields) {
          const el = ov.querySelector(`[name="${f.k}"]`); if (!el) continue;
          out[f.k] = f.type === "money" ? (el.value.trim() === "" ? "" : num(el.value)) : el.value.trim();
        }
        const missing = fields.find(f => f.req && !String(out[f.k] ?? "").trim());
        if (missing) { toast(`Please fill in ${missing.label.toLowerCase()}`); ov.querySelector(`[name="${missing.k}"]`).focus(); return; }
        closeSheet(); onSave(out);
      };
      ov.querySelector("[data-save]").onclick = save;
      ov.querySelector("#frm").onsubmit = e => { e.preventDefault(); save(); };
      if (onDelete) ov.querySelector("[data-del]").onclick = () => { if (confirm("Delete this? It will be removed for both of you.")) { closeSheet(); onDelete(); } };
      onMount && onMount(ov);
      const first = ov.querySelector("input,select,textarea");
      if (first && !rec.id && matchMedia("(min-width:700px)").matches) first.focus();
    },
  });
}
const whoOptions = () => ["Both", ...S.settings.people];
const clientOptions = (allowNone = true) => [...(allowNone ? [["", "— None —"]] : []), ...[...S.clients].sort((a, b) => a.business.localeCompare(b.business)).map(c => [c.id, c.business])];

/* ---------- Notes timeline (used by leads, clients, jobs) ---------- */
function notesBlock(coll, rec) {
  const notes = [...(rec.log || [])].sort((a, b) => b.ts - a.ts);
  return `<div class="section"><div class="section-h"><h2 style="font-size:17px">Notes & history</h2></div>
    <div class="card pad">
      <div style="display:flex;gap:8px"><textarea id="newNote" placeholder="Called them, they want a quote by Friday…" style="flex:1;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--surface);font-size:16px;resize:vertical"></textarea>
      <button class="btn primary" data-act="add-note" data-coll="${coll}" data-id="${rec.id}" style="align-self:flex-end">Add</button></div>
      <div style="margin-top:8px">${notes.length ? notes.map(n => `<div class="note"><small>${esc(n.by)} · ${timeAgo(n.ts)}</small><p>${esc(n.text)}</p></div>`).join("") : `<div class="small muted" style="padding:8px 0">No notes yet.</div>`}</div>
    </div></div>`;
}
function contactActions(r) {
  const b = [];
  if (r.phone) b.push(`<a class="btn sm" href="tel:${esc(r.phone.replace(/\s/g, ""))}">${icon("phone")}Call</a>`, `<a class="btn sm" href="${waLink(r.phone)}" target="_blank" rel="noopener">${icon("chat")}WhatsApp</a>`);
  if (r.email) b.push(`<a class="btn sm" href="mailto:${esc(r.email)}">${icon("mail")}Email</a>`);
  const site = r.website || r.liveUrl;
  if (site) b.push(`<a class="btn sm" href="${esc(/^https?:/.test(site) ? site : "https://" + site)}" target="_blank" rel="noopener">${icon("globe")}Website</a>`);
  if (r.address || r.area) b.push(`<a class="btn sm" href="https://maps.google.com/?q=${encodeURIComponent((r.business || "") + " " + (r.address || r.area))}" target="_blank" rel="noopener">${icon("home")}Map</a>`);
  return b.length ? `<div class="actions">${b.join("")}</div>` : "";
}
const kv = pairs => { const p = pairs.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== ""); return p.length ? `<dl class="kv">${p.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""; };
const linkedTasks = id => { const ts = S.tasks.filter(t => t.linkId === id && !t.done); return ts.length ? `<div class="card list" style="margin-top:8px">${ts.map(taskRow).join("")}</div>` : ""; };

/* ---------- Leads ---------- */
const LEAD_FIELDS = () => [
  { k: "business", label: "Business name", req: true, ph: "e.g. Heidelberg Auto Spares" },
  { k: "contact", label: "Contact person", half: true }, { k: "phone", label: "Phone", type: "tel", half: true },
  { k: "email", label: "Email", type: "email", half: true }, { k: "area", label: "Area / town", half: true, ph: "Heidelberg" },
  { k: "industry", label: "Type of business", half: true, ph: "Hair salon, plumber…" },
  { k: "source", label: "Where you found them", type: "select", options: LEAD_SOURCES, half: true },
  { k: "siteStatus", label: "Their website now", type: "select", options: SITE_STATUS, half: true },
  { k: "website", label: "Current site / Facebook link", type: "url", half: true },
  { k: "stage", label: "Stage", type: "select", options: LEAD_STAGES.map(s => [s.k, s.label]), half: true },
  { k: "value", label: "Possible value (R)", type: "money", half: true, ph: "2500" },
  { k: "owner", label: "Who's handling it", type: "select", options: whoOptions(), half: true, def: ME() },
  { k: "followUp", label: "Follow up on", type: "date", half: true, hint: "Shows on Home when it's due" },
  { k: "notes", label: "Notes", type: "textarea", ph: "What they do, what they need, what you noticed…" },
];
function editLead(rec = { stage: "new", source: LEAD_SOURCES[0], siteStatus: SITE_STATUS[0] }, after) {
  formSheet({
    title: rec.id ? "Edit lead" : "New lead", fields: LEAD_FIELDS(), rec,
    onSave: r => { upsert("leads", r); toast(rec.id ? "Lead updated" : "Lead added"); (after || (() => leadDetail(r.id)))(r); },
    onDelete: rec.id ? () => { removeRec("leads", rec.id); closeAll(); toast("Lead deleted"); } : null,
  });
}
function leadDetail(id) {
  const l = get("leads", id); if (!l) return;
  const s = stageOf(l.stage);
  openSheet({
    key: "lead:" + id, title: esc(l.business),
    body: `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"><span class="pill p-${s.c}">${s.label}</span>${l.siteStatus ? `<span class="pill">${esc(l.siteStatus)}</span>` : ""}${l.owner && l.owner !== "Both" ? `<span class="pill">${esc(l.owner)}</span>` : ""}</div>
      ${contactActions(l)}
      <div class="card pad"><div class="small muted" style="font-weight:600;margin-bottom:8px">Move to</div>
        <div class="chips" style="padding-bottom:2px;flex-wrap:wrap">${LEAD_STAGES.map(st => `<button class="chip ${l.stage === st.k ? "on" : ""}" data-act="lead-move" data-id="${id}" data-stage="${st.k}">${st.label}</button>`).join("")}</div>
      </div>
      ${l.clientId && get("clients", l.clientId) ? `<button class="btn" style="width:100%;margin-top:12px" data-act="client" data-id="${l.clientId}">${icon("clients")}Open client: ${esc(clientName(l.clientId))}</button>`
        : `<button class="btn primary" style="width:100%;margin-top:12px" data-act="convert-lead" data-id="${id}">${icon("star")}They said yes — make them a client</button>`}
      <div class="card pad" style="margin-top:12px">${kv([
        ["Contact", esc(l.contact)], ["Phone", esc(l.phone)], ["Email", esc(l.email)], ["Area", esc(l.area)], ["Business type", esc(l.industry)],
        ["Found via", esc(l.source)], ["Current site", l.website ? `<a href="${esc(/^https?:/.test(l.website) ? l.website : "https://" + l.website)}" target="_blank" rel="noopener">${esc(l.website)}</a>` : ""],
        ["Possible value", num(l.value) ? money(l.value) : ""], ["Follow up", l.followUp ? niceDate(l.followUp, true) : ""], ["Notes", esc(l.notes)],
        ["Added", `${niceDate(ymd(l.createdAt), true)}${l.by ? " · last change by " + esc(l.by) : ""}`],
      ])}</div>
      <div class="section"><div class="section-h"><h2 style="font-size:17px">Reminders</h2><button class="btn sm" data-act="new-task-for" data-id="${id}">${icon("bell")}Remind me</button></div>${linkedTasks(id) || `<div class="small muted">None yet.</div>`}</div>
      ${notesBlock("leads", l)}`,
    foot: `<button class="btn" data-act="edit-lead" data-id="${id}">${icon("edit")}Edit</button><button class="btn" data-act="quote-for-lead" data-id="${id}">${icon("doc")}Quote</button>`,
  });
}
function convertLead(id) {
  const l = get("leads", id); if (!l) return;
  const existing = S.clients.find(c => c.business.trim().toLowerCase() === l.business.trim().toLowerCase());
  const c = existing || upsert("clients", { business: l.business, contact: l.contact, phone: l.phone, email: l.email, address: l.area, industry: l.industry, website: "", notes: l.notes, log: [...(l.log || [])], fromLead: l.id });
  upsert("leads", { ...l, stage: "won", clientId: c.id, followUp: "" });
  for (const d of S.docs) if (d.leadId === l.id && !d.clientId) upsert("docs", { ...d, clientId: c.id });
  closeAll(); toast(`${l.business} is now a client 🎉`);
  clientDetail(c.id);
}

/* ---------- Clients ---------- */
const CLIENT_FIELDS = () => [
  { k: "business", label: "Business name", req: true },
  { k: "contact", label: "Contact person", half: true }, { k: "phone", label: "Phone", type: "tel", half: true },
  { k: "email", label: "Email", type: "email", half: true }, { k: "industry", label: "Type of business", half: true },
  { k: "address", label: "Address", type: "textarea", ph: "Shows on their invoices" },
  { k: "website", label: "Their website (once live)", type: "url", half: true, ph: "www.theirsite.co.za" },
  { k: "domain", label: "Domain name", half: true, ph: "theirsite.co.za" },
  { k: "renewal", label: "Domain / hosting renews on", type: "date", half: true, hint: "You'll get a heads-up 30 days before" },
  { k: "monthly", label: "Monthly upkeep fee (R)", type: "money", half: true, ph: "0" },
  { k: "hosting", label: "Hosting notes", type: "textarea", ph: "Where it's hosted, who pays for what. Don't put passwords here." },
  { k: "notes", label: "Notes", type: "textarea" },
];
function editClient(rec = {}) {
  formSheet({
    title: rec.id ? "Edit client" : "New client", fields: CLIENT_FIELDS(), rec,
    onSave: r => { upsert("clients", r); toast(rec.id ? "Client updated" : "Client added"); if (!rec.id) clientDetail(r.id); else refreshIfOpen("client:" + r.id, () => clientDetail(r.id)); },
    onDelete: rec.id ? () => {
      const n = S.jobs.filter(j => j.clientId === rec.id).length + S.docs.filter(d => d.clientId === rec.id).length;
      if (n && !confirm(`This client has ${n} job(s)/invoice(s). They'll stay, but won't be linked to a client. Continue?`)) return;
      removeRec("clients", rec.id); closeAll(); toast("Client deleted");
    } : null,
  });
}
function refreshIfOpen(key, fn) { const top = SHEETS[SHEETS.length - 1]; if (top && top.dataset.key === key) refreshTop(fn); else fn(); }
function clientDetail(id) {
  const c = get("clients", id); if (!c) return;
  const jobs = S.jobs.filter(j => j.clientId === id);
  const docs = S.docs.filter(d => d.clientId === id).sort((a, b) => (b.date || "") < (a.date || "") ? -1 : 1);
  const paid = S.payments.filter(p => p.clientId === id).reduce((a, p) => a + num(p.amount), 0);
  const owed = docs.filter(d => d.type === "invoice" && ["sent", "part", "overdue"].includes(invStatus(d))).reduce((a, d) => a + balance(d), 0);
  openSheet({
    key: "client:" + id, title: esc(c.business),
    body: `${contactActions(c)}
      <div class="stats" style="grid-template-columns:repeat(3,1fr)">
        <div class="card stat"><small>Paid you</small><b style="font-size:19px">${moneyShort(paid)}</b></div>
        <div class="card stat"><small>Owes</small><b style="font-size:19px;color:${owed ? "var(--butter)" : "inherit"}">${moneyShort(owed)}</b></div>
        <div class="card stat"><small>Upkeep</small><b style="font-size:19px">${num(c.monthly) ? moneyShort(c.monthly) : "—"}</b></div>
      </div>
      <div class="card pad" style="margin-top:12px">${kv([
        ["Contact", esc(c.contact)], ["Phone", esc(c.phone)], ["Email", esc(c.email)], ["Business type", esc(c.industry)], ["Address", esc(c.address)],
        ["Website", c.website ? `<a href="${esc(/^https?:/.test(c.website) ? c.website : "https://" + c.website)}" target="_blank" rel="noopener">${esc(c.website)}</a>` : ""],
        ["Domain", esc(c.domain)], ["Renews", c.renewal ? niceDate(c.renewal, true) : ""], ["Hosting", esc(c.hosting)], ["Notes", esc(c.notes)],
      ]) || `<span class="small muted">No details yet — tap Edit to add some.</span>`}</div>
      <div class="section"><div class="section-h"><h2 style="font-size:17px">Jobs</h2><button class="btn sm" data-act="new-job-for" data-id="${id}">${icon("plus")}Job</button></div>
        ${jobs.length ? `<div class="card list">${jobs.map(jobRow).join("")}</div>` : `<div class="small muted">No jobs yet.</div>`}</div>
      <div class="section"><div class="section-h"><h2 style="font-size:17px">Quotes & invoices</h2><span style="display:flex;gap:6px"><button class="btn sm" data-act="new-quote-for" data-id="${id}">${icon("plus")}Quote</button><button class="btn sm" data-act="new-invoice-for" data-id="${id}">${icon("plus")}Invoice</button></span></div>
        ${docs.length ? `<div class="card list">${docs.map(docRow).join("")}</div>` : `<div class="small muted">Nothing yet.</div>`}</div>
      <div class="section"><div class="section-h"><h2 style="font-size:17px">Reminders</h2><button class="btn sm" data-act="new-task-for" data-id="${id}">${icon("bell")}Remind me</button></div>${linkedTasks(id) || `<div class="small muted">None yet.</div>`}</div>
      ${notesBlock("clients", c)}`,
    foot: `<button class="btn" data-act="edit-client" data-id="${id}">${icon("edit")}Edit</button><button class="btn" data-act="new-payment-for" data-id="${id}">${icon("cash")}Payment</button>`,
  });
}

/* ---------- Jobs ---------- */
const JOB_FIELDS = () => [
  { k: "clientId", label: "Client", type: "select", options: clientOptions(false), req: true },
  { k: "title", label: "What you're building", req: true, ph: "5-page website" },
  { k: "status", label: "Status", type: "select", options: JOB_STATUS.map(s => [s.k, s.label]), half: true },
  { k: "price", label: "Price (R)", type: "money", half: true },
  { k: "start", label: "Start date", type: "date", half: true }, { k: "due", label: "Due date", type: "date", half: true },
  { k: "liveUrl", label: "Live link / preview link", type: "url", ph: "https://…" },
  { k: "notes", label: "Notes", type: "textarea", ph: "Pages, colours, what they want…" },
];
function editJob(rec = {}) {
  if (!S.clients.length) { toast("Add a client first"); editClient(); return; }
  if (!rec.id) rec = { status: "todo", start: today(), checklist: S.settings.checklist.map(t => ({ t, done: false })), ...rec };
  formSheet({
    title: rec.id ? "Edit job" : "New job", fields: JOB_FIELDS(), rec,
    onSave: r => { upsert("jobs", r); toast(rec.id ? "Job updated" : "Job added"); refreshIfOpen("job:" + r.id, () => jobDetail(r.id)); },
    onDelete: rec.id ? () => { removeRec("jobs", rec.id); closeAll(); toast("Job deleted"); } : null,
  });
}
function jobDetail(id) {
  const j = get("jobs", id); if (!j) return;
  const ck = j.checklist || [], done = ck.filter(x => x.done).length;
  const docs = S.docs.filter(d => d.jobId === id);
  openSheet({
    key: "job:" + id, title: esc(j.title),
    body: `<button class="btn sm ghost" style="padding-left:0;margin-top:-6px" data-act="client" data-id="${j.clientId}">${icon("clients")}${esc(clientName(j.clientId))}</button>
      <div class="card pad" style="margin-top:6px"><div class="small muted" style="font-weight:600;margin-bottom:8px">Status</div>
        <div class="chips" style="padding-bottom:2px;flex-wrap:wrap">${JOB_STATUS.map(s => `<button class="chip ${(j.status || "todo") === s.k ? "on" : ""}" data-act="job-move" data-id="${id}" data-stage="${s.k}">${s.label}</button>`).join("")}</div></div>
      <div class="card pad" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b>Checklist</b><span class="small muted">${done}/${ck.length}</span></div>
        <div class="progress"><i style="width:${ck.length ? Math.round(done / ck.length * 100) : 0}%"></i></div>
        <div style="margin-top:6px">${ck.map((x, i) => `<label class="check ${x.done ? "done" : ""}"><input type="checkbox" ${x.done ? "checked" : ""} data-act="job-check" data-id="${id}" data-i="${i}"><span style="flex:1">${esc(x.t)}</span><button class="btn ghost sm" data-act="job-uncheck-del" data-id="${id}" data-i="${i}" aria-label="Remove" style="padding:4px;color:var(--muted)">${icon("x", 'style="width:15px;height:15px"')}</button></label>`).join("")}</div>
        <div style="display:flex;gap:8px;margin-top:6px"><input id="newStep" placeholder="Add a step…" style="flex:1;border:1px solid var(--line);border-radius:10px;padding:9px 10px;background:var(--surface);font-size:16px;min-width:0"><button class="btn sm" data-act="job-add-step" data-id="${id}">Add</button></div>
      </div>
      <div class="card pad" style="margin-top:12px">${kv([
        ["Price", num(j.price) ? money(j.price) : ""], ["Started", j.start ? niceDate(j.start, true) : ""], ["Due", j.due ? niceDate(j.due, true) : ""],
        ["Link", j.liveUrl ? `<a href="${esc(j.liveUrl)}" target="_blank" rel="noopener">${esc(j.liveUrl)}</a>` : ""], ["Notes", esc(j.notes)],
      ]) || `<span class="small muted">Tap Edit to add a price and dates.</span>`}</div>
      <div class="section"><div class="section-h"><h2 style="font-size:17px">Quotes & invoices</h2><span style="display:flex;gap:6px"><button class="btn sm" data-act="quote-for-job" data-id="${id}">${icon("plus")}Quote</button><button class="btn sm" data-act="invoice-for-job" data-id="${id}">${icon("plus")}Invoice</button></span></div>
        ${docs.length ? `<div class="card list">${docs.map(docRow).join("")}</div>` : `<div class="small muted">None yet.</div>`}</div>
      ${notesBlock("jobs", j)}`,
    foot: `<button class="btn" data-act="edit-job" data-id="${id}">${icon("edit")}Edit</button>`,
  });
}

/* ---------- Quotes & invoices ---------- */
function newDoc(type, preset = {}) {
  const t = today();
  return {
    type, number: nextDocNumber(type), date: t, status: "draft", vat: S.settings.vat,
    ...(type === "invoice" ? { dueDate: addDays(t, num(S.settings.terms) || 7) } : { validUntil: addDays(t, num(S.settings.quoteValid) || 14) }),
    items: [{ d: "", q: 1, p: "" }], notes: "", ...preset,
  };
}
function editDoc(rec) {
  const isQ = rec.type === "quote";
  const leadOpt = rec.leadId && get("leads", rec.leadId);
  const items = (rec.items && rec.items.length ? rec.items : [{ d: "", q: 1, p: "" }]).map(x => ({ ...x }));
  const itemRow = (it, i) => `<div class="it" data-i="${i}"><input placeholder="Description" value="${esc(it.d)}" data-k="d"><input inputmode="decimal" placeholder="Qty" value="${esc(it.q)}" data-k="q"><input inputmode="decimal" placeholder="Price" value="${esc(it.p)}" data-k="p"><button class="x" data-rm="${i}" aria-label="Remove line">×</button></div>`;
  openSheet({
    title: `${rec.id ? "Edit" : "New"} ${isQ ? "quote" : "invoice"}`,
    body: `<div class="form">
      ${fieldHTML({ k: "number", label: isQ ? "Quote number" : "Invoice number", half: true }, rec.number)}
      ${fieldHTML({ k: "clientId", label: "Client", type: "select", half: true, options: [...(leadOpt && !rec.clientId ? [["", "Lead: " + leadOpt.business]] : [["", "— Pick a client —"]]), ...clientOptions(false)] }, rec.clientId)}
      ${fieldHTML({ k: "date", label: "Date", type: "date", half: true }, rec.date)}
      ${isQ ? fieldHTML({ k: "validUntil", label: "Valid until", type: "date", half: true }, rec.validUntil) : fieldHTML({ k: "dueDate", label: "Due date", type: "date", half: true }, rec.dueDate)}
      <div class="f"><label>Items</label><div class="items" id="items">${items.map(itemRow).join("")}</div>
        <button class="btn sm" id="addItem" type="button" style="align-self:flex-start">${icon("plus")}Add line</button>
        <div class="small muted" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">Quick add: ${["Website design", "Domain (1 year)", "Hosting (1 year)", "Monthly upkeep", "Logo design", "Extra page"].map(q => `<button type="button" class="pill" data-quick="${q}" style="border:0;cursor:pointer">${q}</button>`).join("")}</div></div>
      ${fieldHTML({ k: "discount", label: "Discount (R)", type: "money", half: true }, rec.discount)}
      ${fieldHTML({ k: "vat", label: "VAT %", type: "money", half: true, hint: "Leave 0 if you're not VAT registered" }, rec.vat ?? 0)}
      ${fieldHTML({ k: "notes", label: "Note on the " + (isQ ? "quote" : "invoice"), type: "textarea", ph: isQ ? "What's included, timeline, 50% deposit to start…" : "Optional" }, rec.notes)}
      <div class="f"><div class="card pad" style="display:flex;justify-content:space-between;align-items:center"><span class="muted">Total</span><b id="docTotal" style="font-family:var(--display);font-size:22px"></b></div></div>
    </div>`,
    foot: `${rec.id ? `<button class="btn danger" data-del style="flex:0 0 auto">${icon("trash")}</button>` : ""}<button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>`,
    onMount: ov => {
      const box = ov.querySelector("#items");
      const read = () => $$(".it", box).map(r => ({ d: r.querySelector('[data-k="d"]').value, q: r.querySelector('[data-k="q"]').value, p: r.querySelector('[data-k="p"]').value }));
      const val = k => ov.querySelector(`[name="${k}"]`).value;
      const recalc = () => { $("#docTotal", ov).textContent = money(docTotal({ type: rec.type, items: read(), discount: val("discount"), vat: val("vat") }).total); };
      const redraw = list => { box.innerHTML = list.map(itemRow).join(""); recalc(); };
      ov.addEventListener("input", recalc);
      box.addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { const l = read(); l.splice(+b.dataset.rm, 1); redraw(l.length ? l : [{ d: "", q: 1, p: "" }]); } });
      $("#addItem", ov).onclick = () => { redraw([...read(), { d: "", q: 1, p: "" }]); $$(".it", box).pop().querySelector("input").focus(); };
      $$("[data-quick]", ov).forEach(b => b.onclick = () => { const l = read().filter(x => x.d || num(x.p)); redraw([...l, { d: b.dataset.quick, q: 1, p: "" }]); $$(".it", box).pop().querySelector('[data-k="p"]').focus(); });
      recalc();
      ov.querySelector("[data-save]").onclick = () => {
        const out = { ...rec, number: val("number").trim() || nextDocNumber(rec.type), clientId: val("clientId"), date: val("date"), discount: val("discount") === "" ? "" : num(val("discount")), vat: num(val("vat")), notes: val("notes").trim(),
          items: read().filter(x => x.d.trim() || num(x.p)).map(x => ({ d: x.d.trim(), q: num(x.q) || 1, p: num(x.p) })) };
        if (isQ) out.validUntil = val("validUntil"); else out.dueDate = val("dueDate");
        if (!out.clientId && !out.leadId) { toast("Pick a client"); return; }
        if (!out.items.length) { toast("Add at least one line"); return; }
        if (S.docs.some(d => d.id !== rec.id && d.type === rec.type && d.number === out.number)) { toast(`${out.number} is already used`); return; }
        closeSheet(); upsert("docs", out); toast("Saved"); refreshIfOpen("doc:" + out.id, () => docDetail(out.id));
      };
      if (rec.id) ov.querySelector("[data-del]").onclick = () => {
        const pays = S.payments.filter(p => p.docId === rec.id);
        if (!confirm(`Delete ${rec.number}?${pays.length ? " Its payments will stay in your income." : ""}`)) return;
        closeSheet(); removeRec("docs", rec.id); closeAll(); toast("Deleted");
      };
    },
  });
}
function paperHTML(d) {
  const st = S.settings, c = get("clients", d.clientId) || {}, lead = d.leadId && get("leads", d.leadId);
  const to = c.business ? [c.business, c.contact, c.address, c.email, c.phone] : lead ? [lead.business, lead.contact, lead.area, lead.email, lead.phone] : ["—"];
  const { sub, disc, vat, total } = docTotal(d), paid = paidOn(d), isQ = d.type === "quote";
  return `<div class="paper">
    <div class="ph"><div><h3>${isQ ? "Quote" : "Invoice"}</h3><div style="font-weight:600;margin-top:2px">${esc(d.number)}</div></div>
      <div class="biz"><b>${esc(st.bizName)}</b>\n${esc([st.bizTagline, st.bizPhone, st.bizEmail, st.bizAddress].filter(Boolean).join("\n"))}</div></div>
    <div class="meta"><div><small>${isQ ? "For" : "Bill to"}</small>${esc(to.filter(Boolean).join("\n"))}</div>
      <div style="text-align:right"><small>Date</small>${niceDate(d.date, true)}\n${isQ ? (d.validUntil ? `<small style="margin-top:8px">Valid until</small>${niceDate(d.validUntil, true)}` : "") : (d.dueDate ? `<small style="margin-top:8px">Due</small>${niceDate(d.dueDate, true)}` : "")}</div></div>
    <table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
      <tbody>${(d.items || []).map(it => `<tr><td>${esc(it.d)}</td><td class="r">${esc(it.q)}</td><td class="r">${money(it.p)}</td><td class="r">${money(num(it.q || 1) * num(it.p))}</td></tr>`).join("")}</tbody></table>
    <div class="tot">
      ${disc || vat ? `<div><span>Subtotal</span><span>${money(sub)}</span></div>` : ""}
      ${disc ? `<div><span>Discount</span><span>−${money(disc)}</span></div>` : ""}
      ${vat ? `<div><span>VAT (${num(d.vat)}%)</span><span>${money(vat)}</span></div>` : ""}
      <div class="big"><span>Total</span><span>${money(total)}</span></div>
      ${!isQ && paid ? `<div><span>Paid</span><span>−${money(paid)}</span></div><div style="font-weight:700"><span>Balance due</span><span>${money(Math.max(0, total - paid))}</span></div>` : ""}
    </div>
    ${d.notes ? `<div class="foot" style="color:#2A2320">${esc(d.notes)}</div>` : ""}
    <div class="foot">${!isQ && st.bank ? `<b style="color:#2A2320">Banking details</b>\n${esc(st.bank)}\nPlease use ${esc(d.number)} as your reference.\n\n` : ""}${esc(st.footer)}</div>
  </div>`;
}
function docDetail(id) {
  const d = get("docs", id); if (!d) return;
  const isQ = d.type === "quote", st = invStatus(d), pays = S.payments.filter(p => p.docId === id);
  const btns = [];
  if (st === "draft") btns.push(`<button class="btn sm primary" data-act="doc-sent" data-id="${id}">${icon("check")}Mark as sent</button>`);
  if (!isQ && st !== "paid") btns.push(`<button class="btn sm primary" data-act="pay-doc" data-id="${id}">${icon("cash")}Record payment</button>`);
  if (isQ && !["accepted", "invoiced", "declined"].includes(st)) btns.push(`<button class="btn sm" data-act="quote-accept" data-id="${id}">${icon("check")}Accepted</button>`, `<button class="btn sm" data-act="quote-decline" data-id="${id}">Declined</button>`);
  if (isQ && st !== "invoiced" && st !== "declined") btns.push(`<button class="btn sm" data-act="quote-to-inv" data-id="${id}">${icon("doc")}Turn into invoice</button>`);
  openSheet({
    key: "doc:" + id, title: `${isQ ? "Quote" : "Invoice"} ${esc(d.number)}`,
    body: `<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px">${statusPill(d)}<span class="small muted">${esc(clientName(d.clientId) === "No client" && d.leadId ? (get("leads", d.leadId) || {}).business || "" : clientName(d.clientId))}</span></div>
      <div class="actions">${btns.join("")}
        <button class="btn sm" data-act="doc-print" data-id="${id}">${icon("print")}PDF / Print</button>
        <button class="btn sm" data-act="doc-wa" data-id="${id}">${icon("chat")}WhatsApp</button>
        <button class="btn sm" data-act="doc-mail" data-id="${id}">${icon("mail")}Email</button>
        <button class="btn sm" data-act="doc-dup" data-id="${id}">${icon("copy")}Copy</button></div>
      ${pays.length ? `<div class="card list" style="margin-bottom:12px">${pays.map(payRow).join("")}</div>` : ""}
      ${paperHTML(d)}
      <p class="small muted" style="margin-top:10px">Tip: “PDF / Print” lets you save a PDF — pick “Save as PDF” as the printer, then share it on WhatsApp or email.</p>`,
    foot: `<button class="btn" data-act="edit-doc" data-id="${id}">${icon("edit")}Edit</button>`,
  });
}
function printDoc(d) {
  $("#print").innerHTML = paperHTML(d);
  const old = document.title;
  document.title = `${d.number} - ${clientName(d.clientId)}`;
  setTimeout(() => { window.print(); setTimeout(() => { document.title = old; }, 500); }, 50);
}
function docMessage(d) {
  const c = get("clients", d.clientId) || {}, isQ = d.type === "quote", { total } = docTotal(d);
  const name = (c.contact || "").split(" ")[0];
  let m = `Hi${name ? " " + name : ""}, here's ${isQ ? "our quote" : "your invoice"} ${d.number} for ${money(total)}.`;
  if (!isQ) { const b = balance(d); if (b < total) m += ` Balance due: ${money(b)}.`; if (d.dueDate) m += ` Due ${niceDate(d.dueDate, true)}.`; if (S.settings.bank) m += `\n\nBanking details:\n${S.settings.bank}\nRef: ${d.number}`; }
  else if (d.validUntil) m += ` It's valid until ${niceDate(d.validUntil, true)}.`;
  return m + `\n\nThanks!\n${ME()} – ${S.settings.bizName}`;
}

/* ---------- Payments & expenses ---------- */
function editPayment(rec = {}) {
  const open = S.docs.filter(d => d.type === "invoice" && (invStatus(d) !== "paid" || d.id === rec.docId));
  rec = { date: today(), method: "EFT", ...rec };
  formSheet({
    title: rec.id ? "Edit payment" : "Money in",
    fields: [
      { k: "docId", label: "For invoice", type: "select", options: [["", "— Not linked to an invoice —"], ...open.map(d => [d.id, `${d.number} · ${clientName(d.clientId)} · ${money(balance(d) + (d.id === rec.docId ? num(rec.amount) : 0))} due`])] },
      { k: "clientId", label: "Client", type: "select", options: clientOptions(true) },
      { k: "amount", label: "Amount (R)", type: "money", req: true, half: true }, { k: "date", label: "Date paid", type: "date", half: true },
      { k: "method", label: "How they paid", type: "select", options: PAY_METHODS, half: true },
      { k: "note", label: "Note", half: true, ph: "Deposit, final payment…" },
    ],
    rec,
    onMount: ov => {
      const sel = ov.querySelector('[name="docId"]');
      sel.onchange = () => { const d = get("docs", sel.value); if (d) { ov.querySelector('[name="clientId"]').value = d.clientId || ""; if (!rec.id) ov.querySelector('[name="amount"]').value = balance(d).toFixed(2); } };
      if (rec.docId && !rec.id) sel.onchange();
    },
    onSave: r => {
      if (num(r.amount) <= 0) { toast("Amount must be more than 0"); return; }
      upsert("payments", r);
      const d = r.docId && get("docs", r.docId);
      if (d && d.status === "draft") upsert("docs", { ...d, status: "sent" });
      toast(d && invStatus(get("docs", d.id)) === "paid" ? `${d.number} is fully paid 🎉` : "Payment saved");
      const top = SHEETS[SHEETS.length - 1];
      if (top && top.dataset.key) { const [k, id] = top.dataset.key.split(":"); refreshTop(() => ({ doc: docDetail, client: clientDetail })[k]?.(id)); }
    },
    onDelete: rec.id ? () => { removeRec("payments", rec.id); toast("Payment deleted"); } : null,
  });
}
function editExpense(rec = {}) {
  formSheet({
    title: rec.id ? "Edit expense" : "Money out",
    fields: [
      { k: "desc", label: "What for", req: true, ph: "Domain for Joe's Plumbing" },
      { k: "amount", label: "Amount (R)", type: "money", req: true, half: true }, { k: "date", label: "Date", type: "date", half: true },
      { k: "cat", label: "Category", type: "select", options: EXPENSE_CATS, half: true },
      { k: "clientId", label: "For a client? (optional)", type: "select", options: clientOptions(true), half: true },
      { k: "note", label: "Note", type: "textarea" },
    ],
    rec: { date: today(), cat: EXPENSE_CATS[0], ...rec },
    onSave: r => { if (num(r.amount) <= 0) { toast("Amount must be more than 0"); return; } upsert("expenses", r); toast("Expense saved"); },
    onDelete: rec.id ? () => { removeRec("expenses", rec.id); toast("Expense deleted"); } : null,
  });
}

/* ---------- Reminders ---------- */
function editTask(rec = {}) {
  const links = [["", "— Nothing —"], ...[...S.clients].sort((a, b) => a.business.localeCompare(b.business)).map(c => [c.id, "Client: " + c.business]), ...S.leads.filter(l => OPEN_STAGES.includes(l.stage)).map(l => [l.id, "Lead: " + l.business])];
  rec = { who: ME(), date: today(), ...rec };
  formSheet({
    title: rec.id ? "Edit reminder" : "New reminder",
    fields: [
      { k: "title", label: "What", req: true, ph: "Call Sipho about the quote" },
      { k: "date", label: "Day", type: "date", half: true }, { k: "time", label: "Time (optional)", type: "time", half: true },
      { k: "who", label: "For", type: "select", options: whoOptions(), half: true },
      { k: "linkId", label: "About", type: "select", options: links, half: true },
      { k: "notes", label: "Notes", type: "textarea" },
    ],
    rec, saveLabel: rec.id ? "Save" : "Add reminder",
    onMount: ov => {
      if (rec.id) {
        const f = ov.querySelector(".sheet-f");
        const b = document.createElement("button"); b.className = "btn"; b.style.flex = "0 0 auto"; b.title = "Add to phone calendar"; b.innerHTML = icon("cal");
        b.onclick = () => icsFor(rec); f.insertBefore(b, f.children[1]);
      }
    },
    onSave: r => {
      upsert("tasks", r); toast(rec.id ? "Reminder updated" : "Reminder added");
      const top = SHEETS[SHEETS.length - 1];
      if (top && top.dataset.key) { const [k, id] = top.dataset.key.split(":"); refreshTop(() => ({ lead: leadDetail, client: clientDetail })[k]?.(id)); }
    },
    onDelete: rec.id ? () => { removeRec("tasks", rec.id); toast("Reminder deleted"); } : null,
  });
}
function icsFor(t) {
  if (!t.date) { toast("Give it a day first"); return; }
  const d = t.date.replace(/-/g, ""), stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const escI = s => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, m => "\\" + m);
  let start, end;
  if (t.time) { const tm = t.time.replace(":", "") + "00"; start = `DTSTART:${d}T${tm}`; const e = new Date(`${t.date}T${t.time}:00`); e.setMinutes(e.getMinutes() + 30); end = `DTEND:${ymd(e).replace(/-/g, "")}T${String(e.getHours()).padStart(2, "0")}${String(e.getMinutes()).padStart(2, "0")}00`; }
  else { start = `DTSTART;VALUE=DATE:${d}`; end = `DTEND;VALUE=DATE:${addDays(t.date, 1).replace(/-/g, "")}`; }
  const link = t.linkId && (get("clients", t.linkId) || get("leads", t.linkId));
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Studio//EN", "BEGIN:VEVENT", `UID:${t.id}@studio`, `DTSTAMP:${stamp}`, start, end,
    `SUMMARY:${escI(t.title)}`, `DESCRIPTION:${escI([link ? link.business : "", t.notes].filter(Boolean).join("\n"))}`,
    "BEGIN:VALARM", t.time ? "TRIGGER:-PT15M" : "TRIGGER:PT8H", "ACTION:DISPLAY", `DESCRIPTION:${escI(t.title)}`, "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  download(`reminder-${t.date}.ics`, ics, "text/calendar");
}

/* ---------- Settings ---------- */
function settingsSheet() {
  const st = S.settings, sy = CFG.sync;
  openSheet({
    key: "settings", title: "Settings",
    body: `
      <div class="section-h"><h2 style="font-size:17px">You</h2></div>
      <div class="card pad"><div class="small muted" style="margin-bottom:8px">This device belongs to</div>
        <div class="who" style="margin:0">${st.people.map(p => `<button class="${ME() === p ? "on" : ""}" data-act="pick-me" data-id="${esc(p)}">${esc(p)}</button>`).join("")}</div>
        <div class="small muted" style="margin:14px 0 8px">Look</div>
        <div class="chips" style="padding:0">${[["auto", "Match phone"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => `<button class="chip ${(CFG.theme || "auto") === k ? "on" : ""}" data-act="theme" data-id="${k}">${l}</button>`).join("")}</div>
      </div>

      <div class="section-h section"><h2 style="font-size:17px">Share between your phones</h2></div>
      <div class="card pad">${sy ? `
        <p style="margin:0 0 8px">${syncBadge()}<br><span class="small muted">Saving to <b>${esc(sy.owner)}/${esc(sy.repo)}</b> on GitHub. ${SYNC.last ? "Last synced " + timeAgo(SYNC.last) + "." : ""}</span></p>
        ${SYNC.state === "error" ? `<p class="small" style="color:var(--bad);margin:0 0 8px">${esc(SYNC.msg)}</p>` : ""}
        <div class="actions" style="margin:0"><button class="btn sm primary" data-act="sync-now">${icon("sync")}Sync now</button><button class="btn sm" data-act="invite">${icon("copy")}Copy invite link for ${esc(OTHER())}</button><button class="btn sm danger" data-act="unlink">Unlink this device</button></div>
        <p class="small muted" style="margin:10px 0 0">The invite link contains your access key — only send it to ${esc(OTHER())}, privately.</p>`
      : `<p class="small" style="margin-top:0">Right now everything is saved on this device only. To share with ${esc(OTHER())}, the app keeps one data file in a <b>private</b> GitHub repository (free). Every change is saved there, so GitHub also keeps a full history as a backup.</p>
        <details><summary style="cursor:pointer;font-weight:600;font-size:14px">How to set it up (5 minutes, once)</summary>
          <ol class="small" style="padding-left:18px;line-height:1.6">
            <li>On github.com, make a new repository called <b>studio-data</b>. Set it to <b>Private</b>.</li>
            <li>Go to your profile picture → Settings → Developer settings → Personal access tokens → <b>Fine-grained tokens</b> → Generate new token.</li>
            <li>Name it “Studio”, set expiry to 1 year, under Repository access choose <b>Only select repositories</b> → studio-data.</li>
            <li>Under Permissions → Repository permissions, set <b>Contents</b> to <b>Read and write</b>. Generate it and copy the token.</li>
            <li>Fill in the boxes below and tap Connect. Then tap “Copy invite link” and send it to ${esc(OTHER())}.</li>
          </ol></details>
        <div class="form" style="margin-top:10px">
          ${fieldHTML({ k: "s_owner", label: "GitHub username", half: true, ph: "goslinoriginal" }, "goslinoriginal")}
          ${fieldHTML({ k: "s_repo", label: "Repository", half: true }, "studio-data")}
          ${fieldHTML({ k: "s_token", label: "Access token", type: "password", ph: "github_pat_…" }, "")}
        </div>
        <button class="btn primary" style="width:100%;margin-top:12px" data-act="connect">${icon("sync")}Connect</button>`}
      </div>

      <div class="section-h section"><h2 style="font-size:17px">On your quotes & invoices</h2></div>
      <div class="card pad"><form class="form" id="setForm">
        ${fieldHTML({ k: "bizName", label: "Business name", half: true }, st.bizName)}
        ${fieldHTML({ k: "bizTagline", label: "Line under the name", half: true }, st.bizTagline)}
        ${fieldHTML({ k: "bizPhone", label: "Phone", type: "tel", half: true }, st.bizPhone)}
        ${fieldHTML({ k: "bizEmail", label: "Email", type: "email", half: true }, st.bizEmail)}
        ${fieldHTML({ k: "bizAddress", label: "Address (optional)", type: "textarea" }, st.bizAddress)}
        ${fieldHTML({ k: "bank", label: "Banking details", type: "textarea", ph: "Bank: …\nAccount name: …\nAccount number: …\nBranch code: …" }, st.bank)}
        ${fieldHTML({ k: "invPrefix", label: "Invoice number starts with", half: true }, st.invPrefix)}
        ${fieldHTML({ k: "quotePrefix", label: "Quote number starts with", half: true }, st.quotePrefix)}
        ${fieldHTML({ k: "terms", label: "Days to pay an invoice", type: "money", half: true }, st.terms)}
        ${fieldHTML({ k: "quoteValid", label: "Days a quote is valid", type: "money", half: true }, st.quoteValid)}
        ${fieldHTML({ k: "vat", label: "Default VAT %", type: "money", half: true }, st.vat)}
        ${fieldHTML({ k: "footer", label: "Thank-you line", half: true }, st.footer)}
        ${fieldHTML({ k: "people", label: "Your two names (comma between)", half: true }, st.people.join(", "))}
        ${fieldHTML({ k: "checklist", label: "Steps for every new job (one per line)", type: "textarea" }, st.checklist.join("\n"))}
      </form><button class="btn primary" style="width:100%;margin-top:12px" data-act="save-settings">Save details</button></div>

      <div class="section-h section"><h2 style="font-size:17px">Backup</h2></div>
      <div class="card pad"><p class="small muted" style="margin-top:0">Download everything as one file, or load a backup file back in.</p>
        <div class="actions" style="margin:0"><button class="btn sm" data-act="export">${icon("out")}Download backup</button><label class="btn sm">${icon("doc")}Restore backup<input type="file" accept="application/json,.json" id="importFile" hidden></label><button class="btn sm" data-act="export-csv">${icon("doc")}Income & expenses (CSV)</button></div>
      </div>
      <p class="small muted" style="text-align:center;margin:20px 0 4px">Studio · made for ${esc(st.people.join(" & "))}</p>`,
    onMount: ov => {
      ov.querySelector("#importFile").onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const d = JSON.parse(await f.text());
          if (!d || !d.v || !Array.isArray(d.clients)) throw new Error("not a Studio backup");
          if (!confirm("Merge this backup into your data? Nothing you have now will be lost — newer edits win.")) return;
          S = merge(S, d); commit(); toast("Backup loaded"); refreshTop(settingsSheet);
        } catch (err) { toast("Couldn't read that file: " + err.message); }
      };
    },
  });
}

/* =====================================================================
   Actions (one click handler for the whole app)
   ===================================================================== */
const ACT = {
  "tab": id => { VIEW = id; UI.q = ""; render(); window.scrollTo(0, 0); },
  "goto-money": id => { VIEW = "money"; UI.moneySeg = id; UI.period = "all"; render(); window.scrollTo(0, 0); },
  "goto-jobs": () => { VIEW = "clients"; UI.clientSeg = "jobs"; render(); window.scrollTo(0, 0); },
  "lead-stage": id => { UI.leadStage = id; render(); },
  "client-seg": id => { UI.clientSeg = id; render(); },
  "money-seg": id => { UI.moneySeg = id; render(); },
  "period": id => { UI.period = id; render(); },
  "task-filter": id => { UI.taskFilter = id; render(); },
  "settings": () => settingsSheet(),
  "sync-info": () => { if (!CFG.sync) settingsSheet(); else if (SYNC.state === "error") { toast(SYNC.msg); } else { SYNC.manual = true; syncNow(); } },
  "fab": () => {
    if (VIEW === "leads") return editLead();
    if (VIEW === "clients") return UI.clientSeg === "jobs" ? editJob() : editClient();
    if (VIEW === "tasks") return editTask();
    if (VIEW === "money") return ({ invoices: () => editDoc(newDoc("invoice")), quotes: () => editDoc(newDoc("quote")), payments: () => editPayment(), expenses: () => editExpense() })[UI.moneySeg]();
    openSheet({
      title: "Add", body: `<div class="card list">${[["new-lead", "leads", "Lead", "A business you could sell to", "lilac"], ["new-client", "clients", "Client", "Someone you're working with", "sage"], ["new-job", "job", "Job", "A website you're building", "sky"], ["new-task", "bell", "Reminder", "Don't forget to…", "accent"], ["new-quote", "doc", "Quote", "Send a price", "butter"], ["new-invoice", "doc", "Invoice", "Get paid", "sky"], ["new-payment", "cash", "Money in", "A client paid you", "sage"], ["new-expense", "out", "Money out", "Something you paid for", "accent"]]
        .map(([a, ic, t, s, c]) => `<button class="row" data-act="${a}" data-sub="1"><span class="av p-${c}">${icon(ic, 'style="width:18px;height:18px"')}</span><span class="grow"><span class="t" style="display:block">${t}</span><span class="s" style="display:block">${s}</span></span></button>`).join("")}</div>`,
    });
  },
  "new-lead": () => editLead(), "new-client": () => editClient(), "new-job": () => editJob(), "new-task": () => editTask(),
  "new-quote": () => editDoc(newDoc("quote")), "new-invoice": () => editDoc(newDoc("invoice")), "new-payment": () => editPayment(), "new-expense": () => editExpense(),
  "lead": id => leadDetail(id), "client": id => clientDetail(id), "job": id => jobDetail(id), "doc": id => docDetail(id),
  "task": id => editTask({ ...get("tasks", id) }), "payment": id => editPayment({ ...get("payments", id) }), "expense": id => editExpense({ ...get("expenses", id) }),
  "edit-lead": id => editLead({ ...get("leads", id) }, r => refreshIfOpen("lead:" + r.id, () => leadDetail(r.id))),
  "edit-client": id => editClient({ ...get("clients", id) }), "edit-job": id => editJob({ ...get("jobs", id) }), "edit-doc": id => editDoc(JSON.parse(JSON.stringify(get("docs", id)))),
  "lead-move": (id, el) => { const l = get("leads", id); upsert("leads", { ...l, stage: el.dataset.stage, log: [...(l.log || []), { ts: Date.now(), by: ME(), text: `Moved to “${stageOf(el.dataset.stage).label}”` }] }); refreshTop(() => leadDetail(id)); if (el.dataset.stage === "won" && !l.clientId) toast("Nice! Tap “make them a client” when ready"); },
  "convert-lead": id => convertLead(id),
  "job-move": (id, el) => { const j = get("jobs", id); upsert("jobs", { ...j, status: el.dataset.stage }); refreshTop(() => jobDetail(id)); if (el.dataset.stage === "live") toast("Site is live 🎉 Don't forget the final invoice"); },
  "job-check": (id, el) => { const j = get("jobs", id), ck = (j.checklist || []).map(x => ({ ...x })); ck[+el.dataset.i].done = el.checked; upsert("jobs", { ...j, checklist: ck }); refreshTop(() => jobDetail(id)); },
  "job-uncheck-del": (id, el) => { const j = get("jobs", id), ck = (j.checklist || []).filter((_, i) => i !== +el.dataset.i); upsert("jobs", { ...j, checklist: ck }); refreshTop(() => jobDetail(id)); },
  "job-add-step": id => { const v = $("#newStep").value.trim(); if (!v) return; const j = get("jobs", id); upsert("jobs", { ...j, checklist: [...(j.checklist || []), { t: v, done: false }] }); refreshTop(() => jobDetail(id)); },
  "add-note": (id, el) => {
    const v = $("#newNote").value.trim(); if (!v) return;
    const coll = el.dataset.coll, r = get(coll, id);
    upsert(coll, { ...r, log: [...(r.log || []), { ts: Date.now(), by: ME(), text: v }] });
    refreshTop(() => ({ leads: leadDetail, clients: clientDetail, jobs: jobDetail })[coll](id));
  },
  "new-task-for": id => editTask({ linkId: id, date: addDays(today(), 1) }),
  "new-job-for": id => editJob({ clientId: id }),
  "new-quote-for": id => editDoc(newDoc("quote", { clientId: id })),
  "new-invoice-for": id => editDoc(newDoc("invoice", { clientId: id })),
  "new-payment-for": id => editPayment({ clientId: id }),
  "quote-for-lead": id => { const l = get("leads", id); editDoc(newDoc("quote", l.clientId ? { clientId: l.clientId } : { leadId: id, items: [{ d: "Website design", q: 1, p: num(l.value) || "" }] })); },
  "quote-for-job": id => { const j = get("jobs", id); editDoc(newDoc("quote", { clientId: j.clientId, jobId: id, items: [{ d: j.title, q: 1, p: num(j.price) || "" }] })); },
  "invoice-for-job": id => {
    const j = get("jobs", id), q = S.docs.find(d => d.jobId === id && d.type === "quote" && d.status === "accepted");
    editDoc(newDoc("invoice", { clientId: j.clientId, jobId: id, items: q ? q.items.map(x => ({ ...x })) : [{ d: j.title, q: 1, p: num(j.price) || "" }] }));
  },
  "doc-sent": id => { const d = get("docs", id); upsert("docs", { ...d, status: "sent", sentOn: today() }); refreshTop(() => docDetail(id)); toast("Marked as sent"); },
  "pay-doc": id => { const d = get("docs", id); editPayment({ docId: id, clientId: d.clientId }); },
  "quote-accept": id => {
    const d = get("docs", id); upsert("docs", { ...d, status: "accepted" });
    if (d.leadId) { const l = get("leads", d.leadId); if (l && !l.clientId) { refreshTop(() => docDetail(id)); if (confirm(`${l.business} accepted! Make them a client now?`)) convertLead(l.id); return; } }
    refreshTop(() => docDetail(id)); toast("Quote accepted 🎉");
  },
  "quote-decline": id => { const d = get("docs", id); upsert("docs", { ...d, status: "declined" }); refreshTop(() => docDetail(id)); },
  "quote-to-inv": id => {
    const q = get("docs", id);
    if (!q.clientId) { toast("Make the lead a client first"); return; }
    const inv = newDoc("invoice", { clientId: q.clientId, jobId: q.jobId, items: q.items.map(x => ({ ...x })), discount: q.discount, vat: q.vat, fromQuote: q.id });
    upsert("docs", { ...q, status: "invoiced" });
    upsert("docs", inv); closeSheet(); docDetail(inv.id); toast(`Invoice ${inv.number} created`);
  },
  "doc-print": id => printDoc(get("docs", id)),
  "doc-wa": id => { const d = get("docs", id), c = get("clients", d.clientId) || (d.leadId && get("leads", d.leadId)) || {}; window.open(c.phone ? waLink(c.phone, docMessage(d)) : "https://wa.me/?text=" + encodeURIComponent(docMessage(d)), "_blank"); if (d.status === "draft") upsert("docs", { ...d, status: "sent", sentOn: today() }); },
  "doc-mail": id => { const d = get("docs", id), c = get("clients", d.clientId) || {}; location.href = `mailto:${encodeURIComponent(c.email || "")}?subject=${encodeURIComponent(`${d.type === "quote" ? "Quote" : "Invoice"} ${d.number} from ${S.settings.bizName}`)}&body=${encodeURIComponent(docMessage(d) + "\n\n(PDF attached)")}`; },
  "doc-dup": id => { const d = JSON.parse(JSON.stringify(get("docs", id))); for (const k of ["id", "createdAt", "updatedAt", "by", "sentOn", "fromQuote"]) delete d[k]; closeSheet(); editDoc({ ...newDoc(d.type), clientId: d.clientId, jobId: d.jobId, items: d.items, discount: d.discount, vat: d.vat, notes: d.notes }); },
  "toggle-task": (id, el) => { const t = get("tasks", id); upsert("tasks", { ...t, done: el.checked, doneAt: el.checked ? Date.now() : null }); if (el.checked) toast("Done ✓"); const top = SHEETS[SHEETS.length - 1]; if (top && top.dataset.key) { const [k, kid] = top.dataset.key.split(":"); refreshTop(() => ({ lead: leadDetail, client: clientDetail })[k]?.(kid)); } },
  "pick-me": id => { CFG.me = id; saveCfg(); if (SHEETS.length) refreshTop(settingsSheet); render(); syncNow(true); },
  "theme": id => { CFG.theme = id; saveCfg(); applyTheme(); refreshTop(settingsSheet); },
  "save-settings": () => {
    const f = $("#setForm"), v = k => f.querySelector(`[name="${k}"]`).value;
    const people = v("people").split(",").map(s => s.trim()).filter(Boolean).slice(0, 2);
    const oldMe = ME();
    saveSettings({ bizName: v("bizName").trim(), bizTagline: v("bizTagline").trim(), bizPhone: v("bizPhone").trim(), bizEmail: v("bizEmail").trim(), bizAddress: v("bizAddress").trim(), bank: v("bank").trim(),
      invPrefix: v("invPrefix"), quotePrefix: v("quotePrefix"), terms: num(v("terms")) || 7, quoteValid: num(v("quoteValid")) || 14, vat: num(v("vat")), footer: v("footer").trim(),
      people: people.length === 2 ? people : S.settings.people, checklist: v("checklist").split("\n").map(s => s.trim()).filter(Boolean) });
    if (!S.settings.people.includes(oldMe)) { CFG.me = S.settings.people[0]; saveCfg(); }
    toast("Details saved"); refreshTop(settingsSheet);
  },
  "connect": async () => {
    const owner = $('[name="s_owner"]').value.trim(), repo = $('[name="s_repo"]').value.trim(), token = $('[name="s_token"]').value.trim();
    if (!owner || !repo || !token) { toast("Fill in all three boxes"); return; }
    CFG.sync = { owner, repo, token, path: "studio-data.json" }; saveCfg();
    toast("Connecting…"); await syncNow(true);
    if (SYNC.state === "error") { const m = SYNC.msg; delete CFG.sync; saveCfg(); setSync("off"); toast(m); return; }
    toast("Connected! Now send the invite link"); refreshTop(settingsSheet); render();
  },
  "sync-now": () => { SYNC.manual = true; syncNow().then(() => { if (SHEETS.length) refreshTop(settingsSheet); }); },
  "invite": async () => {
    const code = b64enc(JSON.stringify({ o: CFG.sync.owner, r: CFG.sync.repo, t: CFG.sync.token }));
    const link = location.origin + location.pathname + "#join=" + code;
    const text = `Open this on your phone to join our Studio app:\n${link}`;
    if (navigator.share) { try { await navigator.share({ title: "Studio invite", text }); return; } catch {} }
    try { await navigator.clipboard.writeText(link); toast("Invite link copied — send it privately"); } catch { prompt("Copy this invite link:", link); }
  },
  "unlink": () => { if (!confirm("Stop sharing on this device? Your data stays here, it just won't sync any more.")) return; delete CFG.sync; saveCfg(); setSync("off"); refreshTop(settingsSheet); render(); },
  "export": () => download(`studio-backup-${today()}.json`, JSON.stringify(canon(S), null, 1)),
  "export-csv": () => {
    const rows = [["Date", "Type", "Description", "Client", "Category / method", "Amount"]];
    for (const p of S.payments) rows.push([p.date, "Money in", p.note || (get("docs", p.docId) || {}).number || "", p.clientId ? clientName(p.clientId) : "", p.method || "", num(p.amount).toFixed(2)]);
    for (const e of S.expenses) rows.push([e.date, "Money out", e.desc, e.clientId ? clientName(e.clientId) : "", e.cat || "", (-num(e.amount)).toFixed(2)]);
    rows.splice(1, rows.length, ...rows.slice(1).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    download(`studio-money-${today()}.csv`, rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  },
};
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const act = el.dataset.act, fn = ACT[act]; if (!fn) return;
  if (el.tagName === "INPUT" && el.type === "checkbox") e.stopPropagation();
  else e.preventDefault();
  // from the "Add" menu: close it first, then open the form
  if (el.dataset.sub) closeSheet();
  // don't trigger the row underneath when ticking a checkbox inside it
  if (act === "task" && e.target.closest('input[type="checkbox"]')) return;
  fn(el.dataset.id, el);
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { UI.q = e.target.value; $("#qres").innerHTML = searchResults(); }
});

/* ---------- Start ---------- */
(function start() {
  const m = location.hash.match(/#join=([^&]+)/);
  if (m) {
    try {
      const j = JSON.parse(b64dec(decodeURIComponent(m[1])));
      CFG.sync = { owner: j.o, repo: j.r, token: j.t, path: "studio-data.json" }; saveCfg();
      SYNC.state = "idle";
    } catch { alert("That invite link looks broken. Ask for a new one."); }
    history.replaceState(null, "", location.pathname);
  }
  applyTheme(); render();
  if (CFG.sync) syncNow(true);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
