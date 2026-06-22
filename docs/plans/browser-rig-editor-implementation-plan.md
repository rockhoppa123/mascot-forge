# Browser Rig Editor (Phase 1) — Implementation Plan

**Status:** 📋 planned. Created 2026-06-20.
**Position:** post-v1.2. First of two phases that bridge the CLI/manual gap toward "upload an image and
it works." **Phase 1 (this plan):** a browser rig editor that replaces hand-authoring `rigged.json`.
**Phase 2 (separate, later):** port P1 vectorize + P2 segment to JS so the whole flow runs client-side
as a public demo. Phase 1 is built so Phase 2 plugs in front of it.

> **Ponytail framing.** The pipeline already works; the only step a human dreads is hand-authoring the
> rig JSON — grouping flat rects into semantic parts, setting pivots, writing animation recipes. That is
> the gap. Phase 1 fixes *only* that, as a **dependency-free static page** (vanilla ESM + SVG, no build,
> Pages-hostable) that sits between `mf forge` and `mf emit` and changes **nothing** in the pipeline. No
> backend, no pipeline port, no timeline editor. Animations come from presets generalised from the two
> rigs that already exist — reuse, not new authoring.

---

## Goal

A user runs `mf forge <asset>` (as today), drags the resulting `segmented.svg` into a browser page,
**visually** assigns regions to named parts, drags pivot handles, picks an animation preset per state,
watches it move, and clicks export — getting a `<asset>-manual-part.svg` + `<asset>-rigged.json` pair
that `mf emit <asset>` consumes unchanged. The tedious, error-prone JSON authoring is gone; what used to
take an hour of hand-editing + round-trips takes minutes, and the output passes `mf check` first time.

## Audience / context

- **Primary: Andrew**, forging his own assets faster (kills the worst per-asset cost).
- **Secondary: Phase 2**, which reuses this editor as the front-end once P1/P2 are ported to JS.
- Not yet a stranger off the internet — that is Phase 2's public-demo goal.

## Research basis (grounded in repo + landscape)

