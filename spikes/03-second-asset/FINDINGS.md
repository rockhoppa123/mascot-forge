# Spike 03 — Second-Asset Validation: Findings

**Date:** 2026-06-19
**Question settled:** Does the v1 engine — one `rigged.json` schema (v2) + the two emitters
(SVG+CSS, React+GSAP) + the orchestrator runtime — carry an **unseen** asset with **no engine
edits**? I.e. is this an *engine* or one hand-tuned demo?
**Method:** Ran the whole pipeline end-to-end on a *second, different* mascot (a cartoon
military **Land Rover Series III** — green body, UK flag on a pole, headlight "eyes", front
grille, wheels) and recorded, per step, what ran unchanged, what needed only a parameter or a
human, and what is hard-coded to DevBrain. Every tool was run **unedited**; all output is
isolated under `spikes/03-second-asset/`.

> Verdict up front: **YES — it survives a second asset.** The schema, both emitters, and the
> runtime carried the Land Rover with **zero edits to any of them**. The cost was exactly where
> v1 predicted: P1 palette tuning, the P2 human-confirm step, and rig authoring — plus a clear
> v1.1 backlog of **DevBrain-hard-coded heuristics/strings** that *worked around*, not edited.

---

## The asset

A genuinely different character: different palette (olive green + Union-Jack red/white/blue vs
DevBrain's orange/dark), different parts (a vehicle, not a creature), different size
(native 1024², vs DevBrain 192²), and a different source *format/quality* (a JPEG with a baked
checkerboard background, not a clean transparent PNG). See `assets/land-rover/README.md`.

**Convenient anatomy match.** The sticker happens to have cartoon **eyes on the headlights**, a
**flag on a pole**, a **front grille**, and **wheels** — which map naturally onto DevBrain's six
rig-part slots (see §"Naming friction" for why that mapping was *forced*, not just convenient).

---

## Per-step generality verdict (the three questions)

| Step | Tool | Ran… | Evidence |
|---|---|---|---|
| **P1 vectorize** | `vectorize-pixel.ps1` | **Unchanged + params** | `-Colors 14` (vs DevBrain's 6) over the NN-downscaled source: 31 510 opaque px → ~3 540 rects, 88.8% reduction. See the banding finding below for why the Step-0 downscale uses nearest-neighbor, not bicubic. |
| **P2 segment** | `segment-parts.ps1` | **Ran, but DevBrain-hard-coded → mislabels (a finding)** | See "Naming friction". Ran in **48.6 s** (DevBrain: instant) — an O(n²) scale finding. |
| **author rig** | (human, ADR-0002) | **Assisted, schema v2 unchanged** | Hand-grouped flat rects into the 6 slots; authored `land-rover-rigged.json` with **no invented fields**. |
| **P3 emit (SVG+CSS)** | `emit-svg-css.ps1` | **Unchanged (data-driven on parts) + isolated OutDir** | Emitted a working animated mascot from the new rig+SVG. Cosmetic DevBrain couplings noted below. |
| **P3 emit (React+GSAP)** | `tools/emit-react-gsap/` | **Unchanged (env-pointed)** | `RIG_PATH`/`SVG_PATH` env vars; `assertPivotAgreesWithOrigin` **passed for all 6 parts** → cross-target pivot fidelity holds for a new asset. |
| **P4 orchestrate** | `runtime/mascot-state.js` + `useMascotState.ts` | **Byte-unchanged (zero edits)** | The React demo's second mascot is bound to `useMascotState` over a mock telemetry feed and cycles `idle/active/alert` automatically. |

**Answer to Q1 (runs unchanged/auto):** vectorize, **both** emitters, orchestrate. ✅ the
load-bearing claim.
**Answer to Q2 (parameter or human):** P1 `-Colors`; P2 confirm/rename; rig authoring. ✅ as designed.
**Answer to Q3 (hard-coded to DevBrain → engine change to generalise):** the **P2 part-naming
vocabulary**, the **React `PART_IDS` namespacing list**, and several **`devbrain-*` string/path
hard-codes**. Recorded as v1.1 backlog — *not fixed here*.

---

## What was verified live (preview MCP — text-based, see note)

**SVG+CSS target** (sampled computed `transform` per part, per state, on the emitted SVG):

- **idle** → `part-body` breathes (scale oscillates 0.990/1.012 → 0.998/1.003); `part-eyes`
  blink at rest; legs/flag/grille `none`.
- **active** → `part-leg-left`/`-right` rotate as **exact mirrors** (sin +0.165 / −0.165),
  values changing over time (0.165 → 0.045) = live, out-of-phase wheel spin; everything else `none`.
- **alert** → `part-antenna` (flag) rotates through zero (+0.059 → −0.086 = waving);
  `part-moustache` (grille) recoils `translateX` (−3.4 → −0.7px); rest `none`.
- Render proof: `generated/land-rover-svgcss-idle.png` (the whole vehicle renders from the pipeline).

**React+GSAP target** (sampled GSAP-applied `transform` matrices on the live demo):

- Demo mounts the Land Rover in **two** mascots: `probe-` (manual buttons) + `live-`
  (bound to a mock telemetry feed via the unedited runtime).
- **active** → `probe-part-leg-left/right` rotate as mirrors **around their baked canonical
  pivots** (the matrix translation components = GSAP `svgOrigin`, FINDINGS §8.1 behaviour), plus
  `part-body` y-bob (the React-only accent, −1.63 → −1.55 live). Flag/eyes/grille at rest.

> **Tooling note:** the preview **screenshot** subsystem was wedged this whole session (it timed
> out ≥30 s even on trivial HTML). I worked around it by rasterising the emitted SVG to a PNG via
> an in-page `<canvas>` (`land-rover-svgcss-idle.png`) and by sampling computed/GSAP transforms
> directly — *stronger* evidence of articulation + pivot fidelity than a still. A React still was
> not saved (the canvas data-URL was too long to round-trip reliably); the React render is
> evidenced by the demo accessibility snapshot + the GSAP transform sample + the emit's
> pivot/origin gate passing.

---

## Naming friction (the headline v1.1 finding)

`segment-parts.ps1` proposes parts from a **fixed DevBrain vocabulary**
(`body / leg-left / leg-right / antenna / eyes / moustache`) using geometry rules tuned to the
brain mascot. On the Land Rover it proposed **3 of 6**, all mislabeled:

| CCL proposed | what it actually is |
|---|---|
| `part-body` (2327 rects) | the green mass — **but the wheels are fused in** (tyres are the same dark-green `#0d1902` as the body outline, so colour+CCL cannot split them). |
| `part-eyes` (318 rects) | the **UK flag** (an upper colour island → mislabeled "eyes"). |
| `part-leg-left` (16 rects) | a wheel-bottom sliver poking below the body bbox. |
| `part-leg-right` / `part-antenna` / `part-moustache` | **missing** (no right-leg split; nothing protrudes above the roof; moustache never separable). |

**Workaround (not a fix):** I performed the ADR-0002 human-confirm step as a **region map**
(`author-manual-part.ps1`) — defining a bbox per part and assigning each flat rect to a slot —
and **reused the six DevBrain part-ids as generic slots** remapped to Land Rover anatomy
(body=cabin, leg-left/right=front/rear wheel, antenna=flag, eyes=headlights, moustache=grille).
This is what let **both emitters run unedited**, and it is precisely the generalisation gap.

---

## Other DevBrain hard-codes encountered (worked around, not edited)

1. **React `PART_IDS` is a fixed list** (`emit.ts`) used for id-namespacing. A part id outside it
   never gets the per-instance prefix → its selector misses → no animation. *Forces* reuse of the
   six DevBrain ids. **v1.1: derive `PART_IDS` from `rig.parts`.**
2. **`segment-parts.ps1` emits a hard-coded `viewBox="0 0 192 192"`** and
   `data-source="…/devbrain-flat.svg"` regardless of the real asset (ours is 256²). The review
   panel renders cropped. **v1.1: carry the flat.svg viewBox + source path through.**
3. **`emit-svg-css.ps1` writes hard-coded `devbrain-*` output filenames** and rejects any
   non-`devbrain-*` file in `OutDir`. Worked around with an isolated `generated/svg-css/` dir; the
   emitted files are still named `devbrain-svg-css.generated.*`. The demo `<h1>`/title also say
   "DevBrain". **v1.1: parameterise the output basename + demo label.**
4. **Scale:** the pixel-RLE vectorizer is O(W·H) and the segmenter is O(n²) over rects. A native
   1024² source is impractical (DevBrain was 192²) — hence the Step-0 downscale to 256². **v1.1:
   either cap source resolution explicitly or replace the O(n²) CCL union with a grid/sweep.**
5. **Source contract:** the pipeline assumes a **transparent PNG**. The supplied JPEG had a baked
   checkerboard background (no alpha). Keying it was an Andrew-approved Step-0 prep, not engine
   work. **v1.1 (docs): state the Clean-Mascot-Source contract (transparent PNG) explicitly.**
6. **Downscale interpolation → quantization banding.** A *bicubic* Step-0 downscale blends the
   flat cartoon greens into smooth gradients; the median-cut quantizer (largest-gap split, ADR-0009)
   then slices each gradient into horizontal colour bands → visible "hatching"/scan-lines in the
   rendered mascot. Fix: the prep downscales with **nearest-neighbor** (`prep-source.ps1`), keeping
   flat colour blocks so vertical runs merge and no banding occurs. Trade-off: the Union Jack's tiny
   red/blue accents sit close to dark green and partly muddy under global median-cut — acceptable on
   a validation asset. This is a **source-prep** lesson, not engine code; relevant if v1.1 ever
   ingests non-pixel-art sources. (See ADR-0009 — the largest-gap split assumes a flat source.)

---

## v1.1 generalisation backlog (priority order)

1. **Data-drive the P2 part vocabulary** (the real wedge): part names/geometry rules should come
   from a per-asset taxonomy, not a DevBrain-tuned constant. This is the single highest-value fix.
2. **Derive React `PART_IDS` from the rig** so a new part taxonomy animates without an engine edit.
3. **Carry asset identity through the tools**: flat.svg viewBox + source path into
   `segment-parts.ps1`; output basename + demo label into both emitters; drop the `OutDir`
   `devbrain-*`-only assertion.
4. **Address scale**: cap/declare source resolution, or replace the O(n²) CCL union.
5. **Document the Clean-Mascot-Source contract** (transparent PNG) in the proposal/README.

---

## §8 report-back

- **Does it survive a second asset?** **Yes.** Schema v2, both emitters, and the runtime carried
  an unseen, structurally-different mascot **with zero edits**. The project's claim upgrades from
  *"one good demo"* to **"an engine that survives a second asset"** — with a named, honest v1.1
  backlog for the DevBrain-tuned *authoring* heuristics (segmentation naming), which are
  human-assisted by design (ADR-0002) and were *worked around*, never silently patched.
- **Biggest surprise:** the wheels are colour-fused with the body outline, so the "walk"
  articulation target was **not auto-recoverable** — the exact kind of gap a single-asset demo
  hides. The human-confirm step (ADR-0002) absorbed it cleanly.
- **Cross-target fidelity held:** `assertPivotAgreesWithOrigin` passed for all 6 new parts, so
  both targets rotate around identical pivots on an asset neither emitter had seen.
- **Locked artifacts:** DevBrain buildable-slice + `runtime/mascot-state.js` untouched by this
  spike; the React generated dir was re-emitted to DevBrain defaults after the run; nothing written
  into `docs/buildable-slice/`. No TODO/TBD/FIXME in new files.
