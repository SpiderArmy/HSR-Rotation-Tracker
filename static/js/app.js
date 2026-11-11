// ---- Section navigation (hash-based, so back/forward and deep links work) ----
const panels = [...document.querySelectorAll(".panel")];
const navButtons = [...document.querySelectorAll(".nav-btn")];
const ids = panels.map((p) => p.id);

function showSection(id, { focus = true } = {}) {
  if (!ids.includes(id)) id = ids[0];
  panels.forEach((p) => p.classList.toggle("is-active", p.id === id));
  navButtons.forEach((b) =>
    b.dataset.goto === id ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")
  );
  if (focus) document.querySelector(`#${id} h1`)?.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-goto]");
  if (t) location.hash = t.dataset.goto;
});
window.addEventListener("hashchange", () => showSection(location.hash.slice(1)));
showSection(location.hash.slice(1), { focus: false });

// ---- Small helper for calling the Flask API ----
async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

// ---- State (saved in the browser so a refresh keeps your setup) ----
const ROLES = ["DPS", "Sub-DPS", "Support", "Sustain"];
const MAX_SP = 5;
const defaults = () => ({
  team: [
    { name: "Unit 1", role: "DPS", spd: 115 },
    { name: "Unit 2", role: "Sub-DPS", spd: 100 },
    { name: "Unit 3", role: "Support", spd: 107 },
    { name: "Unit 4", role: "Sustain", spd: 100 },
  ],
  cycles: 3, sp0: 3, actions: {},
});
let state = defaults();
try { state = { ...state, ...JSON.parse(localStorage.getItem("rotation") || "{}") }; } catch {}
const save = () => { try { localStorage.setItem("rotation", JSON.stringify(state)); } catch {} };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let presets = [];

// ---- Team slots ----
const slotsEl = document.getElementById("slots");
function renderSlots() {
  slotsEl.innerHTML = state.team.map((u, i) => `
    <div class="slot" style="--c: var(--c${i + 1})" data-i="${i}">
      <input data-f="name" value="${esc(u.name)}" aria-label="Unit ${i + 1} name">
      <select data-f="role" aria-label="Unit ${i + 1} role">
        ${ROLES.map((r) => `<option${r === u.role ? " selected" : ""}>${r}</option>`).join("")}
      </select>
      <input data-f="spd" type="number" min="1" max="400" value="${u.spd}" aria-label="Unit ${i + 1} speed">
      <select data-f="preset" aria-label="Unit ${i + 1} preset">
        <option value="">Preset…</option>
        ${presets.map((p, k) => `<option value="${k}">${esc(p.name)}</option>`).join("")}
      </select>
      <span class="hint" data-hint></span>
    </div>`).join("");
  updateHints();
}
function updateHints() {
  slotsEl.querySelectorAll(".slot").forEach((el) => {
    const spd = state.team[el.dataset.i].spd;
    el.querySelector("[data-hint]").textContent = spd > 0
      ? `First action at ${(10000 / spd).toFixed(1)} AV, then every ${(10000 / spd).toFixed(1)} AV.`
      : "Enter a speed above 0.";
  });
}
slotsEl.addEventListener("change", (e) => {
  const slot = e.target.closest(".slot"); if (!slot) return;
  const u = state.team[slot.dataset.i], f = e.target.dataset.f;
  if (f === "preset") {
    const p = presets[e.target.value]; if (!p) return;
    Object.assign(u, { name: p.name, role: p.role, spd: p.spd });
    renderSlots();
  } else {
    u[f] = f === "spd" ? Number(e.target.value) || 0 : e.target.value;
    updateHints();
  }
  state.actions = {};
  save(); renderRotation();
});

// ---- Rotation ----
const cyclesEl = document.getElementById("cycles"), sp0El = document.getElementById("sp0");
cyclesEl.innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<option>${n}</option>`).join("");
sp0El.innerHTML = Array.from({ length: MAX_SP + 1 }, (_, n) => `<option>${n}</option>`).join("");
cyclesEl.value = state.cycles; sp0El.value = state.sp0;
cyclesEl.onchange = () => { state.cycles = +cyclesEl.value; save(); renderRotation(); };
sp0El.onchange = () => { state.sp0 = +sp0El.value; save(); renderRotation(); };
document.getElementById("reset-actions").onclick = () => { state.actions = {}; save(); renderRotation(); };

function buildTurns() {
  const limit = 150 + 100 * state.cycles, turns = [];
  state.team.forEach((u, i) => {
    if (u.spd <= 0) return;
    for (let k = 1; (k * 10000) / u.spd <= limit; k++) turns.push({ i, k, av: (k * 10000) / u.spd });
  });
  return turns.sort((a, b) => a.av - b.av || a.i - b.i);
}
const cycleOf = (av) => (av <= 150 ? 0 : Math.ceil((av - 150) / 100));

function renderRotation() {
  let sp = state.sp0, last = -1, bad = 0, html = "";
  for (const t of buildTurns()) {
    const key = `${t.i}-${t.k}`, c = cycleOf(t.av);
    if (c !== last) { html += `<tr class="cycle"><td colspan="4">Cycle ${c}</td></tr>`; last = c; }
    const act = state.actions[key] || (sp > 0 ? "Skill" : "Basic");
    let flag = false;
    if (act === "Skill") { if (sp > 0) sp--; else flag = true; }
    if (act === "Basic") sp = Math.min(MAX_SP, sp + 1);
    if (flag) bad++;
    const seg = ["Basic", "Skill", "Ult"].map((a) =>
      `<button type="button" data-key="${key}" data-act="${a}" aria-pressed="${a === act}">${a}</button>`).join("");
    html += `<tr class="turn${flag ? " bad" : ""}" style="--c: var(--c${t.i + 1})">
      <td>${t.av.toFixed(1)}</td><td>${esc(state.team[t.i].name)}</td>
      <td><span class="seg">${seg}</span></td>
      <td>${flag ? "Not enough SP" : sp + " / " + MAX_SP}</td></tr>`;
  }
  document.getElementById("rot-body").innerHTML = html;
  const msg = document.getElementById("rot-msg");
  msg.textContent = bad ? `${bad} Skill${bad > 1 ? "s" : ""} used without enough SP. Switch those to Basic.` : "";
  msg.classList.toggle("error", bad > 0);
}
document.getElementById("rot-body").addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  state.actions[b.dataset.key] = b.dataset.act;
  save(); renderRotation();
});

// ---- Start ----
renderSlots(); renderRotation();
api("/api/characters").then((list) => { presets = list; renderSlots(); }).catch(() => {});
