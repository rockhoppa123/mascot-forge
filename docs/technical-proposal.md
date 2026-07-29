# Technical Proposal — mascot-forge

> **Document type:** Technical Proposal / Architecture
> **Project code:** MASCOT-FORGE
> **Author:** Andrew Lawson
> **Date:** 2026-06-17
> **Status:** Draft for review
> **Companion:** [`product-discovery.md`](product-discovery.md) (problem & scope) ·
> [`research/landscape.md`](research/landscape.md) (prior art) ·
> [`adr/`](adr/) (decisions)

---

## 1. Architecture overview

mascot-forge is a **four-phase pipeline**. Each phase has a clean input/output contract
so phases can be developed, tested, and swapped independently. The novel value is
concentrated in Phases 2–3; Phases 1 and 4 lean heavily on mature open-source pieces.

```
            ┌─────────────────────────────────────────────────────────────┐
            │                      mascot-forge pipeline                    │
            └─────────────────────────────────────────────────────────────┘

  image.png ─▶ [P1: Ingest & Vectorize] ─▶ flat.svg
                                              │
            ┌─────────────────────────────────┘
            ▼
  flat.svg ─▶ [P2: Assisted Segmentation] ─▶ rigged.json  (parts + transform-origins)
                       ▲                          │
                  human confirm                   │
            ┌─────────────────────────────────────┘
            ▼
  rigged.json ─▶ [P3: Rig & Emit] ─▶  Mascot.tsx (+ GSAP)   ◀── pluggable
                                  └──▶  mascot.svg + .css        emitter
                                              │
            ┌─────────────────────────────────┘
            ▼
  component ─▶ [P4: State Orchestrator] ─▶ state machine + data-binding hook
```

The intermediate artifacts (`flat.svg`, `rigged.json`) are **first-class files**: they
can be inspected, hand-edited, version-controlled, and re-run, which keeps every phase
debuggable and the human able to intervene at any boundary.

---

## 2. Phase 1 — Ingest & Vectorize

**Goal:** turn the raster image into a clean, layer-able SVG with as few, as meaningful
shapes as possible.

**Approach (decision: pixel-art first — [ADR-0005](adr/0005-pixel-art-poc-first.md), amended
by [ADR-0009](adr/0009-vectorize-quantize-anti-aliased-source.md)):**

- **Quantized colour-cluster path (v1, shipped):** the Clean Mascot Source turned out to be
  an anti-aliased raster (2,381 colours), not flat pixel art, so exact same-colour clustering
  degenerates to ~1 rect per pixel. v1 instead quantizes to a small palette via deterministic
  median-cut (largest-gap split, which preserves small accents like the green antenna tip),
  then RLE + greedy-meshes equal runs into `<rect>`s (prior art: GLORP, pixel2svg). Output is
  a faithful colour-clustered reduction, not bit-exact. Dependency-free
  (`tools/vectorize-pixel.ps1`, PowerShell + `System.Drawing`). The exact pixel-RLE path
  remains valid for genuinely flat inputs.
- **General flat-art path (later):** **VTracer** (Rust, MIT). Chosen over Potrace
  because Potrace is black-and-white only and O(n²); VTracer is O(n), does K-means
  **colour clustering** into stacked layers, produces 30–70% smaller output than Adobe
  Image Trace, and explicitly supports pixel art. Its per-colour layering is a useful
  *head start* on segmentation (Phase 2).

**Clean-Mascot-Source contract**

Source must be a transparent PNG, flat/pixel-art-friendly (no gradients, no anti-aliased edges).
Oversized sources must be downscaled with **nearest-neighbor** interpolation (not bicubic) before vectorizing. Bicubic blends flat cartoon colours into smooth gradients; the median-cut quantizer (ADR-0009 largest-gap split) then slices each gradient into visible colour bands ("hatching"). Nearest-neighbor preserves hard colour edges so vertical runs merge and no banding occurs.

Reference: `spikes/03-second-asset/prep-source.ps1` for a worked background-keying + nearest-neighbor downscale example.

