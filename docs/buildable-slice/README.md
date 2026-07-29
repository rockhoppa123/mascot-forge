# SVG+CSS Buildable Slice

This folder contains the first dependency-free Buildable Slice for mascot-forge. It
proves one Output Target path with a source-pixel Manual Part SVG, a small rig fixture,
and a standalone browser harness for `idle`, `active`, and `alert` Animation States.

## Clean Mascot Source

Approved source:

`C:\Users\student1\Dev\DevBrain\public\mascot\default.png`

The source was approved by the user on 2026-06-17 before this Manual Part SVG fixture was
created. The source file is not copied, moved, or edited. The current Manual Part SVG
uses source-pixel row-run geometry from the approved transparent sprite so the fixture
preserves the DevBrain likeness while still exposing semantic part groups.

Metadata rechecked on 2026-06-17:

| Field | Value |
|---|---|
| Dimensions | `192x192` |
| Pixel format | `Format32bppArgb` |
| Alpha flag | `true` |
| Corner alpha values | `0,0,0,0` |
| File size | `15670` bytes |
| Last modified | `2026-06-16 13:32:59` |

Visual confirmation: the approved source is one transparent pose with open transparent
room around the antenna and legs. The Manual Part SVG is a source-pixel fixture, not a
claim of production-quality automated vectorization or segmentation.

## Files

| File | Purpose |
|---|---|
| `devbrain-manual-part.svg` | Source-pixel Manual Part SVG with semantic part groups. |
| `devbrain-rigged.json` | Small Spine-like rig fixture sharing the SVG coordinate system. |
| `devbrain-svg-css.css` | SVG+CSS Output Target stylesheet for state loops and reduced motion. |
| `devbrain-svg-css-demo.html` | Standalone browser harness for state routing and screenshot review. |
| `generated/devbrain-svg-css.generated.svg` | Generated SVG+CSS Output Target SVG emitted from the Manual Part SVG and `rigged.json`. |
| `generated/devbrain-svg-css.generated.css` | Generated stylesheet emitted from `rigged.json` part origins and animation recipes. |
| `generated/devbrain-svg-css.generated-demo.html` | Generated browser harness with state controls emitted from `rigged.json`. |
| `generated/devbrain-flat.svg` | Phase 1 generated `flat.svg`: colour-clustered `<rect>` geometry vectorized from the Clean Mascot Source PNG by `tools/vectorize-pixel.ps1` (deterministic median-cut quantization — see [ADR-0009](../adr/0009-vectorize-quantize-anti-aliased-source.md)). |
| `orchestrator-demo.html` | Phase 4 demo: reuses the locked generated SVG and drives `data-state` from a mock telemetry feed via the orchestrator core. *Needs a static HTTP server (fetches the generated SVG).* |
| `showcase.html` | Phase 6 before/after: the flipbook PNG baseline beside the forged, auto-cycling data-reactive mascot (reuses the locked generated SVG + the orchestrator core). *Needs a static HTTP server (fetches the generated SVG).* |
| `goldens/` | Stored reduced-motion screenshot baselines from explicitly accepted review passes. |

## Golden Acceptance

Result on 2026-06-17: previous fixture accepted by human review.

The human reviewer accepted all three deterministic reduced-motion screenshots for the
first freehand fixture. After the source-pixel likeness correction, these files remain
unchanged for provenance and must not be overwritten without explicit review. The stored
goldens are:

```text
docs/buildable-slice/goldens/devbrain-svg-css-idle-reduced.png
docs/buildable-slice/goldens/devbrain-svg-css-active-reduced.png
docs/buildable-slice/goldens/devbrain-svg-css-alert-reduced.png
```

Only explicitly accepted `?state=<idle|active|alert>&reduce=1` captures belong in
`goldens/`. New source-pixel captures should stay in a temp review folder until accepted.

## Schema v2 (rig contract lock)

`devbrain-rigged.json` was locked to **version 2** so one rig contract drives **both** Output
Targets (SVG+CSS and React+GSAP) around identical pivots. The change is **additive and
goldens-safe** — the accepted reduced-motion PNGs are byte-unchanged and `emit-svg-css.ps1`
is untouched.

| Fix (FINDINGS §8) | What changed | Why goldens are safe |
|---|---|---|
| Canonical pivot | `parts[].pivot` corrected so each pivot equals the point its accepted CSS `origin` % resolves to in the part bbox (e.g. leg hip → `72.5, 152`). `data-pivot-*` on the SVG updated in lockstep. | `pivot` is metadata; the SVG+CSS target still renders from the unchanged `origin` %, so reduced poses are identical. The React+GSAP target uses the absolute pivot as a GSAP `svgOrigin`, so both targets rotate around the **same** point with no %-resolution drift. |
| Structured channels | Added `channels[] {offset, rotate, scaleX, scaleY, x, y}` per recipe, plus explicit `ease` / `repeat` / `yoyo` / `reducedChannel`. | The legacy CSS-string `keyframes` / `iteration` / `reduced` fields are **retained** as the back-compat contract `emit-svg-css.ps1` consumes verbatim. |
| `reactGsap.accents` | New optional block carrying React+GSAP-only body bob (active) and body jitter (alert). | The SVG+CSS emitter ignores it; the six shared recipes remain the cross-target contract. |

> Pivot-vs-origin reconciliation: the accepted goldens were rendered from the CSS `origin` %,
> so the previously-drifted absolute pivots were corrected **to match the accepted look**
> rather than re-baking the goldens. Any future move to a truer anatomical hip is a separate
> reviewed golden-acceptance pass.

The `tools/gate/check-buildable-slice.mjs` guard now asserts version 2, the structured channel fields,
and the optional `reactGsap` block, in addition to all prior SVG+CSS invariants.

## Run

Open the demo directly in a browser:

```text
docs/buildable-slice/devbrain-svg-css-demo.html?state=idle&reduce=1
docs/buildable-slice/devbrain-svg-css-demo.html?state=active&reduce=1
docs/buildable-slice/devbrain-svg-css-demo.html?state=alert&reduce=1
```

Run the structural checks from the repository root:

```bash
node tools/gate/check-buildable-slice.mjs
```

(Artifacts are produced by `mf emit`; `tools/emit-svg-css.ps1` is the legacy batch emitter —
`tools/rig-editor/emit.js` is the canonical one.)

Open the generated demo directly in a browser after running the emitter:

```text
docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html?state=idle&reduce=1
docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html?state=active&reduce=1
docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html?state=alert&reduce=1
```

Use a `900x620` viewport for reduced-motion review captures so generated screenshots
line up with the review frame used by the stored goldens.

## Accepted Caveats

- The Manual Part SVG uses source-pixel row-run geometry from the approved source sprite
  to preserve likeness.
- `part-moustache` is a narrow duplicated lower accent over the full body silhouette, so
  alert recoil can move without tearing gaps in the source-pixel mascot.
- Numeric pivots are recorded in `devbrain-rigged.json` and mirrored as SVG metadata,
  while CSS uses percentage `transform-origin` values for this first Output Target.
- `impact` is represented only as `accents.impact`; it is not an Animation State.
- Goldens are accepted for the deterministic reduced-motion `idle`, `active`, and
  `alert` captures only.
- Generated files under `generated/` are reproducible SVG+CSS emitter output. They do
  not replace the accepted goldens and should be regenerated from `rigged.json`.
- This slice does not add packages, React+GSAP integration, asset copying,
  vectorization, segmentation, Motion Intent parsing, telemetry binding, or ADR changes.
