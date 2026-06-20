# Second-Asset Validation — Implementation Plan

**Status:** 📋 planned. Created 2026-06-18.
**Tracks:** the one real gap left after v1 closed — **the entire pipeline has only ever run on the
single DevBrain mascot.** The product claim is *"image → rigged React mascot **engine**,"* but an engine
proven on one hand-tuned input is one demo. This is a **validation spike**, not a pipeline phase: it adds
**no new capability**. It runs the whole pipeline on a *second, different* mascot PNG and records exactly
where v1 generalises, where it needs a parameter or a human, and where it is hard-coded to DevBrain.

> **Ponytail framing.** The job is to **find where the engine bends, not to fix it.** Use the tools'
> existing parameters; where a tool is hard-coded to DevBrain geometry, **record the gap and proceed with a
> manual workaround** — do not refactor the engine inside a validation spike. No new tool, no new
> dependency, no automation of the human-assisted rig step (that step is assisted *by design* — ADR-0002).
> The deliverable is a second mascot rendered in both targets across `idle/active/alert` **plus** an honest
> friction catalogue and a v1.1 generalisation backlog — not new code in the engine.

---

## Goal

Run the full pipeline end-to-end on a second mascot —
`PNG →[P1 vectorize]→ flat.svg →[P2 segment + human confirm]→ named parts + pivots →[author rigged.json]→
[P3 emit]→ SVG+CSS & React+GSAP →[P4 orchestrate]→ data-reactive mascot` — and answer three questions:

1. **Which steps run unchanged (fully auto)?** Expected: vectorize, emit (both targets), orchestrate.
2. **Which need only parameters or human input?** Expected: palette tuning (P1), segmentation confirm /
   rename (P2), and `rigged.json` authoring (the assisted step).
3. **Which are hard-coded to the DevBrain asset and would need engine changes to generalise?** Expected:
   the P2 part-naming heuristics (`segment-parts.ps1` tunes names to body/eyes/moustache/antenna/legs).
   Record each as a v1.1 backlog item — do **not** fix here.

The load-bearing result: **does one `rigged.json` schema (v2) + the two emitters + the orchestrator runtime
carry an asset they have never seen, without engine edits?** If yes, it is an engine. If no, the spike says
precisely why.

---

## Prerequisite (Step 0 — a real blocker)

A **second mascot PNG**, provided by Andrew, placed under `assets/<name>/` as that asset's **Clean Mascot
Source** — **read-only**, like DevBrain's. It must be a *different* character (different parts, palette,
size) or the test proves nothing. **Do not generate or derive art.** If no second asset is available, the
spike is **blocked → flag it and stop.**

---

## What is exercised (reuse + parameterise — do not rebuild)

| Tool | Role | Expected generality |
|---|---|---|
| `tools/vectorize-pixel.ps1` | PNG → flat `<rect>` SVG (median-cut quantization) | Auto, but the `-Palette`/threshold params likely need per-asset tuning. Record the working params. |
| `tools/segment-parts.ps1` | CCL over flat.svg → **proposed** named parts + pivots + review page | Auto-propose generalises; **part naming is DevBrain-tuned** → expect mislabels. Confirm/rename via the review HTML; catalogue the friction. |
| (human) author `rigged.json` | schema v2: pivots + `idle/active/alert` channel recipes for the new parts | The assisted step (ADR-0002). Prove **schema v2 needs no change** to describe a new mascot. |
| `tools/emit-svg-css.ps1` + `tools/emit-react-gsap/` | one rig → both targets around identical pivots | Should be fully auto if the rig is valid — the headline generality claim. |
| `runtime/mascot-state.js` + `useMascotState.ts` | data-driven `idle/active/alert` state machine | State names are generic → expect **zero edits**; reuse byte-unchanged. |

---

## Planned files (ponytail audit — everything isolated under `spikes/03-second-asset/`)

| File | Action | Why |
|---|---|---|
| `assets/<name>/` (source PNG + README pointer) | **new (Andrew-provided)** | The second Clean Mascot Source, read-only. |
| `spikes/03-second-asset/generated/` (flat / segmented / emitted SVG+CSS + React build) | **new** | All pipeline output for the new asset, isolated from the **locked** `docs/buildable-slice/`. |
| `spikes/03-second-asset/<name>-rigged.json` | **new (hand-authored, schema v2)** | The assisted rig for the new mascot. |
| `spikes/03-second-asset/FINDINGS.md` | **new** | Generality verdict + per-step friction catalogue + v1.1 backlog. **The deliverable.** |
| `docs/research/research-log.md` | **edit** | One build-trail row recording the run + outcome (and a new open question only if a real gap surfaces). |

**Deliberately skipped (YAGNI):** no engine refactor to "fix" the naming heuristics (→ v1.1 backlog), no new
tool, no automation of rig authoring, no new dependency, no CI, no edits to any DevBrain locked artifact or
the shared runtime.

---

## Implementation steps

1. **Step 0** — place the second PNG under `assets/<name>/` (read-only). If absent, stop and flag.
2. **P1** — run `vectorize-pixel.ps1` against it (output into the spike dir); tune palette/threshold until
   silhouette + accents survive; **record the params that worked**.
3. **P2** — run `segment-parts.ps1` on the new flat.svg (output into the spike dir); open the review page;
   record **what CCL proposed vs what the parts actually are**; confirm/rename. Catalogue every mislabel.
4. **Author `<name>-rigged.json`** (schema v2) — pivots + `idle/active/alert` recipes for the new parts.
   **Prove the schema is unchanged**; if it can't express the mascot, that is a finding (stop & ask before
   changing the schema).
5. **Emit both targets** into the spike dir; verify both render around **identical pivots** (reuse the
   cross-target fidelity approach from Spike 01 — the probe/golden compare, not a new tool).
6. **Orchestrate** — point `runtime/mascot-state.js` (reused, unedited) at a mock feed for the new mascot;
   verify `idle/active/alert` reactivity, as Phase 4 did for DevBrain.
7. **`FINDINGS.md`** — per-step generality verdict, the friction catalogue, the v1.1 backlog. **research-log**
   build-trail row.

---

## Verification

- Both targets render the **new** mascot across `idle/active/alert` — one preview screenshot per target.
- `rigged.json` **schema v2 unchanged** (no new fields invented to make it work; if needed → it's a finding).
- **DevBrain locked artifacts byte-unchanged** and **`runtime/mascot-state.js` byte-unchanged** (reused, not
  edited) — confirm via hashes / `git status`.
- All new output lives under `spikes/03-second-asset/` and `assets/<name>/`; nothing written into
  `docs/buildable-slice/`.
- Scan new/changed files for TODO/TBD/FIXME.

---

## Non-goals (explicit)

- **Not fixing** the DevBrain-tuned heuristics — gaps go to the v1.1 backlog, not into engine code.
- **No new tool, no new dependency, no CI, no second engine.**
- **No automation** of the assisted rig-authoring step (assisted is the design — ADR-0002).
- **No edits** to any DevBrain locked artifact, any ADR, or the shared runtime.

---

## Expected outcome

Vectorize, emit, and orchestrate generalise cleanly with no engine edits (the load-bearing proof). P1 palette
and P2 naming are the parameter/human touch-points, and `rigged.json` authoring is the assisted step — all as
designed. The spike produces a **v1.1 generalisation backlog** (most likely: data-drive the P2 part names) and
upgrades the project's central claim from *"one good demo"* to *"an engine that survives a second asset."* If a
step needs an engine change just to run, that is the single most valuable thing this spike can surface — and it
stops to ask rather than quietly patching it.
