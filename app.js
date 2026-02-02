const STORAGE_KEY = "budgetcheck:pwa:v6";

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

function defaultMonthData() {
  return {
    incomeCents: 200000, // modifiable
    fixed: [
      { id: uid(), group: "Appart", name: "Loyer", amountCents: 65000, paid: false },
      { id: uid(), group: "Appart", name: "Assurance habitation", amountCents: 1979, paid: false },
      { id: uid(), group: "Appart", name: "Électricité", amountCents: 10700, paid: false },
      { id: uid(), group: "Appart", name: "Eau", amountCents: 1800, paid: false },

      { id: uid(), group: "Perso", name: "Téléphone + ChatGPT + Crunchyroll", amountCents: 4597, paid: false },
      { id: uid(), group: "Perso", name: "Assurance voiture", amountCents: 6845, paid: false },
      { id: uid(), group: "Perso", name: "Coiffeur", amountCents: 2000, paid: false },
      { id: uid(), group: "Perso", name: "Spotify + YouTube", amountCents: 1095, paid: false },
      { id: uid(), group: "Perso", name: "Netflix", amountCents: 1499, paid: false },
      { id: uid(), group: "Perso", name: "Crédit voiture", amountCents: 30043, paid: false },
      { id: uid(), group: "Perso", name: "Économie", amountCents: 15000, paid: false },
      { id: uid(), group: "Perso", name: "Internet", amountCents: 2499, paid: false },
    ],
    envelopes: {
      courses: { limitCents: 20000, spentCents: 0, entries: [] },
      plaisir: { limitCents: 20000, spentCents: 0, entries: [] },
    },
    izly: { spentCents: 0, entries: [] },
    fuel: { spentCents: 0, entries: [] },
    other: { spentCents: 0, entries: [] }, // ✅ Autres
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
  kCurrentLeft: document.getElementById("kCurrentLeft"), // ✅ NOUVEAU

  fixedBadge: document.getElementById("fixedBadge"),
  fixedList: document.getElementById("fixedList"),

  coursesLeft: document.getElementById("coursesLeft"),
  coursesLimit: document.getElementById("coursesLimit"),
  coursesSpent: document.getElementById("coursesSpent"),
  coursesAmount: document.getElementById("coursesAmount"),
  coursesAdd: document.getElementById("coursesAdd"),
  coursesEntries: document.getElementById("coursesEntries"),

  funLeft: document.getElementById("funLeft"),
  funLimit: document.getElementById("funLimit"),
  funSpent: document.getElementById("funSpent"),
  funAmount: document.getElementById("funAmount"),
  funAdd: document.getElementById("funAdd"),
  funEntries: document.getElementById("funEntries"),

  izlyTotal: document.getElementById("izlyTotal"),
  izlyAmount: document.getElementById("izlyAmount"),
  izlyAdd: document.getElementById("izlyAdd"),
  izlyEntries: document.getElementById("izlyEntries"),

  fuelTotal: document.getElementById("fuelTotal"),
  fuelAmount: document.getElementById("fuelAmount"),
  fuelAdd: document.getElementById("fuelAdd"),
  fuelEntries: document.getElementById("fuelEntries"),

  otherTotal: document.getElementById("otherTotal"),
  otherAmount: document.getElementById("otherAmount"),
  otherAdd: document.getElementById("otherAdd"),
  otherEntries: document.getElementById("otherEntries"),
};

function ensureStateShape() {
  // Pour éviter de casser tes mois déjà sauvegardés (v6) qui n'ont pas "other"
  if (!state.other) state.other = { spentCents: 0, entries: [] };
  if (!state.fuel) state.fuel = { spentCents: 0, entries: [] };
  if (!state.izly) state.izly = { spentCents: 0, entries: [] };
  if (!state.envelopes) state.envelopes = { courses: { limitCents: 20000, spentCents: 0, entries: [] }, plaisir: { limitCents: 20000, spentCents: 0, entries: [] } };
  if (!state.envelopes.courses) state.envelopes.courses = { limitCents: 20000, spentCents: 0, entries: [] };
  if (!state.envelopes.plaisir) state.envelopes.plaisir = { limitCents: 20000, spentCents: 0, entries: [] };
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

function calc() {
  const income = state.incomeCents;

  const fixedExpensesTotal = state.fixed.reduce((s, e) => s + e.amountCents, 0);

  // ✅ Fixes cochés uniquement (on garde pour le calcul du reste actuel)
  const fixedPaidOnly = state.fixed.reduce((s, e) => s + (e.paid ? e.amountCents : 0), 0);
  const unpaidFixed = fixedExpensesTotal - fixedPaidOnly;

  const courses = state.envelopes.courses;
  const plaisir = state.envelopes.plaisir;

  const budgetsTotal = courses.limitCents + plaisir.limitCents; // 200 + 200
  const budgetsRemaining =
    (courses.limitCents - courses.spentCents) +
    (plaisir.limitCents - plaisir.spentCents);

  // ✅ NOUVEAU : budgets dépensés = ajoutés à "Fixes payés"
  const budgetsSpent = courses.spentCents + plaisir.spentCents;

  const fixedTotal = fixedExpensesTotal + budgetsTotal;

  // ✅ MODIF DEMANDÉE : "Fixes payés" = Fixes cochés + budgets dépensés
  const fixedPaid = fixedPaidOnly + budgetsSpent;

  const fixedRemaining = unpaidFixed + budgetsRemaining;

  const izlySpent = state.izly.spentCents;
  const fuelSpent = state.fuel.spentCents;
  const otherSpent = state.other.spentCents;

  const netLeft = income - fixedTotal - izlySpent - fuelSpent - otherSpent;

  // ✅ Reste actuel : ce qui reste après ce que tu as déjà réellement sorti/consommé
  // (fixes cochés + dépenses enregistrées)
  const currentLeft =
    income -
    fixedPaidOnly -
    courses.spentCents -
    plaisir.spentCents -
    izlySpent -
    fuelSpent -
    otherSpent;

  return { fixedTotal, fixedPaid, fixedRemaining, netLeft, currentLeft };
}

function render() {
  els.monthLabel.textContent = currentMonth;
  els.incomeInput.value = centsToEuro(state.incomeCents);

  const c = calc();
  els.kFixedTotal.textContent = `${centsToEuro(c.fixedTotal)} €`;
  els.kFixedPaid.textContent = `${centsToEuro(c.fixedPaid)} €`;
  els.kFixedRemaining.textContent = `${centsToEuro(c.fixedRemaining)} €`;
  els.kNetLeft.textContent = `${centsToEuro(c.netLeft)} €`;

  // ✅ MODIF UNIQUEMENT ICI : on met à jour "Reste actuel" même si els.kCurrentLeft était null au départ
  const currentEl = els.kCurrentLeft || document.getElementById("kCurrentLeft");
  if (currentEl) currentEl.textContent = `${centsToEuro(c.currentLeft)} €`;

  const paidCount = state.fixed.filter((e) => e.paid).length;
  els.fixedBadge.textContent = `${paidCount} / ${state.fixed.length} payées`;

  // Fixes list grouped
  els.fixedList.innerHTML = "";
  const groups = ["Appart", "Perso"];
  for (const g of groups) {
    const title = document.createElement("div");
    title.className = "groupTitle";
    title.textContent = g;
    els.fixedList.appendChild(title);

    const items = state.fixed.filter((e) => e.group === g);
    for (const e of items) {
      const row = document.createElement("div");
      row.className = "item";

      const left = document.createElement("div");
      left.style.flex = "1";

      const name = document.createElement("div");
      name.className = "name";
      name.textContent = e.name;

      const amt = document.createElement("div");
      amt.className = "amt";
      amt.textContent = `${centsToEuro(e.amountCents)} €`;

      left.appendChild(name);
      left.appendChild(amt);

      const actions = document.createElement("div");
      actions.className = "actions";

      const toggle = document.createElement("div");
      toggle.className = "toggle" + (e.paid ? " on" : "");
      const knob = document.createElement("div");
      knob.className = "knob";
      toggle.appendChild(knob);
      toggle.addEventListener("click", () => {
        e.paid = !e.paid;
        persist();
        render();
      });

      actions.appendChild(toggle);
      row.appendChild(left);
      row.appendChild(actions);
      els.fixedList.appendChild(row);
    }
  }

  // Courses
  const courses = state.envelopes.courses;
  els.coursesLimit.textContent = `${centsToEuro(courses.limitCents)} €`;
  els.coursesSpent.textContent = `${centsToEuro(courses.spentCents)} €`;
  els.coursesLeft.textContent = `${centsToEuro(courses.limitCents - courses.spentCents)} €`;
  renderEntries(els.coursesEntries, courses.entries, (id) => deleteEnvelopeEntry("courses", id));

  // Plaisir
  const plaisir = state.envelopes.plaisir;
  els.funLimit.textContent = `${centsToEuro(plaisir.limitCents)} €`;
  els.funSpent.textContent = `${centsToEuro(plaisir.spentCents)} €`;
  els.funLeft.textContent = `${centsToEuro(plaisir.limitCents - plaisir.spentCents)} €`;
  renderEntries(els.funEntries, plaisir.entries, (id) => deleteEnvelopeEntry("plaisir", id));

  // Izly
  els.izlyTotal.textContent = `${centsToEuro(state.izly.spentCents)} €`;
  renderEntries(els.izlyEntries, state.izly.entries, (id) => deleteCumulativeEntry("izly", id));

  // Essence
  els.fuelTotal.textContent = `${centsToEuro(state.fuel.spentCents)} €`;
  renderEntries(els.fuelEntries, state.fuel.entries, (id) => deleteCumulativeEntry("fuel", id));

  // Autres
  if (els.otherTotal) els.otherTotal.textContent = `${centsToEuro(state.other.spentCents)} €`;
  if (els.otherEntries) renderEntries(els.otherEntries, state.other.entries, (id) => deleteCumulativeEntry("other", id));
}

/**
 * Render entries + bouton suppression.
 * onDelete(id) est appelé quand on clique sur ✕
 */
function renderEntries(container, entries, onDelete) {
  container.innerHTML = "";
  const list = [...entries].slice(-8).reverse();
  if (list.length === 0) return;

  for (const it of list) {
    const row = document.createElement("div");
    row.className = "entry";

    const left = document.createElement("div");
    left.className = "entryLeft";

    const main = document.createElement("div");
    main.className = "entryMain";
    main.textContent = "Dépense";

    const sub = document.createElement("div");
    sub.className = "entrySub";
    sub.textContent = fmtDate(it.ts);

    left.appendChild(main);
    left.appendChild(sub);

    const rightWrap = document.createElement("div");
    rightWrap.style.display = "flex";
    rightWrap.style.alignItems = "center";
    rightWrap.style.gap = "10px";

    const right = document.createElement("div");
    right.className = "entryAmt";
    right.textContent = `-${centsToEuro(it.amountCents)} €`;

    const del = document.createElement("button");
    del.textContent = "✕";
    del.setAttribute("aria-label", "Supprimer");
    del.style.padding = "8px 10px";
    del.style.borderRadius = "10px";
    del.style.background = "#2a1a1a";
    del.style.color = "#ff6b6b";
    del.style.fontWeight = "1000";

    del.addEventListener("click", () => {
      onDelete(it.id);
    });

    rightWrap.appendChild(right);
    rightWrap.appendChild(del);

    row.appendChild(left);
    row.appendChild(rightWrap);
    container.appendChild(row);
  }
}

function recomputeEnvelopeSpent(env) {
  env.spentCents = env.entries.reduce((s, e) => s + e.amountCents, 0);
}
function recomputeCumulativeSpent(obj) {
  obj.spentCents = obj.entries.reduce((s, e) => s + e.amountCents, 0);
}

// --- Suppressions ---
// Courses / Plaisir : on enlève l'entrée et on recalcule spent
function deleteEnvelopeEntry(key, id) {
  const env = state.envelopes[key];
  env.entries = env.entries.filter((e) => e.id !== id);
  recomputeEnvelopeSpent(env);
  persist();
  render();
}

// Izly / Essence / Autres : on enlève l'entrée et on recalcule spent
function deleteCumulativeEntry(which, id) {
  const obj =
    which === "izly" ? state.izly :
    which === "fuel" ? state.fuel :
    state.other;

  obj.entries = obj.entries.filter((e) => e.id !== id);
  recomputeCumulativeSpent(obj);
  persist();
  render();
}

function addEnvelopeSpend(key, amountStr) {
  const amountCents = euroToCents(amountStr);
  if (!amountCents || amountCents <= 0) {
    alert("Montant invalide (ex: 4,50).");
    return false;
  }
  const env = state.envelopes[key];
  env.spentCents += amountCents;
  env.entries.push({ id: uid(), ts: Date.now(), amountCents });
  persist();
  render();
  return true;
}

function addCumulativeSpend(obj, amountStr) {
  const amountCents = euroToCents(amountStr);
  if (!amountCents || amountCents <= 0) {
    alert("Montant invalide (ex: 10,00).");
    return false;
  }
  obj.spentCents += amountCents;
  obj.entries.push({ id: uid(), ts: Date.now(), amountCents });
  persist();
  render();
  return true;
}

function goMonth(delta) {
  const [y, m] = currentMonth.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + delta);
  currentMonth = monthKey(d);
  loadMonth();
}

els.prevMonth.addEventListener("click", () => goMonth(-1));
els.nextMonth.addEventListener("click", () => goMonth(+1));

els.coursesAdd.addEventListener("click", () => {
  if (addEnvelopeSpend("courses", els.coursesAmount.value)) els.coursesAmount.value = "";
});
els.funAdd.addEventListener("click", () => {
  if (addEnvelopeSpend("plaisir", els.funAmount.value)) els.funAmount.value = "";
});
els.izlyAdd.addEventListener("click", () => {
  if (addCumulativeSpend(state.izly, els.izlyAmount.value)) els.izlyAmount.value = "";
});
els.fuelAdd.addEventListener("click", () => {
  if (addCumulativeSpend(state.fuel, els.fuelAmount.value)) els.fuelAmount.value = "";
});
if (els.otherAdd) {
  els.otherAdd.addEventListener("click", () => {
    if (addCumulativeSpend(state.other, els.otherAmount.value)) els.otherAmount.value = "";
  });
}

// Salaire modifiable (sauvegarde quand tu changes)
els.incomeInput.addEventListener("change", () => {
  state.incomeCents = euroToCents(els.incomeInput.value);
  persist();
  render();
});

els.resetMonthBtn.addEventListener("click", () => {
  if (!confirm("Reset du mois : décocher fixes + remettre Courses/Plaisir/Izly/Essence/Autres à zéro ?")) return;
  state.fixed = state.fixed.map((e) => ({ ...e, paid: false }));
  state.envelopes.courses.spentCents = 0;
  state.envelopes.courses.entries = [];
  state.envelopes.plaisir.spentCents = 0;
  state.envelopes.plaisir.entries = [];
  state.izly.spentCents = 0;
  state.izly.entries = [];
  state.fuel.spentCents = 0;
  state.fuel.entries = [];
  state.other.spentCents = 0;
  state.other.entries = [];
  persist();
  render();
});

// Offline (service worker)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

loadMonth();
