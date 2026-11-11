# Roadmap

Current version: **0.0.1**

This project currently supports speed, turn order, and skill-point planning for a four-unit team.

Character presets and stat targets are editable guidelines and may change across patches. This is a fan-made tool and is not affiliated with HoYoverse.

## Milestone 0.1.0 - Relic Import and Team Auto-Fill

### Scope
- Import JSON from relic scanners (HSR-Scanner shape, plus Fribbels-compatible exports where possible).
- Add a UID lookup Flask route that calls Enka.Network with:
  - in-memory cache
  - basic rate limiting
  - custom User-Agent header
- Verify practical UID character coverage before relying on UID lookup as a primary flow.
- Add relic data model support:
  - set
  - slot
  - main stat
  - substats
  - level
  - equipped character
- Aggregate relic stats and auto-fill each team unit's speed.
- Add interactive team behavior:
  - drag to reorder
  - click a unit to view imported relics
  - live turn-order recalculation

### Acceptance Criteria
- Valid scanner JSON import updates team speed values where unit names match.
- Import failures show a user-facing error and do not break existing state.
- Team reorder updates displayed turn order immediately.
- Clicking a unit opens relic detail info when imported data exists.
- UID route uses cache and rate-limit guardrails.

### Notes
- Check game terms and scanner guidance before recommending packet-based tooling.

---

## Milestone 0.2.0 - Ideal Targets and Scoring

### Scope
- Implement speed breakpoint helper from AV/cycle formula.
- Show each unit's gap to next speed breakpoint.
- Add `data/targets.json` with per-character minimum and ideal stats:
  - speed
  - crit rate
  - crit damage
  - effect hit rate
  - break effect
- Add per-character substat weights and relic score.
- Add recommended main stats by slot and mismatch warnings.

### Acceptance Criteria
- Each unit shows current value vs next relevant speed breakpoint.
- Target panels load from `data/targets.json` and handle missing entries safely.
- Relic score is deterministic for same input.
- Main-stat mismatch warnings are visible and understandable.

---

## Milestone 0.3.0 - Character Splash Art

### Scope
- Add optional image field on character records.
- Show images in team slots and rotation rows.
- Add fallback avatar initial when no image is available.
- Support user images via URL or upload (stored browser-side only).
- Optionally support Enka `/ui/hsr/` links after terms review.
- Add character card + relic grid presentation inspired by optimizer layouts.
- Do not commit HoYoverse-owned game art.

### Acceptance Criteria
- Missing images always show styled fallback without layout breakage.
- Uploaded/URL images persist locally across page reloads.
- Repository contains no bundled proprietary game art.

---

## Milestone 0.4.0 - Better Rotations

### Scope
- Track ultimate energy.
- Simulate speed buffs and action advance.
- Model enemy turns for boss pacing comparison.
- Save multiple rotations.
- Share rotations by link, JSON, or image.

### Acceptance Criteria
- Rotation simulation is deterministic for identical inputs.
- Multiple saved rotations can be switched without data loss.
- Shared payload can be imported and replayed.

---

## Parallel Improvements

### Data Maintenance
- Add optional post-patch character-data refresh from a community dataset (example: kel-z/HSR-Data).

### Quality
- Add unit tests for turn-order and SP math.
- Add CI checks for every commit.

### Release Hygiene
- Tag releases (`v0.0.1`, `v0.1.0`, etc.).
- Maintain changelog entries per milestone.

### Stretch
- Relic assignment optimizer (or external link to Fribbels optimizer).
- Damage calculator.
- Starter team templates.
