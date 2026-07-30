# Second-Asset Validation — fresh-agent implementation prompt

> Copy everything below the line into a fresh Claude Code session at
> `C:\Users\student1\Dev\mascot-forge`. Companion design doc:
> [`docs/second-asset-validation-implementation-plan.md`](../plans/second-asset-validation-implementation-plan.md).

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the whole task. This is a **validation
spike, not a feature.** v1 is feature-complete (Phases 1–4 + 6 shipped, Q1–Q6 all resolved). Your job is to
**find where the engine bends on a new asset, not to fix it.** Use the tools' existing parameters; where a
tool is hard-coded to the DevBrain mascot, **record the gap and proceed with a manual workaround** — do NOT
refactor the engine inside a validation spike. The deliverable is a second mascot rendered in both Output
Targets across `idle/active/alert` PLUS an honest friction catalogue and a v1.1 backlog — NOT new engine code.

You are running the **Second-Asset Validation spike** for mascot-forge in C:\Users\student1\Dev\mascot-forge.
The whole pipeline has only ever run on one asset (DevBrain). This spike runs it on a *second, different*
mascot to prove the engine generalises. Only make changes directly required by this spike. Do NOT add
pipeline capability, dependencies, tools, CI, or a second engine.

## Context (carry forward — v1 is complete)
- Pipeline shipped: `PNG →[P1 vectorize]→ flat.svg →[P2 segment + human confirm]→ named parts + pivots →
  [author rigged.json]→[P3 emit]→ SVG+CSS & React+GSAP →[P4 orchestrate]→ data-reactive mascot.`
- The pipeline is **assisted, not full-auto** (ADR-0002): P2 *proposes* parts for a human to confirm, and
  `rigged.json` is **hand-authored**. Those human steps are by design — do not try to automate them.
- Schema v2 (ADR-0008): one `rigged.json` (canonical pivots + structured channel keyframes + explicit
  yoyo/iteration) drives BOTH emitters around identical pivots. The central claim under test is that this
  schema + the two emitters + the orchestrator runtime carry an unseen asset **without engine edits**.
- LOCKED — MUST NOT be edited or overwritten: everything under `docs/buildable-slice/` (devbrain-rigged.json,
  devbrain-manual-part.svg, all `generated/*`, all goldens), both emitters (`emit-svg-css.ps1`,
  `tools/emit-react-gsap/` source), the shared runtime (`runtime/mascot-state.js`,
  `tools/emit-react-gsap/src/useMascotState.ts`), and every ADR. You REUSE these unchanged; you do not change
  them. The DevBrain Clean Mascot Source PNG is read-only/external — never touch it.

## 0. Read first (do not skip)
- `docs/second-asset-validation-implementation-plan.md` — the full design (goal, prerequisite, file map,
  ponytail audit). This prompt is the operational summary; the plan is the detail.
- `docs/technical-proposal.md` §2–§5 (the four phases) and §7 (build plan, all ✅).
- `docs/adr/0002-assisted-not-full-auto.md` and `docs/adr/0008-rigged-json-schema-v2-lock.md`.
- `spikes/01-emitter/FINDINGS.md` — the house style for a spike write-up AND the cross-target pivot-fidelity
  check to reuse. `spikes/02-runtime-cost/FINDINGS.md` — recent house style.
- The **param block + leading comment** of each tool you will run (small files): `tools/vectorize-pixel.ps1`,
  `tools/segment-parts.ps1`, `tools/check-segmented.ps1`, `tools/emit-svg-css.ps1`, and
  `tools/emit-react-gsap/` (`src/emit.ts`, `demo/main.tsx`, `vite.config.ts`). Learn the actual parameter
  names from the source — do not guess them.

## 1. Goal
Run the full pipeline on a second mascot and answer: (1) which steps run **unchanged/auto** (expect
vectorize, emit, orchestrate)? (2) which need only **a parameter or a human** (expect P1 palette, P2 confirm,
rig authoring)? (3) which are **hard-coded to DevBrain** and would need an engine change to generalise (expect
P2 part-naming) — recorded as a v1.1 backlog, NOT fixed here.

## 2. Prerequisite (a real blocker — Step 0)
A **second mascot PNG from Andrew**, placed under `assets/<name>/` as that asset's read-only Clean Mascot
Source. Must be a genuinely different character (different parts/palette/size). **Do NOT generate or derive
art.** If no second asset is present in the repo or supplied, **STOP and ask Andrew for the PNG** — the spike
cannot start without it.