**Output contract:** `flat.svg` — a single SVG, colours preserved, geometry grouped by
colour cluster, viewBox matching source dimensions.

**Why not a VLM here:** vectorization is a solved, deterministic problem. Spending an
AI call on it would add cost, latency, and nondeterminism for no quality gain.

---

## 3. Phase 2 — Assisted Semantic Segmentation

**Goal:** group the flat geometry into **named, anatomically meaningful parts**
(`body`, `leg_left`, `leg_right`, `antenna`, `arm_left`…) — the step vectorizers skip and
the reason their output can't articulate.

**Decision: human-in-the-loop, not full-auto
([ADR-0002](adr/0002-assisted-not-full-auto.md)).** Fully automatic 2D rigging from a
single image is unsolved research (UniRig, RigAnything, Adobe diffusion — all 2024–2025,
mostly 3D). We therefore *assist*, not *replace*, the human:

1. **Propose.** Generate candidate part groupings. Two strategies, cheapest first:
   - **Colour-cluster + connected-components** (no ML): for pixel art / flat art, parts
     are often already separable by colour + spatial connectivity. Likely sufficient for
     the DevBrain mascot.
   - **VLM / SAM(2) masks** (when colour alone fails): use Segment Anything to propose
     masks and a vision-language model to *name* them. This is the heavier, optional path.
2. **Confirm.** Present proposed parts in a minimal review UI; the human merges/splits/
   renames with a few clicks.
3. **Anchor.** For each confirmed part, compute a **transform-origin** (pivot) — the
   default heuristic is the joint where the part meets its parent (e.g. leg pivots at the
   hip line, antenna at its base). Human can nudge.

**Output contract:** `rigged.json` — modelled on **Spine's proven skeleton JSON** (see
[research-log Q4](research/research-log.md)): an ordered `bones` array (parent listed
before child), each bone `{ name, parent, x, y, rotation, length }`; SVG part nodes attach
to a bone and inherit its transform. Transform inheritance (rotate/translate/scale
cascading to children) matches both Spine and Rive, so motion like a hip rotation
naturally carries the lower leg.

**Segmentation method (decided — [research-log Q2](research/research-log.md)):** for
colour-separable pixel/flat art, **colour threshold → connected-component labeling (CCL)**
is sufficient and deterministic; **SAM2** (Apache-2.0, MIT-compatible) is reserved as the
fallback only when colour alone can't separate parts.

---

## 4. Phase 3 — Rig & Emit (pluggable backend)

**Goal:** generate the actual deliverable from `rigged.json`.

**Decision: pluggable emitter ([ADR-0003](adr/0003-pluggable-emitter.md)).** The output
target is an open research question (resolved per-need), so the rigging step is
emitter-agnostic and emitters are swappable plugins implementing one interface:

```
interface Emitter {
  name: string
  emit(rigged: RiggedModel, states: StateSpec[]): EmittedFiles
}
```

Two emitters planned for v1:

| Emitter | Output | Best for | Notes |
|---|---|---|---|
| `react-gsap` | `Mascot.tsx` + GSAP timelines | Rich, sequenced, interruptible state animations | GSAP is now **100% free incl. all plugins** (MorphSVG, DrawSVG) since Apr 2025 — no licensing risk. Inline SVG with semantic `<g id="...">` groups; timelines key on transform-origins from Phase 2. |
| `svg-css` | `mascot.svg` + `mascot.css` (+ tiny JS for state) | Lightest footprint, framework-agnostic, zero JS for idle | CSS keyframes + custom properties; hardware-accelerated `translate3d`. No runtime dependency. |

Both consume the same `rigged.json`, so adding a third emitter (e.g. Web Components,
Vue) later costs only the emitter, not the pipeline.

**Output contract:** `EmittedFiles` — the component/asset files plus a manifest of the
state names it supports (handed to Phase 4).

---

## 5. Phase 4 — State Orchestrator