- **The gap is real and the worst step is the rig.** ADR-0002 (assisted-not-full-auto): "AI proposes
  parts, human confirms." The confirm step today = hand-writing `rigged.json` against
  `segmented-review.html`. The Land Rover spike (`spikes/03-second-asset/FINDINGS.md`) named **part-naming
  friction** (forcing vehicle anatomy onto DevBrain's slots) as the genuine cost — a *spatial/labelling*
  task, exactly what a visual editor beats text at.
- **The emitter is already data-driven on parts.** Same FINDINGS: `emit-svg-css.ps1` ran **unchanged** on
  Land Rover ("data-driven on parts"). So an editor that emits arbitrary named parts + recipes referencing
  them will emit fine — no emitter change needed.
- **Part vocabulary is already generalised.** v1.1 (commit `a9e1feb`) generalised the part vocabulary /
  `PART_IDS` / asset identity; `assets/<asset>/parts-spec.json` declares an asset's candidate parts and is
  consumed by `segment-parts.ps1` (`-Spec`). The editor reads it for the initial vocabulary.
- **Exact I/O contract (from `mf.ps1`).** `forge` writes `assets/<asset>/<asset>-segmented.svg` (+ flat +
  review html). `emit` consumes `-SvgPath assets/<asset>/<asset>-manual-part.svg` and `-RigPath
  assets/<asset>/<asset>-rigged.json`. **Editor input = segmented.svg; editor output = that exact pair.**
- **Schema is locked (ADR-0008, `rigged.json` v2):** version 2, `source`, `states`, `accents`, `bones[]`,
  `parts[]` (`id`, `bone`, `origin`, `pivot{x,y}`), `animations{state: recipe[]}`. The editor must emit
  valid v2; `check-buildable-slice.ps1` is the canonical validator.
- **Landscape (README §Why):** browser visual riggers exist (Rive's editor) but emit a **binary `.riv` +
  WASM runtime** — not owned code. mascot-forge's wedge is *owned, editable output*; this editor keeps that
  wedge — it authors a rig that compiles to the user's own SVG+CSS / React+GSAP, not a locked asset.

---

## Design (approved)

**Architecture:** static, dependency-free browser app (vanilla ESM + SVG, no build step — matches
`runtime/` and the existing demos). Lives in `tools/rig-editor/`. Sits between `mf forge` and `mf emit`;
neither changes.

**Data flow:**
```
mf forge <asset>                         (P1 + P2, unchanged) → <asset>-segmented.svg (+ parts-spec.json)
   → drag into editor
[ tools/rig-editor ]  assign/rename parts · set roles · drag pivots · pick presets · live-preview · validate
   → export
<asset>-manual-part.svg  +  <asset>-rigged.json   (consistent v2 pair → assets/<asset>/)
   → mf emit <asset>                     (P3, unchanged) → generated mascot → existing showcase/demos
```

**Components** (each independently testable; pure-logic units have node `assert` tests like
`runtime/mascot-state.test.mjs`):

| Unit | Does | Depends on | Test |
|---|---|---|---|
| **loader** | parse `segmented.svg` → model (rects, P2's proposed groups); merge `parts-spec.json` vocabulary | DOMParser | node: fixture svg → expected model |
| **model** | in-memory rig state at **rect granularity** (so a wrong P2 merge can be split); part membership, roles, pivots, state/preset selection | — | node: assign/split/rename invariants |
| **canvas** | render SVG, colour regions by part, click/marquee select | model | manual / smoke |
| **parts panel** | assign selected regions → part; add/rename/remove; set **role** per part | model | via model tests |
| **pivot tool** | drag handle → `origin` string + `pivot{x,y}` | model | node: drag coords → origin |
| **presets** | `presets.json` (role-keyed recipes generalised from devbrain+land-rover) + picker + live-preview (reuse `runtime/mascot-state.js` + CSS injection, the showcase pattern) | model, runtime | node: preset+part → valid recipe |
| **validator** | pre-flight the ~6 load-bearing v2 invariants | model | node: good rig passes, broken fails |
| **exporter** | serialise model → `manual-part.svg` + `rigged.json` (consistent, `mf` naming) | model | **golden round-trip** (below) |

**Role model (the bit that generalises presets).** Each part gets a **role** — `core` (breathes), `limb`
(walks/rotates), `accent` (shakes/waves/recoils), `passive` (still). The picker offers only
role-appropriate presets; on pick, the editor writes a *concrete* recipe (referencing that part's id) into
`rigged.json.animations`. **Roles are editor-only — they never touch the locked schema**; they only select
which preset gets written. This is the clean Land Rover fix: wheel=`limb`, flag=`accent`, no forced names.

**Validation boundary.** The in-browser validator is a **pre-flight convenience, not a second source of
truth** — `mf check` stays canonical. It re-checks only: schema v2; `states` non-empty; part-ids consistent
between SVG groups and `parts[]`; numeric pivots; every state has ≥1 recipe; recipes reference real parts.
`ponytail:` no shared-schema module — the real gate catches anything the pre-flight misses; extract one only
if drift actually bites.

---

## Decisions

- **D1 — Stack:** vanilla ESM + SVG, zero build, dep-free. *Why:* matches `runtime/`+demos, Pages-hostable
  as-is, and is the literal substrate Phase 2 ports onto. React/Vite would add a build step for no Phase-1
  gain.
- **D2 — I/O boundary:** CLI-bookended (`mf forge` → editor → `mf emit`); no backend. *Why:* bridges the
  worst 80% (the JSON) with the least code; stays static. (Approaches B/backend and C/in-browser-segment
  rejected — backend is throwaway, C pulls Phase 2's hardest port forward.)
- **D3 — Editor scope:** part-structure + pivots + **preset** animations. No visual keyframe/timeline editor
  (own sub-project; would 3–4× Phase 1). Output is a complete runnable rig.
- **D4 — Animation source:** `presets.json` generalised from the two existing rigs, keyed by **role**. Not
  hand-tuned per asset in Phase 1.
- **D5 — Granularity:** model operates at **rect level**, not just P2's proposed groups, so a mis-merged
  proposal can be split. (Verified: `segmented.svg` exposes individual `<rect>`s under each `<g class="part">`.)
- **D6 — Unassigned regions:** every rect must land in `manual-part.svg` or geometry is lost on emit. Rects
  the user leaves unassigned go into a non-animated **`part-background`** group (role `passive`, no recipe),
  so the silhouette always renders. Export is **blocked** only if a rect is in *no* group. *Why:* a mascot
  with a missing limb is a bug; a still background is fine.
- **D7 — parts-spec.json:** the editor **reads** it for the initial vocabulary and, on export, **writes it
  back** (the final part set + roles) next to the rig, so a later `mf forge <asset>` re-proposes the same
  parts instead of reverting to defaults. One small JSON write; keeps forge↔editor idempotent.

---

## Work items (ordered)

**First action:** `pwsh ./mf.ps1 forge land-rover` to produce a real `segmented.svg` fixture, then start
W-scaffold against it (land-rover is the harder case — vehicle anatomy, 3541 rects). Tags: **[A]**
agent-buildable · **[H]** human judgment. Effort rough.

**W-scaffold [A] (~1h)** — `tools/rig-editor/` skeleton: `index.html` + ESM modules, drag-drop a
`segmented.svg`, render it on an SVG canvas. *Accept:* dropping `assets/land-rover/land-rover-segmented.svg`
(or the devbrain one) shows the mascot, and selection/recolour of a multi-thousand-rect asset stays
responsive (≤100ms per select — see Perf risk). *Gate:* loads file-served + over http.

**W-model+loader [A] (~2–3h)** — parse segmented.svg (rects + proposed `<g class="part">`) and
`parts-spec.json` into the rect-granular model; assignment/split/rename/role ops. *Accept:* node test loads
the committed devbrain `segmented.svg` → model has the expected rect count + proposed parts. *Gate:* node test green.

**W-canvas+parts [A] (~3–4h)** — colour regions by part, click/marquee select, parts panel
(assign/add/rename/remove + role). *Accept:* can reassign a region from one part to another and the canvas
recolours; land-rover regions can be (re)named to vehicle anatomy. *Gate:* model tests cover the ops.

**W-pivot [A] (~1–2h)** — draggable pivot handle per part → `origin` string + numeric `pivot{x,y}`, shown
live. *Accept:* node test: a drag to the part's centre yields `origin:"50% 50%"` and matching pivot. *Gate:* node test green.

**W-presets [A] build, [H] feel (~3–4h)** — author `presets.json` from the devbrain+land-rover recipes,
keyed by role; role-appropriate picker; live-preview via `runtime/mascot-state.js` + injected CSS (showcase
pattern). *Accept:* picking idle=breathe/active=walk/alert=shake on assigned parts animates them in-page; a
node test turns (preset, partId) into a schema-valid recipe. *Gate:* node test green; preview visibly moves.

**W-validate [A] (~1–2h)** — in-browser validator of the 6 invariants; block export on failure with a clear
message. *Accept:* node test — the committed devbrain rig passes; a rig with a recipe referencing a missing
part fails with that reason. *Gate:* node test green.

**W-export [A] (~2–3h)** — serialise model → `<asset>-manual-part.svg` + `<asset>-rigged.json` (consistent
pair, `mf` naming) + write-back `parts-spec.json` (D7); download all. Unassigned rects → `part-background`
(D6); export blocked if any rect is ungrouped. *Accept:* **golden round-trip** — load committed devbrain
`segmented.svg`, apply the known devbrain part assignment, export, and assert the result (a) passes the
validator, (b) is **structurally equivalent** to the committed `devbrain-rigged.json` (same
parts/pivots/states/recipe shape), and (c) every input rect appears in exactly one group in the output SVG
(no geometry lost). Then `mf emit devbrain` on the exported pair + `mf check` stays green. *Gate:*
round-trip test green + `mf check` green.
- *Note:* assert **structural**, not byte, equivalence — the committed devbrain rig has hand-refined pivots
  the editor needn't reproduce exactly.

**W-docs [A] (~0.5h)** — `tools/rig-editor/README.md` (forge → edit → emit, with a screenshot) + a link from
the root README and CONTRIBUTING ("Forge an asset" → use the editor instead of hand-writing JSON).
*Accept:* a new reader can follow forge → editor → emit end-to-end. *Gate:* links resolve.

**W-gate [A] (~0.2h)** — `pwsh tools/check-all.ps1` exits 0; all rig-editor node tests pass; editor loads
over http. *Gate:* all green.

---

## Not in Phase 1

- **Porting P1 vectorize / P2 segment to JS** — that is Phase 2 (the public client-side demo).
- **No-terminal upload→download flow** — needs Phase 2's port or a throwaway backend; CLI-bookended is fine now.
- **Visual keyframe/timeline editor** — presets only; a timeline UI is its own project.
- **Hosting/auth/accounts, multi-asset project management, undo-history persistence** — YAGNI for a single-operator tool.
- **New animation states beyond the idle/active/alert triad** — keep the canonical states; generalise states later.

## Open risks

- **Rendering perf (thousands of rects).** Devbrain `segmented.svg` is ~7555 `<rect>`s (land-rover ~3541).
  Per-rect click-hit-testing and full recolour-on-select can jank. Mitigation: assign a part **colour via a
  CSS class on each `<g>`** (recolour = swap one class, not N fills); hit-test with `event.target` +
  `closest('[data-part]')` (browser-native, O(1)), not a manual rect loop; only re-render the changed group.
  W-scaffold's accept criterion gates this (≤100ms/select). If still slow, group-level select is the fallback.
- **Segmented granularity.** Splitting a wrong P2 merge needs rect-level editing — *verified* segmented.svg
  exposes per-rect geometry under each part group, so the model is rect-granular (D5). If some assets emit
  coarser groups, splitting falls back to "reassign whole group."
- **Preset generalisation.** The two source rigs share the 6 DevBrain slots; the preset recipes must be
  written **parameterised by the chosen part id at export**, not copied with hard-coded ids. (W-presets test
  guards this.)
- **Live-preview fidelity.** The in-editor preview uses CSS injection (approximate); the **emit output is the
  source of truth**. Preview is for "does it roughly move right," not pixel fidelity.
- **Validator drift** from the PowerShell gate — accepted; pre-flight only, `mf check` is canonical (D-validation).
- **Golden brittleness.** Asserting byte-identity to the hand-tuned devbrain rig would be flaky; the golden
  asserts structural + validator equivalence instead (W-export note).

## Phase 2 pointer (out of scope, recorded)

When this ships: port `vectorize-pixel.ps1` + `segment-parts.ps1` to JS/WASM so the editor accepts a **raw
image** (not a CLI-produced segmented.svg) and runs the whole pipeline client-side — turning this exact
editor into the public, hostable "upload an image and it works" demo. The rect-granular model, presets,
validator, and exporter all carry over unchanged.
