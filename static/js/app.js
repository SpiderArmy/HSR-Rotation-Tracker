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
  cycles: 3,
  sp0: 3,
  actions: {},
  importBaseSpeeds: [115, 100, 107, 100],
  relicIndex: {},
  lastUidCharacters: [],
});
let state = defaults();
try { state = { ...state, ...JSON.parse(localStorage.getItem("rotation") || "{}") }; } catch {}
if (!Array.isArray(state.team) || state.team.length !== 4) state.team = defaults().team;
if (!Array.isArray(state.importBaseSpeeds) || state.importBaseSpeeds.length !== 4) {
  state.importBaseSpeeds = state.team.map((u) => Number(u.spd) || 0);
}
if (!state.relicIndex || typeof state.relicIndex !== "object") state.relicIndex = {};
if (!Array.isArray(state.lastUidCharacters)) state.lastUidCharacters = [];
const save = () => { try { localStorage.setItem("rotation", JSON.stringify(state)); } catch {} };
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const canonical = (s) => String(s || "").trim().toLowerCase();
const round1 = (n) => Math.round(n * 10) / 10;
let presets = [];

// ---- Team slots ----
const slotsEl = document.getElementById("slots");
const relicPanel = document.getElementById("relic-panel");
const relicPanelTitle = document.getElementById("relic-panel-title");
const relicPanelSummary = document.getElementById("relic-panel-summary");
const relicPanelBody = document.getElementById("relic-panel-body");
const importMsg = document.getElementById("relic-import-msg");
const uidInput = document.getElementById("enka-uid");
const uidLookupBtn = document.getElementById("enka-lookup");
const uidApplyBtn = document.getElementById("enka-apply");
const uidMsg = document.getElementById("enka-msg");
const uidApplyMsg = document.getElementById("enka-apply-msg");
const importReportEl = document.getElementById("import-report");
const importReportSummaryEl = document.getElementById("import-report-summary");
const importReportMatchedEl = document.getElementById("import-report-matched");
const importReportUnmatchedEl = document.getElementById("import-report-unmatched");
const importReportSkippedEl = document.getElementById("import-report-skipped");

function renderSlots() {
  slotsEl.innerHTML = state.team.map((u, i) => `
    <div class="slot" style="--c: var(--c${i + 1})" data-i="${i}" draggable="true">
      <input data-f="name" value="${esc(u.name)}" aria-label="Unit ${i + 1} name">
      <select data-f="role" aria-label="Unit ${i + 1} role">
        ${ROLES.map((r) => `<option${r === u.role ? " selected" : ""}>${r}</option>`).join("")}
      </select>
      <input data-f="spd" type="number" min="1" max="400" value="${u.spd}" aria-label="Unit ${i + 1} speed">
      <select data-f="preset" aria-label="Unit ${i + 1} preset">
        <option value="">Preset…</option>
        ${presets.map((p, k) => `<option value="${k}">${esc(p.name)}</option>`).join("")}
      </select>
      <div class="slot-tools">
        <button type="button" class="btn" data-open-relic="${i}">Relics</button>
      </div>
      <span class="hint" data-hint></span>
    </div>`).join("");
  updateHints();
}
function updateHints() {
  slotsEl.querySelectorAll(".slot").forEach((el) => {
    const i = Number(el.dataset.i);
    const unit = state.team[i];
    const spd = Number(unit.spd) || 0;
    const imported = state.relicIndex[canonical(unit.name)];
    const extra = imported ? ` Imported relic SPD bonus: +${round1(imported.bonusSpd)}.` : "";
    el.querySelector("[data-hint]").textContent = spd > 0
      ? `First action at ${(10000 / spd).toFixed(1)} AV, then every ${(10000 / spd).toFixed(1)} AV.${extra}`
      : "Enter a speed above 0.";
  });
}
slotsEl.addEventListener("change", (e) => {
  const slot = e.target.closest(".slot"); if (!slot) return;
  const i = Number(slot.dataset.i);
  const u = state.team[i], f = e.target.dataset.f;
  if (f === "preset") {
    const p = presets[e.target.value]; if (!p) return;
    Object.assign(u, { name: p.name, role: p.role, spd: p.spd });
    state.importBaseSpeeds[i] = Number(p.spd) || 0;
    renderSlots();
  } else {
    if (f === "spd") {
      u.spd = Number(e.target.value) || 0;
      state.importBaseSpeeds[i] = u.spd;
    } else {
      u[f] = e.target.value;
    }
    updateHints();
  }
  state.actions = {};
  save(); renderRotation();
});

