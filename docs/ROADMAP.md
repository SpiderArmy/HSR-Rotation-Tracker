# Roadmap

**Current version:** 0.0.1 (speed, turn order and skill points for a four-unit team)
**In progress:** 0.1.0 (Enka UID lookup route and Team UI are in the repo; relic import is not yet built)

This is a fan-made tool and is not affiliated with HoYoverse. Character presets, speeds and stat targets are editable guidelines and may change between game patches. Verify them in game.

---

## Housekeeping (do first, before the next commit)

- [ ] Fill in `.gitignore` with `.venv/`, `__pycache__/`, `*.pyc`, `.DS_Store`
- [ ] Remove already-tracked junk: `git rm -r --cached .venv __pycache__`
- [ ] Do not commit `__MACOSX/` (Mac archive metadata). Delete it from any zip before uploading
- [ ] Tag the current code `v0.0.1` and publish a GitHub Release
- [ ] Rename the README title from "Flask single-page app" to "Rotation Planner"
- [ ] Move `import time` in `app.py` into the standard-library import block (cosmetic)
- [ ] Verify the `.venv` is recreated per machine (macOS `.so` files do not run on other systems)

---

## 0.1.0: Relic Import and Team Auto-Fill

**Status:** UID route and Check UID field exist. Import, relic model and interactive team are open.

### Scope
- [ ] Import JSON from relic scanners (HSR-Scanner shape, plus Fribbels-compatible exports where possible)
- [x] UID lookup Flask route that calls Enka.Network (`/api/enka/uid/<uid>`)
- [x] In-memory cache for UID lookups
- [x] Basic rate limiting (per-process)
- [x] Custom User-Agent header
- [ ] Verify how many characters a UID lookup returns for real accounts before relying on it as the main flow
- [ ] Relic data model: set, slot, main stat, substats, level, equipped character
- [ ] Aggregate relic stats and auto-fill each team unit's speed
- [ ] Interactive team: drag to reorder, click a unit to see its relics, live turn-order recalculation

### Acceptance criteria
- Valid scanner JSON import updates team speed where unit names match
- Import failures show a user-facing error and do not break existing state
- Team reorder updates the turn order immediately
- Clicking a unit opens relic details when imported data exists
- UID route uses cache and rate-limit guardrails (already implemented)

### Notes
- Packet-based scanners may break game terms. Check guidance before recommending them to users.
- Cache and rate-limit state reset on server restart. That's acceptable for now. Move them to a file or database in a later milestone if needed.

---

## 0.1.1: DPS-Anchored Support Speeds

**Why:** UID lookups mostly return the main DPS. Anchor the plan on that DPS's real speed and sets, then work out what speed each support should aim for.

### Scope
- [ ] "Anchor" mode: after import, pick the DPS. Its total SPD and equipped sets become the fixed input
- [ ] Support slots stay manual (name, role, SPD), each showing a recommended SPD
- [ ] Breakpoint table generator: for any unit and cycle, list the SPD needed for 1, 2, 3... actions
- [ ] Sync check: reuse `buildTurns()` to simulate the rotation and flag a support that acts twice before the DPS, or never before it
- [ ] Action-advance modifiers per unit: opening advance and post-ultimate advance
- [ ] Team SPD buff modifier (temporary % boost after an ultimate)
- [ ] Gap display: how far each support is from its recommended SPD, plus a rough count of SPD substat rolls to close it
- [ ] `data/support_rules.json`: editable rules per support role, so numbers can be updated each patch
- [ ] Preview the rotation at recommended SPDs, so the ideal is visible before gearing for it

### Formulas
Action Value: `AV = 10000 / SPD`. Cycle 0 ends at 150 AV; each later cycle adds 100 AV.

For `n` actions by time `T` with no advance: `SPD ≥ 10000 × n / T`
- 150 AV, 2 actions: 133.4 SPD. 3 actions: 200.0 SPD
- 250 AV, 2 actions: 80.0 SPD. 3 actions: 120.0 SPD

With an opening advance of fraction `a`: `SPD ≥ 10000 × (n − a) / T`. With Sprightly Vonwacq (`a = 0.4`), 2 actions in cycle 0 need about 120 SPD instead of 133.4, and 3 need about 173.4 instead of 200. Confirm in game.