**Goal:** make the mascot *react to live data*, not just loop.

- A small **state machine** maps named behavioural states (`idle`, `active`, `alert`) to
  the animations the emitter produced, with transition rules (e.g. debounce, priority so
  `alert` interrupts `idle`).
- A thin **data-binding hook** (`useMascotState(source)`) reads a data source — a JSON
  poll, WebSocket, or (for DevBrain) the existing telemetry feed — and drives the state
  machine. Source is injectable so the mascot is reusable outside DevBrain.
- **Performance posture** (carried from the original draft, which got this right):
  prefer CSS hardware-accelerated transforms for simple idle loops (zero JS on the main
  thread); spin up GSAP timelines only for complex, event-driven transitions. To be
  validated by a spike on low-power dashboard clients.

**Output contract:** a documented runtime API: `setState(name)`, `bind(source)`, and the
React hook.

---

## 6. Technology stack (proposed)

| Concern | Choice | Rationale |
|---|---|---|
| Pipeline language | **Node/TypeScript** | Author targets a JS/React output; one language end-to-end lowers the barrier. Python only if a CV/ML step (SAM) demands it — kept behind a subprocess boundary. |
| Pixel-art vectorize | RLE/greedy-mesh (own, small) | Deterministic, exact, no heavy dep. |
| General vectorize | **VTracer** (Rust CLI/WASM, MIT) | Fast, colour-aware, MIT-compatible. |
| Optional segmentation | **SAM / SAM2** + a VLM | Only when colour-clustering is insufficient. |
| Animation runtime | **GSAP** (free) and/or CSS | Per emitter; GSAP now fully free. |
| Distribution | npm package + CLI | Library-first; matches portfolio/dev-tool framing. |
| Tests | unit per phase + a golden-file test on the DevBrain asset | Each phase's I/O contract is independently testable. |

All proposed dependencies are MIT/permissive — compatible with this project's MIT licence
([ADR-0004](adr/0004-mit-license.md)). License compatibility to be re-verified before
adding each dependency.

---

## 7. Build plan (incremental, de-risked)

The order front-loads the riskiest unknowns and keeps a working artifact at every step.

1. ✅ **Spike — emitter shoot-out (done 2026-06-17).** Built the DevBrain mascot as both
   (a) React+GSAP and (b) SVG+CSS by hand from a shared segmented SVG. Resolved the output
   question empirically (ADR-0007: both; SVG+CSS default) and produced the golden target.
   See `spikes/01-emitter/FINDINGS.md`.
2. ✅ **Phase 3 (codegen) — done 2026-06-17.** One `rigged.json` (schema **v2**: canonical
   pivots + structured channel keyframes + explicit yoyo/iteration) drives both emitters.
   **SVG+CSS emitter** (`tools/emit-svg-css.ps1`) and **React+GSAP emitter**
   (`tools/emit-react-gsap/`, live-verified) both reproduce the spike golden around
   identical pivots. Schema-lock recorded in [ADR-0008](adr/0008-rigged-json-schema-v2-lock.md).
3. ✅ **Phase 1 (vectorize) — done 2026-06-18.** `tools/vectorize-pixel.ps1` turns the
   read-only Clean Mascot Source PNG into `docs/buildable-slice/generated/devbrain-flat.svg`
   — colour-clustered `<rect>` geometry, deterministic. The source is anti-aliased (2,381
   colours), not flat pixel art, so v1 vectorizes by **deterministic colour quantization**
   (median-cut, largest-gap split), recorded in
   [ADR-0009](adr/0009-vectorize-quantize-anti-aliased-source.md) (amends 0005). Default
   palette 6 → 89 rects (98.8% reduction), silhouette + accents preserved. Plan:
   [`phase-1-vectorize-implementation-plan.md`](plans/phase-1-vectorize-implementation-plan.md).