slotsEl.addEventListener("click", (e) => {
  const relicBtn = e.target.closest("[data-open-relic]");
  if (relicBtn) {
    openRelicPanel(Number(relicBtn.dataset.openRelic));
    return;
  }
  const slot = e.target.closest(".slot");
  if (!slot) return;
  if (e.target.closest("input, select, button, option")) return;
  openRelicPanel(Number(slot.dataset.i));
});

let dragFrom = null;
slotsEl.addEventListener("dragstart", (e) => {
  const slot = e.target.closest(".slot");
  if (!slot) return;
  dragFrom = Number(slot.dataset.i);
  slot.classList.add("dragging");
});
slotsEl.addEventListener("dragend", (e) => {
  const slot = e.target.closest(".slot");
  if (slot) slot.classList.remove("dragging");
  dragFrom = null;
});
slotsEl.addEventListener("dragover", (e) => {
  if (dragFrom == null) return;
  e.preventDefault();
});
slotsEl.addEventListener("drop", (e) => {
  if (dragFrom == null) return;
  e.preventDefault();
  const slot = e.target.closest(".slot");
  if (!slot) return;
  const dragTo = Number(slot.dataset.i);
  if (Number.isNaN(dragTo) || dragTo === dragFrom) return;
  const [moved] = state.team.splice(dragFrom, 1);
  state.team.splice(dragTo, 0, moved);
  const [base] = state.importBaseSpeeds.splice(dragFrom, 1);
  state.importBaseSpeeds.splice(dragTo, 0, base);
  state.actions = {};
  save();
  renderSlots();
  renderRotation();
});

function statValueNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number(value) || 0;
  return Number.parseFloat(value.replace(/,/g, "").replace(/%/g, "")) || 0;
}

function isSpeedStat(name, value) {
  const n = canonical(name);
  if (!n) return false;
  if (!(n.includes("spd") || n.includes("speed"))) return false;
  if (typeof value === "string" && value.includes("%")) return false;
  if (n.includes("percent") || n.endsWith("%")) return false;
  return true;
}

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

function normalizeSubstats(item) {
  const raw = pick(item, ["substats", "sub_stats", "subAffixList", "subAffixes"], []);
  const out = [];
  for (const s of Array.isArray(raw) ? raw : []) {
    const name = String(pick(s, ["name", "key", "type", "stat"], ""));
    const value = pick(s, ["value", "val", "display"], "");
    if (!name) continue;
    out.push({ name, value });
  }
  return out;
}

function detectImportFormat(raw) {
  if (raw?.format === "fribbels" || raw?.source === "fribbels") return "fribbels";
  if (Array.isArray(raw?.relics) && raw?.metadata?.scanner) return "hsr-scanner";
  if (Array.isArray(raw?.relics) && raw.relics.some((r) => r?.setKey || r?.slotKey)) return "fribbels";
  if (Array.isArray(raw?.relics) || Array.isArray(raw?.inventory) || Array.isArray(raw?.data?.relics)) return "generic";
  return "unknown";
}

function listRelicRows(raw) {
  return [
    raw?.relics,
    raw?.relic_data,
    raw?.inventory,
    raw?.data?.relics,
    raw?.data?.inventory,
  ].find((arr) => Array.isArray(arr)) || [];
}

function normalizeRelicRow(item) {
  const substats = normalizeSubstats(item);
  const mainName = String(pick(item, ["mainStat", "main_stat", "mainAffixName", "main_affix", "main", "mainStatKey"], ""));
  const mainValue = pick(item, ["mainStatValue", "main_stat_value", "mainAffixValue", "main_value", "mainStatValueText"], "");
  const equipped = String(
    pick(item, [
      "equippedCharacter",
      "equipped_character",
      "equippedBy",
      "equipped_by",
      "location",
      "wearer",
      "owner",
      "equipped",
    ], "")
  ).trim();
  return {
    set: String(pick(item, ["set", "setName", "set_name", "setKey"], "Unknown")),
    slot: String(pick(item, ["slot", "slotName", "part", "slotKey"], "Unknown")),
    mainStat: mainName,
    mainStatValue: mainValue,
    substats,
    level: Number(pick(item, ["level", "lv", "lvl"], 0)) || 0,
    equippedCharacter: equipped,
  };
}

