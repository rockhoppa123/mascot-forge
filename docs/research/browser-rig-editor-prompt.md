# Browser Rig Editor (Phase 1) — fresh-agent implementation prompt

> Copy everything below the line into a fresh Claude Code session rooted at
> `C:\Users\student1\Dev\mascot-forge`. Your deliverable is **working code + tests**,
> built work-item by work-item from an existing plan. Build the plan as written; do not
> re-plan or re-architect. If you find the plan genuinely wrong mid-build, stop and flag it.

---

Invoke the ponytail skill (`/ponytail`) FIRST and keep it active for the whole task. Use
test-driven development: every pure-logic unit gets its node `assert` test written/red before
the implementation (mirror `runtime/mascot-state.test.mjs` — no framework, no fixtures dir).

You are implementing **Phase 1: the browser rig editor** for mascot-forge. The full spec +
design + work items are already written and plan-optimised in:

**`docs/browser-rig-editor-implementation-plan.md` — read it first; it is your source of truth.**

mascot-forge forges a flat image into an owned, animated SVG+CSS / React+GSAP mascot via a
PowerShell pipeline with a mandatory human rig-authoring step. This editor replaces that one
painful manual step (hand-writing `rigged.json`) with a dependency-free static browser tool that
sits between `mf forge` and `mf emit`. Nothing in the pipeline changes.

## 0. Read first (in this order, do not skip)

1. `docs/browser-rig-editor-implementation-plan.md` — the plan. Decisions D1–D7 and work items
   W-scaffold → W-gate are locked; build them in order.
2. `mf.ps1` — the exact I/O contract: `forge` writes `assets/<asset>/<asset>-segmented.svg`;
   `emit` consumes `<asset>-manual-part.svg` + `<asset>-rigged.json`. Your editor's input is the
   first; its output is that pair (+ `parts-spec.json` write-back, D7).
3. `tools/segment-parts.ps1` — what produces `segmented.svg` and how it uses `parts-spec.json` (`-Spec`).
4. `assets/land-rover/parts-spec.json` + `assets/land-rover/land-rover.png` — the asset input contract
   and your primary test fixture (the harder, vehicle-anatomy case).
5. `docs/buildable-slice/devbrain-rigged.json` — the schema v2 target the exporter must produce; the
   **golden** for the round-trip test (W-export).
6. `docs/buildable-slice/devbrain-manual-part.svg` — the other half of the exporter output (grouped parts
   with `data-origin` / `data-pivot-*`).
7. `tools/check-buildable-slice.ps1` — the **canonical** rig validator. Your in-browser validator (W-validate)
   re-implements only its ~6 load-bearing invariants as a pre-flight; this script stays the real gate.
8. `runtime/mascot-state.js` + `runtime/mascot-state.test.mjs` — reuse the orchestrator for live-preview;
   copy the test style verbatim.
9. `docs/buildable-slice/showcase.html` — the fetch+inject + CSS-namespacing pattern to reuse for the
   editor's live-preview panel.
10. `spikes/03-second-asset/FINDINGS.md` — why part-naming friction is the gap and why the emitter is
    already data-driven on parts (so arbitrary named parts emit fine).
11. ADR-0002 (assisted), ADR-0008 (rigged.json v2 lock) in `docs/adr/`.

## 1. Build order (from the plan — gate green between each)

**First action:** `pwsh ./mf.ps1 forge land-rover` to produce a real `segmented.svg` fixture.

Then, in order, each with its node test red→green and `pwsh tools/check-all.ps1` still green:
`W-scaffold → W-model+loader → W-canvas+parts → W-pivot → W-presets → W-validate → W-export → W-docs → W-gate`.

Live in `tools/rig-editor/` (vanilla ESM + SVG, **zero build, no new dependency** — D1). Do not add React,
a bundler, or a backend.

## 2. Hard constraints (the plan's locked decisions — do not relitigate)

- **Dep-free static page**, Pages-hostable; no build step (D1).
- **CLI-bookended**, no backend (D2). The editor loads a `segmented.svg`, exports the pair; the human runs
  `forge`/`emit` around it.
- **Presets, not a timeline editor** (D3/D4): `presets.json` keyed by **role** (`core`/`limb`/`accent`/`passive`),
  generalised from the devbrain + land-rover recipes, written **parameterised by the chosen part id** at export.
- **Rect-granular model** (D5) — splitting a wrong P2 merge must work at `<rect>` level.
- **Every rect must land in a group** (D6) — unassigned → `part-background` (passive, no recipe); block export
  if any rect is ungrouped. The W-export test asserts no geometry is lost.
- **Write `parts-spec.json` back** on export (D7) so re-forge is idempotent.
- **Roles never touch the locked schema** — they only select which preset recipe gets written.
- **Perf:** recolour by swapping a CSS class on each `<g>`, hit-test via native `closest('[data-part]')`, not
  manual rect loops; keep select ≤100ms on the ~7555-rect devbrain asset.

## 3. Definition of done

- `tools/rig-editor/` loads a `segmented.svg`, lets you assign/rename parts + roles, drag pivots, pick presets,
  live-preview motion, and export a valid `manual-part.svg` + `rigged.json` (+ `parts-spec.json`).
- **Golden round-trip green** (W-export): committed devbrain `segmented.svg` + known assignment → export that
  (a) passes the in-browser validator, (b) is structurally equivalent to `devbrain-rigged.json`, (c) loses no rect.
- `mf emit devbrain` on the exported pair works and `pwsh tools/check-all.ps1` exits 0.
- All `tools/rig-editor/` node tests pass; editor loads over http.
- `tools/rig-editor/README.md` + a link from the root README/CONTRIBUTING ("forge → edit → emit").

## 4. Owner (Andrew) tasks — flag, don't attempt

- **Preset *feel*** (W-presets [H]): the initial `presets.json` values are agent-derived from the two existing
  rigs; final motion taste is Andrew's to tune.
- **Hero/screenshot** of the editor for the README — a human captures it in a browser.

## 5. Out of scope (Phase 2 / later — do not build)

Porting P1 vectorize / P2 segment to JS; a no-terminal upload→download flow; a visual keyframe/timeline editor;
hosting/auth/accounts; animation states beyond idle/active/alert. Record nothing new here — the plan's
"Phase 2 pointer" already captures the handoff.

Build the work items in order, keep the gate green, and stop at W-gate.