4. ✅ **Phase 2 (assisted segmentation) — done 2026-06-18.** `tools/segment-parts.ps1`
   *proposes* named parts from `devbrain-flat.svg` by **connected-component labeling over the
   palette-thresholded `<rect>` geometry** (deterministic, no ML/SAM — `data-render-method=
   "ccl-color-threshold"`), names candidates by geometry, and defaults each pivot to the
   parent-joint. Output is `devbrain-segmented.svg` + a `devbrain-segmented-review.html`
   confirm page for the human (ADR-0002: assisted, not full-auto). `tools/gate/check-segmented.mjs`
   guards the artifact. Naming rules are tuned to the single DevBrain input and generalise
   when a second asset exists — friction reported, not hidden.
5. ✅ **Phase 4 (orchestrator) — done 2026-06-18.** Dependency-free state machine
   (`runtime/mascot-state.js`) + binding hook (`tools/emit-react-gsap/src/useMascotState.ts`)
   driving the locked Output Target from a (mock) telemetry feed under priority + hysteresis
   rules; node determinism self-check green. Plan:
   [`phase-4-orchestrator-implementation-plan.md`](plans/phase-4-orchestrator-implementation-plan.md).
6. ✅ **Polish & demo — done 2026-06-18.** Truthful README + Run/Quickstart, one-command
   `tools/check-all.ps1` over all five checks, and a static before/after showcase
   (`docs/buildable-slice/showcase.html`) contrasting the flipbook PNG with the forged,
   data-reactive mascot. Packaging only — no new pipeline capability. Plan:
   [`phase-6-polish-demo-implementation-plan.md`](plans/phase-6-polish-demo-implementation-plan.md).

Rationale: building **Phase 3 before Phases 1–2** means the hardest-to-verify creative
parts (segmentation) feed a *known-good* code generator, so failures are isolated.

---

## 8. Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auto-segmentation unreliable | High | High | Human-in-loop confirm; colour-cluster first; pixel-art keeps parts separable |
| Output-format indecision stalls work | Medium | Medium | Pluggable emitter + Step-1 spike decides empirically, not in the abstract |
| Vector artifacts on scale | Medium | Medium | Pixel-art `<rect>` grid is exact; VTracer for flat art only |
| Main-thread jank on weak clients | Medium | Medium | CSS for idle loops; GSAP only on events; spike on real dashboard hardware |
| GSAP licensing | **None** | — | GSAP 100% free incl. plugins since Apr 2025 |
| Solo-dev / student bandwidth | High | High | Tight v1 scope; one asset; maximise reuse of OSS; phase contracts allow stop/resume |
| "Reinventing Rive" perception | Medium | Low | Clear positioning: *owned code*, not a runtime; documented in README + landscape.md |

---

## 9. Open questions (tracked)

1. ~~React+GSAP vs SVG+CSS vs both for v1?~~ **Resolved (ADR-0007):** both; SVG+CSS default,
   React+GSAP opt-in for interruptible/rich React mascots. Settled empirically by Spike 01.
2. ~~Does pixel art need SAM?~~ **Resolved:** colour threshold + CCL is enough; SAM2 (Apache-2.0) is fallback only.
3. ~~GSAP vs CSS runtime cost on low-power dashboard clients?~~ **Resolved (validates ADR-0007):**
   18-cell CPU-throttle benchmark — SVG+CSS = 0 main-thread long tasks / 0 ms scripting at every
   throttle (pure compositor); React+GSAP pins the main thread at ~13 fps under 6×. SVG+CSS-default
   holds. One-device hardware calibration flagged as follow-up. See `spikes/02-runtime-cost/FINDINGS.md`.
4. ~~`rigged.json` schema?~~ **Resolved:** adopt the Spine bones-array model (parent-before-child, transform inheritance).
5. ~~Where the human-confirm UI lives — CLI + preview or a local web app?~~ **Resolved:** CLI +
   a static browser-preview review page (`devbrain-segmented-review.html`), no server/app. Settled
   by the Phase-2 implementation; matches ADR-0002 (assisted) and the dependency-light house style.

These are logged with their research status in
[`research/research-log.md`](research/research-log.md).