function parseRelicRows(raw, format) {
  const rows = listRelicRows(raw);
  const relics = [];
  const diagnostics = [];

  rows.forEach((item, idx) => {
    const row = normalizeRelicRow(item);
    const reasons = [];

    if (!row.equippedCharacter) reasons.push("missing equipped character");
    if (!row.mainStat) reasons.push("missing main stat");
    if (!row.slot || row.slot === "Unknown") reasons.push("unknown slot");
    if (!Number.isFinite(row.level)) reasons.push("invalid level");

    if (reasons.length) {
      diagnostics.push({
        row: idx + 1,
        severity: reasons.includes("missing equipped character") ? "error" : "warning",
        reason: reasons.join(", "),
      });
    }

    // Equipped character is required for team mapping in this milestone.
    if (!row.equippedCharacter) return;
    relics.push(row);
  });

  if (!rows.length) {
    diagnostics.push({ row: 0, severity: "error", reason: "no relic array found in file" });
  }

  return {
    format,
    relics,
    diagnostics,
    totals: {
      rows: rows.length,
      accepted: relics.length,
      skipped: Math.max(0, rows.length - relics.length),
    },
  };
}

function parseRelicExport(raw) {
  const format = detectImportFormat(raw);
  if (format === "unknown") {
    return {
      format,
      relics: [],
      diagnostics: [{ row: 0, severity: "error", reason: "unsupported export format" }],
      totals: { rows: 0, accepted: 0, skipped: 0 },
    };
  }
  return parseRelicRows(raw, format);
}

function extractCharacterSpeeds(raw) {
  const out = {};
  const chars = Array.isArray(raw?.characters) ? raw.characters : [];
  for (const ch of chars) {
    const name = String(pick(ch, ["name", "characterName", "displayName"], "")).trim();
    if (!name) continue;
    const speed = pick(ch, ["speed", "spd", "stats.speed", "attributes.speed"], null);
    let resolved = Number(speed);
    if (!Number.isFinite(resolved)) {
      const stats = ch.stats || ch.attributes || {};
      resolved = Number(stats.speed ?? stats.spd ?? 0);
    }
    if (resolved > 0) out[canonical(name)] = resolved;
  }
  return out;
}

function extractUidCharacters(payload) {
  const chars = Array.isArray(payload?.summary?.characters) ? payload.summary.characters : [];
  return chars
    .map((ch) => ({ name: String(ch?.name || "").trim(), spd: Number(ch?.spd) || 0 }))
    .filter((ch) => ch.name);
}

function buildRelicIndex(relics) {
  const byName = {};
  for (const r of relics) {
    const nameKey = canonical(r.equippedCharacter);
    if (!nameKey) continue;
    if (!byName[nameKey]) byName[nameKey] = { name: r.equippedCharacter, relics: [], bonusSpd: 0 };
    byName[nameKey].relics.push(r);
    if (isSpeedStat(r.mainStat, r.mainStatValue)) {
      byName[nameKey].bonusSpd += statValueNumber(r.mainStatValue);
    }
    for (const s of r.substats) {
      if (isSpeedStat(s.name, s.value)) byName[nameKey].bonusSpd += statValueNumber(s.value);
    }
  }
  Object.values(byName).forEach((entry) => {
    entry.bonusSpd = round1(entry.bonusSpd);
  });
  return byName;
}

function applyImportedSpeeds(index, charSpeeds) {
  state.team.forEach((u, i) => {
    const key = canonical(u.name);
    const fromCharacter = Number(charSpeeds[key]);
    if (fromCharacter > 0) {
      u.spd = round1(fromCharacter);
      return;
    }
    const relics = index[key];
    if (!relics) return;
    const base = Number(state.importBaseSpeeds[i]);
    const fallbackBase = Number.isFinite(base) && base > 0 ? base : Number(u.spd) || 0;
    u.spd = round1(Math.max(1, fallbackBase + relics.bonusSpd));
  });
}

