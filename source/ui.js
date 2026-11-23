/* =====================================================================
   Screens
   ===================================================================== */
let VIEW = "home";
const UI = { leadStage: "open", clientSeg: "clients", moneySeg: "invoices", period: "month", taskFilter: "all", q: "" };
const wide = () => matchMedia("(min-width:1000px)").matches;
matchMedia("(min-width:1000px)").addEventListener("change", () => render());

function applyTheme() {
  const t = CFG.theme || "auto";
  const dark = t === "dark" || (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $('meta[name="theme-color"]').content = dark ? "#1A1614" : "#F6F1EA";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

const TABS = [["home", "Home"], ["leads", "Leads"], ["clients", "Clients"], ["money", "Money"], ["tasks", "Reminders"]];

function render() {
  const app = $("#app");
  if (!CFG.me) { app.innerHTML = welcomeView(); return; }
  const scrollY = window.scrollY;
  const qFocus = document.activeElement && document.activeElement.id === "q" ? document.activeElement.selectionStart : null;
  const views = { home: homeView, leads: leadsView, clients: clientsView, money: moneyView, tasks: tasksView };
  const titles = { home: greeting(), leads: "Leads", clients: UI.clientSeg === "jobs" ? "Jobs" : "Clients", money: "Money", tasks: "Reminders" };
  const badge = S.tasks.filter(t => !t.done && t.date && t.date <= today() && (t.who === "Both" || t.who === ME() || !t.who)).length;
  app.innerHTML = `
    <nav class="tabs">
      <div class="brand"><b>Studio</b><span>${esc(S.settings.bizName)}</span></div>
      ${TABS.map(([k, l]) => `<button class="${VIEW === k ? "on" : ""}" data-act="tab" data-id="${k}">${icon(k)}<span>${l}</span>${k === "tasks" && badge ? `<span class="tab-badge">${badge}</span>` : ""}</button>`).join("")}
    </nav>
    <header class="top">
      <h1>${titles[VIEW]}</h1>
      ${syncBadge()}
      <button class="icon-btn" data-act="settings" aria-label="Settings">${icon("gear")}</button>
    </header>
    <main class="main">${views[VIEW]()}</main>
    <button class="fab" data-act="fab" aria-label="Add">${icon("plus")}</button>`;
  window.scrollTo(0, scrollY);
  if (qFocus !== null && $("#q")) { const q = $("#q"); q.focus(); try { q.setSelectionRange(qFocus, qFocus); } catch {} }
}
function greeting() {
  const h = new Date().getHours();
  return `${h < 12 ? "Morning" : h < 18 ? "Hi" : "Evening"}, ${esc(ME())}`;
}

/* ---------- Welcome (first time on a device) ---------- */
function welcomeView() {
  const joined = !!CFG.sync;
  return `<div class="welcome">
    <img class="logo" src="icons/icon-192.png" alt="">
    <h1>Studio</h1>
    <p class="muted">Clients, leads, reminders, quotes, invoices and money for your website business — shared between the two of you.</p>
    ${joined ? `<div class="card pad small" style="margin-top:14px">${icon("sync", 'style="width:16px;height:16px;vertical-align:-3px"')} This phone is linked to your shared data. Pick who you are and you're in.</div>` : ""}
    <h3 style="margin-top:22px;font-size:18px">Who's using this device?</h3>
    <div class="who">${S.settings.people.map(p => `<button data-act="pick-me" data-id="${esc(p)}">${esc(p)}</button>`).join("")}</div>
    <p class="small muted">You can change names, your business details and set up sharing in Settings afterwards.</p>
    ${joined ? "" : `<div class="card pad" style="margin-top:16px"><b style="font-size:14px">Got an invite link?</b>
      <p class="small muted" style="margin:4px 0 10px">Paste it here to join your shared data (on iPhone, do this inside the home-screen app).</p>
      <div style="display:flex;gap:8px"><input id="joinLink" placeholder="https://…#join=…" style="flex:1;min-width:0;border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--surface);font-size:16px"><button class="btn primary" data-act="join-paste">Join</button></div></div>`}
  </div>`;
}

/* ---------- Home ---------- */
function attentionItems() {
  const t = today(), items = [];
  for (const k of S.tasks) if (!k.done && k.date && k.date <= t)
    items.push({ act: "task", id: k.id, ic: "bell", c: k.date < t ? "bad" : "accent", title: k.title, sub: `${k.date < t ? "Overdue · " + niceDate(k.date) : "Today" + (k.time ? " " + k.time : "")}${k.who && k.who !== "Both" ? " · " + k.who : ""}`, sort: k.date + (k.time || "") });
  for (const l of S.leads) if (OPEN_STAGES.includes(l.stage) && l.followUp && l.followUp <= t)
    items.push({ act: "lead", id: l.id, ic: "leads", c: "lilac", title: `Follow up: ${l.business}`, sub: `${stageOf(l.stage).label} · ${niceDate(l.followUp)}`, sort: l.followUp });
  for (const d of S.docs) {
    const st = invStatus(d);
    if (d.type === "invoice" && st === "overdue") items.push({ act: "doc", id: d.id, ic: "doc", c: "bad", title: `${d.number} is overdue`, sub: `${clientName(d.clientId)} · ${money(balance(d))} owed`, sort: d.dueDate });
    if (d.type === "quote" && d.status === "sent" && d.sentOn && daysBetween(d.sentOn, t) >= 5) items.push({ act: "doc", id: d.id, ic: "doc", c: "butter", title: `Chase quote ${d.number}`, sub: `${clientName(d.clientId)} · sent ${niceDate(d.sentOn)}`, sort: d.sentOn });
  }
  for (const c of S.clients) if (c.renewal && daysBetween(t, c.renewal) <= 30)
    items.push({ act: "client", id: c.id, ic: "globe", c: daysBetween(t, c.renewal) < 0 ? "bad" : "sky", title: `Renewal: ${c.business}`, sub: `${c.domain ? c.domain + " · " : ""}${daysBetween(t, c.renewal) < 0 ? "was due " : "due "}${niceDate(c.renewal)}`, sort: c.renewal });
  for (const j of S.jobs) if (j.status !== "live" && j.status !== "hold" && j.due && daysBetween(t, j.due) <= 3)
    items.push({ act: "job", id: j.id, ic: "job", c: j.due < t ? "bad" : "butter", title: `${j.title} due ${niceDate(j.due)}`, sub: clientName(j.clientId), sort: j.due });
  return items.sort((a, b) => (a.sort < b.sort ? -1 : 1));
}
function homeView() {
  const income = S.payments.filter(p => inPeriod(p.date, "month")).reduce((a, p) => a + num(p.amount), 0);
  const owed = S.docs.filter(d => d.type === "invoice" && ["sent", "part", "overdue"].includes(invStatus(d)));
  const owedSum = owed.reduce((a, d) => a + balance(d), 0);
  const overdue = owed.filter(d => invStatus(d) === "overdue").length;
  const open = S.leads.filter(l => OPEN_STAGES.includes(l.stage));
  const activeJobs = S.jobs.filter(j => j.status !== "live" && j.status !== "hold");
  const att = attentionItems();
  const upcoming = S.tasks.filter(k => !k.done && (!k.date || k.date > today())).sort((a, b) => (a.date || "9") < (b.date || "9") ? -1 : 1).slice(0, 6);
  const recent = COLLS.flatMap(c => S[c].map(r => ({ c, r }))).sort((a, b) => b.r.updatedAt - a.r.updatedAt).slice(0, 8);
  return `
    <div class="search">${icon("search")}<input id="q" placeholder="Search clients, leads, jobs, invoices…" value="${esc(UI.q)}" autocomplete="off"></div>
    <div id="qres">${searchResults()}</div>
    <div class="stats section" style="margin-top:14px">
      <button class="card stat" data-act="tab" data-id="money" style="text-align:left;cursor:pointer"><small>Paid this month</small><b>${moneyShort(income)}</b><em>${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}</em></button>
      <button class="card stat" data-act="goto-money" data-id="invoices" style="text-align:left;cursor:pointer"><small>Owed to you</small><b>${moneyShort(owedSum)}</b><em style="${overdue ? "color:var(--bad)" : ""}">${owed.length} unpaid${overdue ? ` · ${overdue} overdue` : ""}</em></button>
      <button class="card stat" data-act="tab" data-id="leads" style="text-align:left;cursor:pointer"><small>Open leads</small><b>${open.length}</b><em>${moneyShort(open.reduce((a, l) => a + num(l.value), 0))} possible</em></button>
      <button class="card stat" data-act="goto-jobs" style="text-align:left;cursor:pointer"><small>Jobs on the go</small><b>${activeJobs.length}</b><em>${S.jobs.filter(j => j.status === "live").length} sites live</em></button>
    </div>
    <div class="section">
      <div class="quick">
        ${[["new-lead", "leads", "Lead", "lilac"], ["new-client", "clients", "Client", "sage"], ["new-task", "bell", "Reminder", "accent"], ["new-quote", "doc", "Quote", "butter"], ["new-invoice", "doc", "Invoice", "sky"], ["new-payment", "cash", "Payment", "sage"]]
          .map(([a, ic, l, c]) => `<button data-act="${a}"><span class="p-${c}">${icon(ic)}</span>${l}</button>`).join("")}
      </div>
    </div>
    <div class="two section">
      <div>
        <div class="section-h"><h2>Needs attention</h2><span class="pill ${att.length ? "p-accent" : "p-sage"}">${att.length || "All clear"}</span></div>
        <div class="card list">${att.length ? att.map(i => `
          <button class="row" data-act="${i.act}" data-id="${i.id}"><span class="av p-${i.c}">${icon(i.ic, 'style="width:18px;height:18px"')}</span>
          <span class="grow"><span class="t" style="display:block">${esc(i.title)}</span><span class="s" style="display:block">${esc(i.sub)}</span></span></button>`).join("")
          : `<div class="empty">Nothing urgent. Maybe go find a new lead? 🙂</div>`}</div>
        <div class="section-h section"><h2>Coming up</h2><button class="btn sm ghost" data-act="tab" data-id="tasks">All reminders</button></div>
        <div class="card list">${upcoming.length ? upcoming.map(taskRow).join("") : `<div class="empty">No reminders coming up.</div>`}</div>
      </div>
      <div>
        <div class="section-h"><h2>Recent activity</h2></div>
        <div class="card list">${recent.length ? recent.map(({ c, r }) => activityRow(c, r)).join("") : `<div class="empty">Nothing here yet. Start by adding a lead or a client.</div>`}</div>
      </div>
    </div>`;
}
const COLL_LABEL = { clients: ["client", "client"], leads: ["lead", "lead"], jobs: ["job", "job"], tasks: ["reminder", "task"], docs: ["", "doc"], payments: ["payment", "payment"], expenses: ["expense", "expense"] };
function recTitle(c, r) {
  if (c === "clients" || c === "leads") return r.business;
  if (c === "jobs") return `${r.title} (${clientName(r.clientId)})`;
  if (c === "tasks") return r.title;
  if (c === "docs") return `${r.type === "quote" ? "quote" : "invoice"} ${r.number} · ${clientName(r.clientId)}`;
  if (c === "payments") return `${money(r.amount)} from ${r.clientId ? clientName(r.clientId) : "—"}`;
  if (c === "expenses") return `${r.desc} · ${money(r.amount)}`;
  return "";
}
function activityRow(c, r) {
  const created = Math.abs((r.createdAt || 0) - (r.updatedAt || 0)) < 1500;
  return `<button class="row" data-act="${COLL_LABEL[c][1]}" data-id="${r.id}">
    <span class="av" style="width:30px;height:30px;font-size:12px;border-radius:10px">${esc(initials(r.by))}</span>
    <span class="grow"><span class="s" style="display:block;color:var(--ink);white-space:normal">${esc(r.by || "Someone")} ${created ? "added" : "updated"} ${COLL_LABEL[c][0]} <b>${esc(recTitle(c, r))}</b></span>
    <span class="s" style="display:block">${timeAgo(r.updatedAt)}</span></span></button>`;
}
function searchResults() {
  const q = UI.q.trim().toLowerCase();
  if (q.length < 2) return "";
  const hit = (...v) => v.some(x => String(x || "").toLowerCase().includes(q));
  const res = [
    ...S.clients.filter(c => hit(c.business, c.contact, c.phone, c.email, c.domain)).map(c => ["client", c.id, c.business, "Client · " + (c.contact || c.phone || "")]),
    ...S.leads.filter(l => hit(l.business, l.contact, l.phone, l.area)).map(l => ["lead", l.id, l.business, "Lead · " + stageOf(l.stage).label]),
    ...S.jobs.filter(j => hit(j.title, clientName(j.clientId))).map(j => ["job", j.id, j.title, "Job · " + clientName(j.clientId)]),
    ...S.docs.filter(d => hit(d.number, clientName(d.clientId))).map(d => ["doc", d.id, d.number, (d.type === "quote" ? "Quote" : "Invoice") + " · " + clientName(d.clientId) + " · " + money(docTotal(d).total)]),
    ...S.tasks.filter(t => hit(t.title, t.notes)).map(t => ["task", t.id, t.title, "Reminder" + (t.date ? " · " + niceDate(t.date) : "")]),
  ].slice(0, 12);
  return `<div class="card list" style="margin-top:8px">${res.length ? res.map(([a, id, t, s]) => `<button class="row" data-act="${a}" data-id="${id}"><span class="grow"><span class="t" style="display:block">${esc(t)}</span><span class="s" style="display:block">${esc(s)}</span></span></button>`).join("") : `<div class="empty">Nothing found for “${esc(UI.q)}”.</div>`}</div>`;
}

/* ---------- Leads ---------- */
function leadsView() {
  const counts = Object.fromEntries(LEAD_STAGES.map(s => [s.k, S.leads.filter(l => l.stage === s.k).length]));
  const openCount = OPEN_STAGES.reduce((a, k) => a + counts[k], 0);
  const chips = `<div class="chips">
    <button class="chip ${UI.leadStage === "open" ? "on" : ""}" data-act="lead-stage" data-id="open">Open<i>${openCount}</i></button>
    ${LEAD_STAGES.map(s => `<button class="chip ${UI.leadStage === s.k ? "on" : ""}" data-act="lead-stage" data-id="${s.k}">${s.label}<i>${counts[s.k]}</i></button>`).join("")}
  </div>`;
  if (!S.leads.length) return chips + `<div class="card empty" style="padding:40px 20px"><p style="font-size:16px;color:var(--ink);font-weight:600;margin:0 0 6px">No leads yet</p>Every business you spot with no website (or a bad one) goes here. Add it, then move it along as you talk to them.<br><br><button class="btn primary" data-act="new-lead">${icon("plus")}Add your first lead</button></div>`;
  if (UI.leadStage === "open" && wide()) {
    return chips + `<div class="board">${OPEN_STAGES.map(k => {
      const s = stageOf(k), ls = S.leads.filter(l => l.stage === k).sort(byFollowUp);
      return `<div class="col"><h3><span class="dot" style="background:var(--${s.c})"></span>${s.label}<i>${ls.length}</i></h3>
        ${ls.map(l => `<button class="mini" data-act="lead" data-id="${l.id}"><b>${esc(l.business)}</b><span>${esc([l.area, l.siteStatus].filter(Boolean).join(" · "))}</span>
          ${l.followUp || num(l.value) ? `<span style="display:flex;justify-content:space-between;margin-top:6px">${l.followUp ? `<span class="pill ${l.followUp <= today() ? "p-accent" : ""}">${icon("bell", 'style="width:12px;height:12px"')}${niceDate(l.followUp)}</span>` : "<span></span>"}${num(l.value) ? `<b style="font-size:12.5px">${moneyShort(l.value)}</b>` : ""}</span>` : ""}</button>`).join("") || `<div class="small muted" style="padding:8px">Empty</div>`}
      </div>`;
    }).join("")}</div>`;
  }
  const ls = S.leads.filter(l => UI.leadStage === "open" ? OPEN_STAGES.includes(l.stage) : l.stage === UI.leadStage).sort(byFollowUp);
  return chips + `<div class="card list">${ls.length ? ls.map(leadRow).join("") : `<div class="empty">No leads here.</div>`}</div>`;
}
const byFollowUp = (a, b) => (a.followUp || "9999") < (b.followUp || "9999") ? -1 : (a.followUp || "9999") > (b.followUp || "9999") ? 1 : b.updatedAt - a.updatedAt;
function leadRow(l) {
  const s = stageOf(l.stage);
  return `<button class="row" data-act="lead" data-id="${l.id}"><span class="av p-${s.c || "x"}">${esc(initials(l.business))}</span>
    <span class="grow"><span class="t" style="display:block">${esc(l.business)}</span>
    <span class="s" style="display:block">${esc([l.area, l.siteStatus].filter(Boolean).join(" · ") || l.contact || "")}${l.followUp && OPEN_STAGES.includes(l.stage) ? ` · <span style="color:${l.followUp <= today() ? "var(--accent)" : "inherit"}">follow up ${niceDate(l.followUp)}</span>` : ""}</span></span>
    <span class="amt"><span class="pill p-${s.c}">${s.label}</span>${num(l.value) ? `<small>${moneyShort(l.value)}</small>` : ""}</span></button>`;
}

/* ---------- Clients & jobs ---------- */
function clientsView() {
  const seg = `<div class="chips"><button class="chip ${UI.clientSeg === "clients" ? "on" : ""}" data-act="client-seg" data-id="clients">Clients<i>${S.clients.length}</i></button>
    <button class="chip ${UI.clientSeg === "jobs" ? "on" : ""}" data-act="client-seg" data-id="jobs">Jobs<i>${S.jobs.filter(j => j.status !== "live").length}</i></button></div>`;
  if (UI.clientSeg === "jobs") {
    if (!S.jobs.length) return seg + `<div class="card empty" style="padding:40px 20px">A job is a website you're building for a client. Track where it's at and tick off the steps.<br><br><button class="btn primary" data-act="new-job">${icon("plus")}Add a job</button></div>`;
    return seg + JOB_STATUS.map(st => {
      const js = S.jobs.filter(j => (j.status || "todo") === st.k).sort((a, b) => (a.due || "9") < (b.due || "9") ? -1 : 1);
      if (!js.length) return "";
      return `<div class="section-h" style="margin-top:14px"><h2 style="font-size:16px;font-family:var(--body);font-weight:700"><span class="dot" style="display:inline-block;margin-right:8px;background:var(--${st.c || "muted"})"></span>${st.label}</h2><span class="muted small">${js.length}</span></div>
        <div class="card list">${js.map(jobRow).join("")}</div>`;
    }).join("");
  }
  if (!S.clients.length) return seg + `<div class="card empty" style="padding:40px 20px"><p style="font-size:16px;color:var(--ink);font-weight:600;margin:0 0 6px">No clients yet</p>When a lead says yes, tap “Make them a client” on the lead — or add a client straight away.<br><br><button class="btn primary" data-act="new-client">${icon("plus")}Add a client</button></div>`;
  const cs = [...S.clients].sort((a, b) => a.business.localeCompare(b.business));
  return seg + `<div class="card list">${cs.map(c => {
    const owed = S.docs.filter(d => d.clientId === c.id && d.type === "invoice" && ["sent", "part", "overdue"].includes(invStatus(d))).reduce((a, d) => a + balance(d), 0);
    const jobs = S.jobs.filter(j => j.clientId === c.id);
    return `<button class="row" data-act="client" data-id="${c.id}"><span class="av p-sage">${esc(initials(c.business))}</span>
      <span class="grow"><span class="t" style="display:block">${esc(c.business)}</span><span class="s" style="display:block">${esc([c.contact, c.phone].filter(Boolean).join(" · ") || c.email || "")}</span></span>
      <span class="amt">${owed > 0 ? `<span class="pill p-butter">${moneyShort(owed)} owed</span>` : num(c.monthly) ? `<span class="pill p-sage">${moneyShort(c.monthly)}/m</span>` : ""}<small>${jobs.length} job${jobs.length === 1 ? "" : "s"}</small></span></button>`;
  }).join("")}</div>`;
}
function jobRow(j) {
  const st = jobStatusOf(j.status), ck = j.checklist || [], done = ck.filter(x => x.done).length;
  return `<button class="row" data-act="job" data-id="${j.id}"><span class="av p-${st.c || "x"}">${icon("job", 'style="width:18px;height:18px"')}</span>
    <span class="grow"><span class="t" style="display:block">${esc(j.title)}</span><span class="s" style="display:block">${esc(clientName(j.clientId))}${j.due ? ` · due ${niceDate(j.due)}` : ""}</span>
    ${ck.length ? `<span class="progress" style="display:block;margin-top:6px;max-width:220px"><i style="width:${Math.round(done / ck.length * 100)}%"></i></span>` : ""}</span>
    <span class="amt"><span class="pill p-${st.c}">${st.label}</span>${num(j.price) ? `<small>${moneyShort(j.price)}</small>` : ""}</span></button>`;
}

/* ---------- Money ---------- */
function moneyView() {
  const P = UI.period;
  const inc = S.payments.filter(p => inPeriod(p.date, P)).reduce((a, p) => a + num(p.amount), 0);
  const exp = S.expenses.filter(e => inPeriod(e.date, P)).reduce((a, e) => a + num(e.amount), 0);
  const owed = S.docs.filter(d => d.type === "invoice" && ["sent", "part", "overdue"].includes(invStatus(d))).reduce((a, d) => a + balance(d), 0);
  const monthly = S.clients.reduce((a, c) => a + num(c.monthly), 0);
  const periodName = { month: "this month", last: "last month", year: "this year", all: "all time" }[P];
  let list = "";
  const seg = UI.moneySeg;
  if (seg === "invoices" || seg === "quotes") {
    const type = seg === "quotes" ? "quote" : "invoice";
    const ds = S.docs.filter(d => d.type === type).sort((a, b) => (b.date || "") < (a.date || "") ? -1 : (b.date || "") > (a.date || "") ? 1 : b.createdAt - a.createdAt);
    list = ds.length ? ds.map(docRow).join("") : `<div class="empty">No ${seg} yet.<br><br><button class="btn primary sm" data-act="new-${type}">${icon("plus")}New ${type}</button></div>`;
  } else if (seg === "payments") {
    const ps = S.payments.filter(p => inPeriod(p.date, P)).sort((a, b) => (b.date < a.date ? -1 : 1));
    list = ps.length ? ps.map(payRow).join("") : `<div class="empty">No payments ${periodName}.</div>`;
  } else {
    const es = S.expenses.filter(e => inPeriod(e.date, P)).sort((a, b) => (b.date < a.date ? -1 : 1));
    list = es.length ? es.map(expRow).join("") : `<div class="empty">No expenses ${periodName}.</div>`;
  }
  return `
    <div class="chips">${[["month", "This month"], ["last", "Last month"], ["year", "This year"], ["all", "All time"]].map(([k, l]) => `<button class="chip ${P === k ? "on" : ""}" data-act="period" data-id="${k}">${l}</button>`).join("")}</div>
    <div class="stats">
      <div class="card stat"><small>Money in</small><b style="color:var(--sage)">${moneyShort(inc)}</b><em>${periodName}</em></div>
      <div class="card stat"><small>Money out</small><b>${moneyShort(exp)}</b><em>${periodName}</em></div>
      <div class="card stat"><small>Profit</small><b style="color:${inc - exp < 0 ? "var(--bad)" : "var(--ink)"}">${moneyShort(inc - exp)}</b><em>${periodName}</em></div>
      <div class="card stat"><small>Still owed</small><b>${moneyShort(owed)}</b><em>${monthly ? moneyShort(monthly) + "/m from upkeep" : "unpaid invoices"}</em></div>
    </div>
    <div class="card pad section" style="margin-top:12px">
      <div class="section-h" style="margin:0 0 4px"><h2 style="font-size:16px">Last 6 months</h2></div>
      ${chartSVG()}
      <div class="legend"><span><i style="background:var(--sage)"></i>Money in</span><span><i style="background:var(--accent)"></i>Money out</span></div>
    </div>
    <div class="chips section" style="margin-top:18px">${[["invoices", "Invoices"], ["quotes", "Quotes"], ["payments", "Payments"], ["expenses", "Expenses"]].map(([k, l]) => `<button class="chip ${seg === k ? "on" : ""}" data-act="money-seg" data-id="${k}">${l}</button>`).join("")}</div>
    <div class="card list">${list}</div>`;
}
function chartSVG() {
  const now = new Date(), months = [];
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push([d.getFullYear(), d.getMonth()]); }
  const sum = (arr, y, m) => arr.filter(r => { if (!r.date) return false; const [ry, rm] = r.date.split("-").map(Number); return ry === y && rm - 1 === m; }).reduce((a, r) => a + num(r.amount), 0);
  const data = months.map(([y, m]) => ({ l: MONTHS[m], i: sum(S.payments, y, m), o: sum(S.expenses, y, m) }));
  const max = Math.max(1, ...data.flatMap(d => [d.i, d.o]));
  const W = 600, H = 180, base = 150, top = 18, cw = W / 6, bw = Math.min(26, cw / 3.2);
  const bars = data.map((d, k) => {
    const x = k * cw + cw / 2, hi = (d.i / max) * (base - top), ho = (d.o / max) * (base - top);
    return `<rect x="${x - bw - 2}" y="${base - hi}" width="${bw}" height="${Math.max(hi, d.i ? 2 : 0)}" rx="4" fill="var(--sage)"><title>${d.l}: in ${money(d.i)}</title></rect>
      <rect x="${x + 2}" y="${base - ho}" width="${bw}" height="${Math.max(ho, d.o ? 2 : 0)}" rx="4" fill="var(--accent)" opacity=".85"><title>${d.l}: out ${money(d.o)}</title></rect>
      ${d.i ? `<text x="${x - bw / 2 - 2}" y="${base - hi - 5}" text-anchor="middle" font-size="11" fill="var(--muted)">${d.i >= 1000 ? (d.i / 1000).toFixed(d.i >= 10000 ? 0 : 1) + "k" : Math.round(d.i)}</text>` : ""}
      <text x="${x}" y="${base + 20}" text-anchor="middle" font-size="12" fill="var(--muted)" font-weight="600">${d.l}</text>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="var(--line)"/>${bars}</svg>`;
}
function docRow(d) {
  const t = docTotal(d).total, st = invStatus(d);
  return `<button class="row" data-act="doc" data-id="${d.id}"><span class="av ${d.type === "quote" ? "p-butter" : "p-sky"}">${icon("doc", 'style="width:18px;height:18px"')}</span>
    <span class="grow"><span class="t" style="display:block">${esc(clientName(d.clientId))}</span><span class="s" style="display:block">${esc(d.number)} · ${niceDate(d.date)}${d.type === "invoice" && d.dueDate && !["paid", "draft"].includes(st) ? ` · due ${niceDate(d.dueDate)}` : ""}</span></span>
    <span class="amt">${money(t)}<small>${statusPill(d)}</small></span></button>`;
}
function payRow(p) {
  const d = p.docId && get("docs", p.docId);
  return `<button class="row" data-act="payment" data-id="${p.id}"><span class="av p-sage">${icon("cash", 'style="width:18px;height:18px"')}</span>
    <span class="grow"><span class="t" style="display:block">${esc(p.clientId ? clientName(p.clientId) : p.note || "Payment")}</span><span class="s" style="display:block">${niceDate(p.date)} · ${esc(p.method || "")}${d ? " · " + esc(d.number) : ""}</span></span>
    <span class="amt" style="color:var(--sage)">+${money(p.amount)}</span></button>`;
}
function expRow(e) {
  return `<button class="row" data-act="expense" data-id="${e.id}"><span class="av p-accent">${icon("out", 'style="width:18px;height:18px"')}</span>
    <span class="grow"><span class="t" style="display:block">${esc(e.desc)}</span><span class="s" style="display:block">${niceDate(e.date)} · ${esc(e.cat || "")}${e.by ? " · " + esc(e.by) : ""}</span></span>
    <span class="amt">−${money(e.amount)}</span></button>`;
}

/* ---------- Reminders ---------- */
function tasksView() {
  const f = UI.taskFilter, t = today();
  const mine = k => !k.who || k.who === "Both" || k.who === ME();
  let ts = S.tasks.filter(k => f === "done" ? k.done : !k.done).filter(k => f === "mine" ? mine(k) : true);
  const chips = `<div class="chips">${[["all", "Everyone"], ["mine", "Mine"], ["done", "Done"]].map(([k, l]) => `<button class="chip ${f === k ? "on" : ""}" data-act="task-filter" data-id="${k}">${l}</button>`).join("")}</div>`;
  if (!S.tasks.length) return chips + `<div class="card empty" style="padding:40px 20px">Reminders for follow-ups, calls, renewals — anything you don't want to forget. You can add each one to your phone's calendar too.<br><br><button class="btn primary" data-act="new-task">${icon("plus")}Add a reminder</button></div>`;
  if (f === "done") { ts.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)); return chips + `<div class="card list">${ts.slice(0, 60).map(taskRow).join("") || `<div class="empty">Nothing done yet.</div>`}</div>`; }
  const sortT = (a, b) => ((a.date || "9") + (a.time || "")) < ((b.date || "9") + (b.time || "")) ? -1 : 1;
  const groups = [
    ["Overdue", ts.filter(k => k.date && k.date < t)],
    ["Today", ts.filter(k => k.date === t)],
    ["Tomorrow", ts.filter(k => k.date === addDays(t, 1))],
    ["Later", ts.filter(k => k.date && k.date > addDays(t, 1))],
    ["Some time", ts.filter(k => !k.date)],
  ];
  const body = groups.filter(g => g[1].length).map(([l, arr]) => `<div class="section-h" style="margin-top:14px"><h2 style="font-size:16px;font-family:var(--body);font-weight:700;${l === "Overdue" ? "color:var(--bad)" : ""}">${l}</h2><span class="muted small">${arr.length}</span></div>
    <div class="card list">${arr.sort(sortT).map(taskRow).join("")}</div>`).join("");
  return chips + (body || `<div class="card empty">All done. Nice work.</div>`);
}
function taskRow(k) {
  const link = k.linkId && (get("clients", k.linkId) || get("leads", k.linkId));
  const late = !k.done && k.date && k.date < today();
  return `<div class="row" data-act="task" data-id="${k.id}">
    <input type="checkbox" ${k.done ? "checked" : ""} data-act="toggle-task" data-id="${k.id}" style="width:22px;height:22px;accent-color:var(--sage);flex:none;cursor:pointer" aria-label="Done">
    <span class="grow"><span class="t" style="display:block;${k.done ? "text-decoration:line-through;color:var(--muted)" : ""}">${esc(k.title)}</span>
    <span class="s" style="display:block">${[k.date ? `<span style="${late ? "color:var(--bad)" : ""}">${niceDate(k.date)}${k.time ? " " + k.time : ""}</span>` : "", link ? esc(link.business) : "", k.who && k.who !== "Both" ? esc(k.who) : ""].filter(Boolean).join(" · ") || "No date"}</span></span></div>`;
}
