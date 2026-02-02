// app.js — Budget Universel (PWA) — version repo partageable
// Schéma: fixed[] + envelopes[] (plafond) + cumulatives[] (cumul)
// Stockage par mois YYYY-MM

const STORAGE_KEY = "budgetuniversal:pwa:v1";

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function euroToCents(input) {
  const cleaned = (input || "").replace(",", ".").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function centsToEuro(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function fmtDate(ts) {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

/**
 * Schéma du mois:
 * {
 *  incomeCents: number,
 *  fixed: [{id, group, name, amountCents, paid}],
 *  envelopes: [{id, name, limitCents, spentCents, entries:[{id, ts, amountCents}]}],
 *  cumulatives: [{id, name, spentCents, entries:[{id, ts, amountCents}]}]
 * }
 */
function defaultMonthData() {
  return {
    incomeCents: 0, // universel: vide par défaut
    fixed: [],
    envelopes: [],
    cumulatives: [],
  };
}

let currentMonth = monthKey();
let state = defaultMonthData();

const els = {
  monthLabel: document.getElementById("monthLabel"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  resetMonthBtn: document.getElementById("resetMonthBtn"),

  incomeInput: document.getElementById("incomeInput"),

  kFixedTotal: document.getElementById("kFixedTotal"),
  kFixedPaid: document.getElementById("kFixedPaid"),
  kFixedRemaining: document.getElementById("kFixedRemaining"),
  kNetLeft: document.getElementById("kNetLeft"),
  kCurrentLeft: document.getElementById("kCurrentLeft"),

  fixedBadge: document.getElementById("fixedBadge"),
  fixedList: document.getElementById("fixedList"),

  // nouvelles zones dynamiques (index.html sera adapté)
  fixedAddBtn: document.getElementById("fixedAddBtn"),
  addEnvelopeBtn: document.getElementById("addEnvelopeBtn"),
  addCumulativeBtn: document.getElementById("addCumulativeBtn"),

  envelopesContainer: document.getElementById("envelopesContainer"),
  cumulativesContainer: document.getElementById("cumulativesContainer"),
};

function ensureStateShape() {
  if (!state || typeof state !== "object") state = defaultMonthData();

  if (!("incomeCents" in state)) state.incomeCents = 0;
  if (!Array.isArray(state.fixed)) state.fixed = [];
  if (!Array.isArray(state.envelopes)) state.envelopes = [];
  if (!Array.isArray(state.cumulatives)) state.cumulatives = [];

  // normalisation légère
  state.fixed = state.fixed.map((f) => ({
    id: f.id || uid(),
    group: typeof f.group === "string" ? f.group : "",
    name: typeof f.name === "string" ? f.name : "Charge",
    amountCents: Number.isFinite(f.amountCents) ? f.amountCents : 0,
    paid: !!f.paid,
  }));

  state.envelopes = state.envelopes.map((e) => ({
    id: e.id || uid(),
    name: typeof e.name === "string" ? e.name : "Budget",
    limitCents: Number.isFinite(e.limitCents) ? e.limitCents : 0,
    spentCents: Number.isFinite(e.spentCents) ? e.spentCents : 0,
    entries: Array.isArray(e.entries) ? e.entries : [],
  }));

  state.cumulatives = state.cumulatives.map((c) => ({
    id: c.id || uid(),
    name: typeof c.name === "string" ? c.name : "Module",
    spentCents: Number.isFinite(c.spentCents) ? c.spentCents : 0,
    entries: Array.isArray(c.entries) ? c.entries : [],
  }));
}

function loadMonth() {
  const all = loadAll();
  state = all[currentMonth] ?? defaultMonthData();
  ensureStateShape();
  render();
}

function persist() {
  const all = loadAll();
  all[currentMonth] = state;
  saveAll(all);
}

function sumEntries(entries) {
  return entries.reduce((s, e) => s + (Number.isFinite(e.amountCents) ? e.amountCents : 0), 0);
}

function recomputeEnvelopeSpent(env) {
  env.spentCents = sumEntries(env.entries);
}

function recomputeCumulativeSpent(obj) {
  obj.spentCents = sumEntries(obj.entries);
}

function calc() {
  const income = state.incomeCents;

  const fixedTotalOnly = state.fixed.reduce((s, e) => s + e.amountCents, 0);
  const fixedPaidOnly = state.fixed.reduce((s, e) => s + (e.paid ? e.amountCents : 0), 0);
  const unpaidFixed = fixedTotalOnly - fixedPaidOnly;

  const budgetsTotal = state.envelopes.reduce((s, e) => s + e.limitCents, 0);
  const budgetsSpent = state.envelopes.reduce((s, e) => s + e.spentCents, 0);
  const budgetsRemaining = state.envelopes.reduce((s, e) => s + (e.limitCents - e.spentCents), 0);

  const cumulativesSpent = state.cumulatives.reduce((s, c) => s + c.spentCents, 0);

  const fixedTotal = fixedTotalOnly + budgetsTotal;
  const fixedPaid = fixedPaidOnly + budgetsSpent;
  const fixedRemaining = unpaidFixed + budgetsRemaining;

  const netLeft = income - fixedTotal - cumulativesSpent;

  const currentLeft =
    income -
    fixedPaidOnly -
    budgetsSpent -
    cumulativesSpent;

  return { fixedTotal, fixedPaid, fixedRemaining, netLeft, currentLeft };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(text, className) {
  const b = document.createElement("button");
  if (className) b.className = className;
  b.textContent = text;
  return b;
}

function render() {
  if (els.monthLabel) els.monthLabel.textContent = currentMonth;
  if (els.incomeInput) els.incomeInput.value = centsToEuro(state.incomeCents);

  const c = calc();
  if (els.kFixedTotal) els.kFixedTotal.textContent = `${centsToEuro(c.fixedTotal)} €`;
  if (els.kFixedPaid) els.kFixedPaid.textContent = `${centsToEuro(c.fixedPaid)} €`;
  if (els.kFixedRemaining) els.kFixedRemaining.textContent = `${centsToEuro(c.fixedRemaining)} €`;
  if (els.kNetLeft) els.kNetLeft.textContent = `${centsToEuro(c.netLeft)} €`;

  const currentEl = els.kCurrentLeft || document.getElementById("kCurrentLeft");
  if (currentEl) currentEl.textContent = `${centsToEuro(c.currentLeft)} €`;

  // ===== Fixes =====
  if (els.fixedBadge) {
    const paidCount = state.fixed.filter((e) => e.paid).length;
    els.fixedBadge.textContent = `${paidCount} / ${state.fixed.length} payées`;
  }

  if (els.fixedList) {
    els.fixedList.innerHTML = "";

    const byGroup = new Map();
    for (const f of state.fixed) {
      const g = (f.group || "").trim() || "Autres";
      if (!byGroup.has(g)) byGroup.set(g, []);
      byGroup.get(g).push(f);
    }

    const groups = Array.from(byGroup.keys()).sort((a, b) => a.localeCompare(b, "fr"));

    if (groups.length === 0) {
      const empty = el("div", "emptyHint", "Aucune charge fixe. Ajoute-en une avec “+ Ajouter”.");
      els.fixedList.appendChild(empty);
    } else {
      for (const g of groups) {
        const title = el("div", "groupTitle", g);
        els.fixedList.appendChild(title);

        for (const f of byGroup.get(g)) {
          const row = el("div", "item");

          const left = el("div", null);
          left.style.flex = "1";

          const name = el("div", "name", f.name);
          const amt = el("div", "amt", `${centsToEuro(f.amountCents)} €`);
          left.appendChild(name);
          left.appendChild(amt);

          const actions = el("div", "actions");

          const toggle = el("div", "toggle" + (f.paid ? " on" : ""));
          const knob = el("div", "knob");
          toggle.appendChild(knob);
          toggle.addEventListener("click", () => {
            f.paid = !f.paid;
            persist();
            render();
          });

          const del = button("✕", "miniDanger");
          del.setAttribute("aria-label", "Supprimer");
          del.addEventListener("click", () => {
            if (!confirm(`Supprimer la charge “${f.name}” ?`)) return;
            state.fixed = state.fixed.filter((x) => x.id !== f.id);
            persist();
            render();
          });

          actions.appendChild(toggle);
          actions.appendChild(del);

          row.appendChild(left);
          row.appendChild(actions);
          els.fixedList.appendChild(row);
        }
      }
    }
  }

  // ===== Envelopes =====
  if (els.envelopesContainer) {
    els.envelopesContainer.innerHTML = "";

    if (state.envelopes.length === 0) {
      els.envelopesContainer.appendChild(
        el("div", "emptyHint", "Aucune enveloppe. Ajoute un budget mensuel (Courses, Sorties, etc.).")
      );
    } else {
      for (const env of state.envelopes) {
        els.envelopesContainer.appendChild(renderEnvelopeCard(env));
      }
    }
  }

  // ===== Cumulatives =====
  if (els.cumulativesContainer) {
    els.cumulativesContainer.innerHTML = "";

    if (state.cumulatives.length === 0) {
      els.cumulativesContainer.appendChild(
        el("div", "emptyHint", "Aucun module cumulatif. Ajoute un module (Essence, Parking, etc.).")
      );
    } else {
      for (const mod of state.cumulatives) {
        els.cumulativesContainer.appendChild(renderCumulativeCard(mod));
      }
    }
  }
}

/**
 * Render entries + suppression
 */
function renderEntries(container, entries, onDelete) {
  container.innerHTML = "";
  const list = [...entries].slice(-8).reverse();
  if (list.length === 0) return;

  for (const it of list) {
    const row = el("div", "entry");

    const left = el("div", "entryLeft");

    const main = el("div", "entryMain", "Dépense");
    const sub = el("div", "entrySub", fmtDate(it.ts));

    left.appendChild(main);
    left.appendChild(sub);

    const rightWrap = el("div", null);
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.gap = "10px";

    const right = el("div", "entryAmt", `-${centsToEuro(it.amountCents)} €`);

    const del = button("✕", "miniDanger");
    del.setAttribute("aria-label", "Supprimer");
    del.addEventListener("click", () => onDelete(it.id));

    rightWrap.appendChild(right);
    rightWrap.appendChild(del);

    row.appendChild(left);
    row.appendChild(rightWrap);
    container.appendChild(row);
  }
}

function addFixed() {
  const name = prompt("Nom de la charge fixe ? (ex: Loyer, Téléphone)");
  if (!name) return;

  const group = prompt("Groupe / catégorie ? (optionnel, ex: Logement, Perso)") || "";
  const amountStr = prompt("Montant mensuel ? (ex: 650,00)");
  const amountCents = euroToCents(amountStr);

  if (!amountCents || amountCents <= 0) {
    alert("Montant invalide (ex: 650,00).");
    return;
  }

  state.fixed.push({
    id: uid(),
    group: group.trim(),
    name: name.trim(),
    amountCents,
    paid: false,
  });

  persist();
  render();
}

function addEnvelope() {
  const name = prompt("Nom de l’enveloppe ? (ex: Courses, Sorties, Animaux)");
  if (!name) return;

  const limitStr = prompt("Budget mensuel (plafond) ? (ex: 200,00)");
  const limitCents = euroToCents(limitStr);

  if (limitCents < 0 || !Number.isFinite(limitCents)) {
    alert("Montant invalide (ex: 200,00).");
    return;
  }

  state.envelopes.push({
    id: uid(),
    name: name.trim(),
    limitCents,
    spentCents: 0,
    entries: [],
  });

  persist();
  render();
}

function addCumulative() {
  const name = prompt("Nom du module cumulatif ? (ex: Essence, Parking, Cafés)");
  if (!name) return;

  state.cumulatives.push({
    id: uid(),
    name: name.trim(),
    spentCents: 0,
    entries: [],
  });

  persist();
  render();
}

function addEnvelopeSpend(envId, amountStr) {
  const amountCents = euroToCents(amountStr);
  if (!amountCents || amountCents <= 0) {
    alert("Montant invalide (ex: 4,50).");
    return false;
  }

  const env = state.envelopes.find((e) => e.id === envId);
  if (!env) return false;

  env.entries.push({ id: uid(), ts: Date.now(), amountCents });
  recomputeEnvelopeSpent(env);

  persist();
  render();
  return true;
}

function addCumulativeSpend(modId, amountStr) {
  const amountCents = euroToCents(amountStr);
  if (!amountCents || amountCents <= 0) {
    alert("Montant invalide (ex: 10,00).");
    return false;
  }

  const mod = state.cumulatives.find((m) => m.id === modId);
  if (!mod) return false;

  mod.entries.push({ id: uid(), ts: Date.now(), amountCents });
  recomputeCumulativeSpent(mod);

  persist();
  render();
  return true;
}

function deleteEnvelopeEntry(envId, entryId) {
  const env = state.envelopes.find((e) => e.id === envId);
  if (!env) return;
  env.entries = env.entries.filter((e) => e.id !== entryId);
  recomputeEnvelopeSpent(env);
  persist();
  render();
}

function deleteCumulativeEntry(modId, entryId) {
  const mod = state.cumulatives.find((m) => m.id === modId);
  if (!mod) return;
  mod.entries = mod.entries.filter((e) => e.id !== entryId);
  recomputeCumulativeSpent(mod);
  persist();
  render();
}

function renderEnvelopeCard(env) {
  const card = el("div", "card");

  // header
  const head = el("div", "cardHead");

  const title = el("div", "cardTitle", env.name);
  title.style.cursor = "pointer";
  title.title = "Cliquer pour renommer";
  title.addEventListener("click", () => {
    const n = prompt("Nouveau nom :", env.name);
    if (!n) return;
    env.name = n.trim() || env.name;
    persist();
    render();
  });

  const del = button("Suppr.", "miniDanger");
  del.addEventListener("click", () => {
    if (!confirm(`Supprimer l’enveloppe “${env.name}” ?`)) return;
    state.envelopes = state.envelopes.filter((e) => e.id !== env.id);
    persist();
    render();
  });

  head.appendChild(title);
  head.appendChild(del);

  // stats line
  const stats = el("div", "budgetLine");

  const left = el("div", "budgetLeft", `Restant : ${centsToEuro(env.limitCents - env.spentCents)} €`);
  const mid = el("div", "budgetMid", `Budget : ${centsToEuro(env.limitCents)} €`);
  const right = el("div", "budgetRight", `Dépensé : ${centsToEuro(env.spentCents)} €`);

  stats.appendChild(left);
  stats.appendChild(mid);
  stats.appendChild(right);

  // limit editor
  const limitRow = el("div", "inputRow");
  const limitInput = document.createElement("input");
  limitInput.type = "text";
  limitInput.inputMode = "decimal";
  limitInput.placeholder = "Budget mensuel (ex: 200,00)";
  limitInput.value = centsToEuro(env.limitCents);

  const limitSave = button("OK", "mini");
  limitSave.addEventListener("click", () => {
    const v = euroToCents(limitInput.value);
    if (!Number.isFinite(v) || v < 0) return alert("Montant invalide.");
    env.limitCents = v;
    persist();
    render();
  });

  limitRow.appendChild(limitInput);
  limitRow.appendChild(limitSave);

  // add spend row
  const addRow = el("div", "inputRow");
  const amount = document.createElement("input");
  amount.type = "text";
  amount.inputMode = "decimal";
  amount.placeholder = "Dépense (ex: 4,50)";

  const addBtn = button("+", "miniPrimary");
  addBtn.addEventListener("click", () => {
    if (addEnvelopeSpend(env.id, amount.value)) amount.value = "";
  });

  addRow.appendChild(amount);
  addRow.appendChild(addBtn);

  // entries
  const entriesWrap = el("div", "entries");
  renderEntries(entriesWrap, env.entries, (entryId) => deleteEnvelopeEntry(env.id, entryId));

  card.appendChild(head);
  card.appendChild(stats);
  card.appendChild(limitRow);
  card.appendChild(addRow);
  card.appendChild(entriesWrap);

  return card;
}

function renderCumulativeCard(mod) {
  const card = el("div", "card");

  const head = el("div", "cardHead");

  const title = el("div", "cardTitle", mod.name);
  title.style.cursor = "pointer";
  title.title = "Cliquer pour renommer";
  title.addEventListener("click", () => {
    const n = prompt("Nouveau nom :", mod.name);
    if (!n) return;
    mod.name = n.trim() || mod.name;
    persist();
    render();
  });

  const del = button("Suppr.", "miniDanger");
  del.addEventListener("click", () => {
    if (!confirm(`Supprimer “${mod.name}” ?`)) return;
    state.cumulatives = state.cumulatives.filter((m) => m.id !== mod.id);
    persist();
    render();
  });

  head.appendChild(title);
  head.appendChild(del);

  const total = el("div", "totalLine", `Total : ${centsToEuro(mod.spentCents)} €`);

  const addRow = el("div", "inputRow");
  const amount = document.createElement("input");
  amount.type = "text";
  amount.inputMode = "decimal";
  amount.placeholder = "Montant (ex: 10,00)";

  const addBtn = button("+", "miniPrimary");
  addBtn.addEventListener("click", () => {
    if (addCumulativeSpend(mod.id, amount.value)) amount.value = "";
  });

  addRow.appendChild(amount);
  addRow.appendChild(addBtn);

  const entriesWrap = el("div", "entries");
  renderEntries(entriesWrap, mod.entries, (entryId) => deleteCumulativeEntry(mod.id, entryId));

  card.appendChild(head);
  card.appendChild(total);
  card.appendChild(addRow);
  card.appendChild(entriesWrap);

  return card;
}

function goMonth(delta) {
  const [y, m] = currentMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  currentMonth = monthKey(d);
  loadMonth();
}

// ===== Events (safe) =====
if (els.prevMonth) els.prevMonth.addEventListener("click", () => goMonth(-1));
if (els.nextMonth) els.nextMonth.addEventListener("click", () => goMonth(+1));

if (els.incomeInput) {
  els.incomeInput.addEventListener("change", () => {
    state.incomeCents = euroToCents(els.incomeInput.value);
    persist();
    render();
  });
}

if (els.fixedAddBtn) els.fixedAddBtn.addEventListener("click", addFixed);
if (els.addEnvelopeBtn) els.addEnvelopeBtn.addEventListener("click", addEnvelope);
if (els.addCumulativeBtn) els.addCumulativeBtn.addEventListener("click", addCumulative);

if (els.resetMonthBtn) {
  els.resetMonthBtn.addEventListener("click", () => {
    if (!confirm("Reset du mois : décocher fixes + remettre enveloppes & cumulatifs à zéro (sans supprimer les modules) ?")) return;

    // Fixes: on décoche
    state.fixed = state.fixed.map((e) => ({ ...e, paid: false }));

    // Enveloppes: on garde le plafond et le nom, mais on vide les dépenses
    for (const env of state.envelopes) {
      env.entries = [];
      env.spentCents = 0;
    }

    // Cumulatifs: idem
    for (const mod of state.cumulatives) {
      mod.entries = [];
      mod.spentCents = 0;
    }

    persist();
    render();
  });
}

// Offline (service worker)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

loadMonth();