function summarizeImportMatches(index) {
  let matchedUnits = 0;
  const matchedNames = [];
  const unmatchedNames = [];
  for (const u of state.team) {
    const key = canonical(u.name);
    if (!key) continue;
    if (index[key]) {
      matchedUnits++;
      matchedNames.push(u.name);
    } else {
      unmatchedNames.push(u.name);
    }
  }
  return { matchedUnits, matchedNames, unmatchedNames };
}

function renderImportReport(report) {
  if (!report) {
    importReportEl.hidden = true;
    return;
  }

  importReportEl.hidden = false;
  importReportSummaryEl.textContent =
    `Format: ${report.format}. Rows: ${report.totals.rows}. Accepted: ${report.totals.accepted}. Skipped: ${report.totals.skipped}. Matched units: ${report.match.matchedUnits}/4.`;

  importReportMatchedEl.innerHTML = report.match.matchedNames.length
    ? report.match.matchedNames.map((name) => `<li>${esc(name)}</li>`).join("")
    : "<li>None</li>";

  importReportUnmatchedEl.innerHTML = report.match.unmatchedNames.length
    ? report.match.unmatchedNames.map((name) => `<li>${esc(name)}</li>`).join("")
    : "<li>None</li>";

  const topSkipped = report.diagnostics.slice(0, 10);
  const skippedRows = topSkipped.map((d) => `<li class=\"mono\">row ${d.row}: ${esc(d.reason)}</li>`);
  if (report.diagnostics.length > topSkipped.length) {
    skippedRows.push(`<li class=\"mono\">...and ${report.diagnostics.length - topSkipped.length} more</li>`);
  }
  importReportSkippedEl.innerHTML = skippedRows.length ? skippedRows.join("") : "<li>None</li>";
}

function openRelicPanel(slotIndex) {
  const unit = state.team[slotIndex];
  if (!unit) return;
  const data = state.relicIndex[canonical(unit.name)];
  relicPanel.hidden = false;
  relicPanelTitle.textContent = `${unit.name} Relics`;
  if (!data || !data.relics.length) {
    relicPanelSummary.textContent = "No imported relics found for this unit yet.";
    relicPanelBody.innerHTML = "";
    return;
  }
  relicPanelSummary.textContent = `Imported ${data.relics.length} relics. Estimated relic SPD bonus: +${data.bonusSpd}.`;
  relicPanelBody.innerHTML = data.relics.map((r) => {
    const subs = r.substats.length
      ? r.substats.map((s) => `${esc(String(s.name))} ${esc(String(s.value))}`).join("<br>")
      : "-";
    const main = [r.mainStat, r.mainStatValue].filter(Boolean).join(" ").trim() || "-";
    return `<tr>
      <td>${esc(r.slot)}</td>
      <td>${esc(r.set)}</td>
      <td>${esc(main)}</td>
      <td>${subs}</td>
      <td>+${r.level}</td>
    </tr>`;
  }).join("");
}

document.getElementById("close-relic-panel").addEventListener("click", () => {
  relicPanel.hidden = true;
});

uidLookupBtn.addEventListener("click", async () => {
  const uid = String(uidInput.value || "").trim();
  if (!/^\d{9}$/.test(uid)) {
    uidMsg.textContent = "Enter a valid 9-digit UID.";
    uidMsg.classList.add("error");
    return;
  }

  uidLookupBtn.disabled = true;
  uidMsg.textContent = "Checking Enka UID...";
  uidMsg.classList.remove("error");
  uidApplyMsg.textContent = "";

  try {
    const res = await api(`/api/enka/uid/${uid}`);
    const count = Number(res?.summary?.character_count) || 0;
    const source = res?.source || "network";
    const names = Array.isArray(res?.summary?.character_names) ? res.summary.character_names.filter(Boolean) : [];
    const preview = names.length ? ` Characters: ${names.slice(0, 6).join(", ")}${names.length > 6 ? "..." : ""}.` : "";
    const caution = count < 4
      ? " Coverage is low for team auto-fill; verify manually before relying on UID lookup."
      : "";
    uidMsg.textContent = `UID ${uid} returned ${count} character(s) from ${source}.${preview}${caution}`;

    state.lastUidCharacters = extractUidCharacters(res);
    uidApplyBtn.disabled = state.lastUidCharacters.length === 0;
    save();
  } catch (err) {
    uidMsg.textContent = err.message || "UID lookup failed.";
    uidMsg.classList.add("error");
    state.lastUidCharacters = [];
    uidApplyBtn.disabled = true;
  } finally {
    uidLookupBtn.disabled = false;
  }
});