### Modifiers to support (verify each patch)
| Effect | What it does | Condition |
|---|---|---|
| Sprightly Vonwacq (planar, 2pc) | Opening advance 40% | Wearer SPD 120 or higher |
| Eagle of Twilight Line (4pc) | Advance 25% after Ultimate | Post-action Ultimates only |
| Messenger Traversing Hackerspace (4pc) | +12% SPD to all allies for 1 turn | Wearer uses Ultimate on an ally |
| Fleet of the Ageless (planar, 2pc) | +8% ATK to all allies | Wearer SPD 120 or higher |

Source note: one guide listed Vonwacq at 145 SPD for 50% advance. Most sources agree on 120 and 40%. Keep the values in `support_rules.json` so they're easy to correct.

### Open questions
- Tie-breaks when AV is equal (slot order, or the game's own rule)
- Whether the UID source returns the sets and SPD needed, or only final stats

---

## 0.2.0: Ideal Targets and Scoring

### Scope
- [ ] Speed breakpoint helper from the AV/cycle formula
- [ ] Show each unit's gap to its next speed breakpoint
- [ ] `data/targets.json`: per-character minimum and ideal values for speed, crit rate, crit damage, effect hit rate and break effect
- [ ] Per-character substat weights and a relic score
- [ ] Recommended main stats per slot, with mismatch warnings

### Acceptance criteria
- Each unit shows current value vs next relevant speed breakpoint
- Target panels load from `data/targets.json` and handle missing entries safely
- Relic score is deterministic for the same input
- Main-stat mismatch warnings are visible and understandable

---

## 0.3.0: Character Splash Art and Cards

### Scope
- [ ] Optional image field on character records
- [ ] Show images in team slots and rotation rows
- [ ] Styled initial as fallback when no image exists
- [ ] User images by URL or upload, stored in the browser only
- [ ] Optional Enka `/ui/hsr/` image links, after reviewing their terms
- [ ] Character card + relic grid layout, similar to the Fribbels optimizer
- [ ] No HoYoverse-owned game art committed to the repo

### Acceptance criteria
- Missing images always show the styled fallback without breaking the layout
- Uploaded or URL images persist across reloads
- Repository contains no bundled proprietary game art

---

## 0.4.0: Better Rotations

### Scope
- [ ] Ultimate energy tracking
- [ ] Speed buffs and action advance simulation
- [ ] Enemy turns, for boss pacing comparison
- [ ] Save multiple rotations
- [ ] Share rotations by link, JSON or image

### Acceptance criteria
- Simulation is deterministic for identical inputs
- Saved rotations can be switched without data loss
- A shared payload can be imported and replayed

---

## Delivery and hosting

- [ ] Decide the hosting path. GitHub Pages only serves static files, so it can't run the Flask app and gives a 404 for this repo.
- [ ] Option A: host the Flask app on a Python host (Render, PythonAnywhere, or similar) and link the repo for deploys
- [ ] Option B: publish a static, single-file build for a no-server preview (the planner runs, backend calls are simulated)
- [ ] Document the chosen option in the README, with a "Run locally" section that matches `make run`

---

## Parallel improvements

### Quality
- [ ] Unit tests for turn-order, SP and breakpoint math
- [ ] Route tests for `/`, `/api/characters`, and `/api/enka/uid/<uid>` (valid, invalid, rate-limited)
- [ ] CI check on every commit (run tests, check no `.venv` or `__pycache__` is tracked)

### Data maintenance
- [ ] Optional post-patch character data refresh from a community dataset (example: kel-z/HSR-Data)
- [ ] Re-verify all preset speeds, Vonwacq thresholds and Eagle timing after each patch

### Release hygiene
- [ ] Tag each milestone (`v0.0.1`, `v0.1.0`, `v0.1.1`, ...) and publish a Release
- [ ] Keep a changelog entry per milestone
- [ ] Use the matching `.github/ISSUE_TEMPLATE/` file for each milestone

### Stretch
- [ ] Relic assignment optimizer (or link to the Fribbels optimizer instead)
- [ ] Damage calculator
- [ ] Starter team templates