## 3. Deliverables (ponytail: all isolated under `spikes/03-second-asset/`)
- **`assets/<name>/`** — the source PNG (Andrew-provided) + a one-line README pointer. Read-only source.
- **`spikes/03-second-asset/generated/`** — all pipeline output for the new asset (flat.svg, segmented.svg +
  review.html, emitted SVG+CSS, the React build). Isolated from the LOCKED `docs/buildable-slice/`.
- **`spikes/03-second-asset/<name>-rigged.json`** — the hand-authored schema-v2 rig for the new mascot.
- **`spikes/03-second-asset/FINDINGS.md`** — generality verdict answering the three questions + a per-step
  friction catalogue + the v1.1 backlog. Mirror `spikes/01-emitter/FINDINGS.md`.
- **`docs/research/research-log.md` (edit)** — one build-trail row recording the run + outcome. Add a new
  open question ONLY if a real generalisation gap surfaces that deserves tracking.

## 4. Method (follow the plan)
1. **P1 vectorize** the new PNG (output into `spikes/03-second-asset/generated/`); tune `-Palette`/threshold
   until silhouette + accents survive; **record the working params**.
2. **P2 segment** the new flat.svg (output into the spike dir); open the review page; **record what CCL
   proposed vs the real parts**; confirm/rename. `check-segmented.ps1` may itself be DevBrain-tuned — if it
   fails on the new asset, that is a finding (run it, note the failure, proceed).
3. **Author `<name>-rigged.json`** (schema v2) — pivots + `idle/active/alert` recipes for the new parts.
   **Prove schema v2 is unchanged.** If the schema genuinely cannot express the mascot, STOP and ask before
   adding any field.
4. **Emit both targets** into the spike dir (`emit-svg-css.ps1` with the new paths; build the React target
   for production as in Spike 02). Verify both render around **identical pivots** — reuse Spike 01's probe /
   compare approach; do not build a new checker.
5. **Orchestrate** — point the reused, **unedited** `runtime/mascot-state.js` at a mock feed for the new
   mascot; verify `idle/active/alert` reactivity (as Phase 4 did for DevBrain).
6. **FINDINGS.md** + **research-log** row.

## 5. Verify
- Both targets render the **new** mascot across `idle/active/alert` — one preview screenshot per target (do
  not ask the human to imagine it).
- `rigged.json` schema v2 unchanged (no invented fields; if needed it's a flagged finding).
- **DevBrain locked artifacts byte-unchanged** and **`runtime/mascot-state.js` byte-unchanged** — confirm via
  hashes + `git status`. Nothing written into `docs/buildable-slice/`.
- Scan new/changed files for TODO/TBD/FIXME.

## 6. Constraints / non-goals
- NO new pipeline capability — validation only. NO fixing the DevBrain-tuned heuristics (→ v1.1 backlog).
- NO new tool, NO new dependency, NO CI, NO second engine, NO automation of the assisted rig step.
- NO edits to any DevBrain locked artifact, any ADR, the emitters, or the shared runtime — you REUSE them.
- NO generated/derived art. NO npm at the repo root (the React project keeps its own `package.json`).

## 7. Stop and ask before
- starting without a real second PNG (Step 0 blocker).
- changing the `rigged.json` schema, any emitter, the runtime, or any ADR/locked artifact to make a step run.
- adding any dependency, tool, or CI.
- refactoring a heuristic instead of recording it as a v1.1 backlog item.

## 8. Checkpoints
- After reading the plan + ADR-0002/0008 + confirming the second PNG exists: output a 3–5 line ponytail plan
  (the laziest path to a second mascot rendered in both targets), then proceed.
- After each deliverable: ✅ [what was completed].

## 9. Report back
The second asset used; the P1 params that worked; what P2's CCL proposed vs the real parts (the naming
friction); whether schema v2 carried the new mascot unchanged; the two preview screenshots (both targets ×
states); whether the orchestrator runtime worked byte-unchanged; the per-step generality verdict on the three
questions; the v1.1 backlog; confirm DevBrain locked artifacts + runtime byte-unchanged; note whether this
upgrades the claim to "an engine that survives a second asset."