uidApplyBtn.addEventListener("click", () => {
  const incoming = Array.isArray(state.lastUidCharacters) ? state.lastUidCharacters.slice() : [];
  if (!incoming.length) {
    uidApplyMsg.textContent = "No UID characters are available to apply yet.";
    uidApplyMsg.classList.add("error");
    return;
  }

  uidApplyMsg.classList.remove("error");
  const teamTaken = new Set();
  const usedIncoming = new Set();
  const applied = [];

  // First pass: name matches to existing slots.
  for (let i = 0; i < state.team.length; i++) {
    const slotName = canonical(state.team[i].name);
    const idx = incoming.findIndex((c, j) => !usedIncoming.has(j) && canonical(c.name) === slotName);
    if (idx < 0) continue;
    usedIncoming.add(idx);
    teamTaken.add(i);
    if (incoming[idx].spd > 0) {
      state.team[i].spd = round1(incoming[idx].spd);
      state.importBaseSpeeds[i] = state.team[i].spd;
    }
    state.team[i].name = incoming[idx].name;
    applied.push(incoming[idx].name);
  }

  // Second pass: fill remaining slots in order.
  for (let i = 0; i < state.team.length; i++) {
    if (teamTaken.has(i)) continue;
    const idx = incoming.findIndex((_, j) => !usedIncoming.has(j));
    if (idx < 0) break;
    usedIncoming.add(idx);
    state.team[i].name = incoming[idx].name;
    if (incoming[idx].spd > 0) {
      state.team[i].spd = round1(incoming[idx].spd);
      state.importBaseSpeeds[i] = state.team[i].spd;
    }
    applied.push(incoming[idx].name);
  }

  const skipped = incoming
    .filter((_, i) => !usedIncoming.has(i))
    .map((c) => c.name);
  state.actions = {};
  save();
  renderSlots();
  renderRotation();

  uidApplyMsg.textContent = `Applied ${applied.length} UID character(s): ${applied.join(", ") || "none"}.${skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""}`;
});

uidInput.addEventListener("input", () => {
  uidInput.value = uidInput.value.replace(/\D+/g, "").slice(0, 9);
});

uidInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  uidLookupBtn.click();
});

document.getElementById("relic-file").addEventListener("change", async (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const parsed = parseRelicExport(raw);
    if (!parsed.relics.length) {
      const detail = parsed.diagnostics[0]?.reason || "No relic entries were found in this file.";
      throw new Error(detail);
    }

    const index = buildRelicIndex(parsed.relics);
    if (!Object.keys(index).length) {
      throw new Error("Relics were found, but none had an equipped character field to map against your team.");
    }

    const charSpeeds = extractCharacterSpeeds(raw);
    state.relicIndex = index;
    applyImportedSpeeds(index, charSpeeds);
    state.actions = {};
    save();
    renderSlots();
    renderRotation();

    const match = summarizeImportMatches(index);
    renderImportReport({
      format: parsed.format,
      diagnostics: parsed.diagnostics,
      totals: parsed.totals,
      match,
    });

    const withRelics = Object.keys(index).length;
    const unmatchedText = match.unmatchedNames.length
      ? ` No relics matched: ${match.unmatchedNames.join(", ")}.`
      : "";
    importMsg.textContent =
      `Imported ${parsed.relics.length} relics across ${withRelics} character(s). ` +
      `Matched ${match.matchedUnits}/4 team units.${unmatchedText}`;
    importMsg.classList.remove("error");
  } catch (err) {
    importMsg.textContent = err.message || "Could not parse this JSON file.";
    importMsg.classList.add("error");
    renderImportReport(null);
  } finally {
    e.target.value = "";
  }
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
uidApplyBtn.disabled = !Array.isArray(state.lastUidCharacters) || state.lastUidCharacters.length === 0;
api("/api/characters").then((list) => { presets = list; renderSlots(); }).catch(() => {});
