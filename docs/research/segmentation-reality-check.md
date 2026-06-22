# Segmentation reality-check

**Date:** 2026-06-22
**Purpose:** keep the README's auto-segmentation claims honest and evidence-backed (council 2026-06-22,
Contrarian's falsifiable test). Question: how well does the deterministic PNG → parts path work on art
the author *didn't* hand-pick?

## Method
Run the in-browser PNG path (`vectorize` → `segment`) on real assets at the default palette (6 colours)
and record how many usable parts it proposes before any manual splitting.

## Results

| Input | Size (downscaled) | Proposed parts | Notes |
|---|---|---|---|
| `devbrain-mascot-reference-v1.png` | 256×171 | **2** (`part-body`, `part-eyes`) | legs + antenna colour-fuse into the body |
| Super Mario PNG (cartoon, anti-aliased) | 214×256 | **2** | nearly all anatomy fuses at 6 colours |
| `devbrain-segmented.svg` (hand golden, true pixel art) | 192×192 | **5** | segments cleanly — genuinely flat, colour-separable parts |
| Land Rover (cartoon vehicle, spike 03) | 256×256 (3540 rects) | partial | colour-fusion friction already documented in `spikes/03-second-asset/FINDINGS.md` |

## Why (structural)
Deterministic colour-threshold + connected-component labeling fuses **same-colour adjacent regions**.
Anti-aliased or shaded art has very few cleanly separable colours at a small palette, so distinct
anatomy (a leg the same orange as the body) collapses into one part. This is inherent to colour-only
segmentation without ML — it is not a tuning bug. Only genuinely flat pixel art with separable colours
(the original DevBrain sprite) segments into many parts automatically.

## Conclusion (and how the README reflects it)
- **PNG auto-segment is a best-effort starting point for flat pixel art.** For anti-aliased/cartoon art,
  expect ~2 fused parts and finish with the **marquee split**.
- **Layered SVG is the recommended high-fidelity input** (ADR-0011): the part anatomy is already in the
  file, so no segmentation guessing is needed.
- The README scope line and the "best-effort flat-art fallback" wording already state this. ✅

## Deferred
A formal 20-PNG OpenGameArt sweep (the literal Contrarian test) is deferred — the structural limitation
is already demonstrated by the cases above; a sweep would only quantify the fusion rate, not change the
conclusion or the recommended workflow.
