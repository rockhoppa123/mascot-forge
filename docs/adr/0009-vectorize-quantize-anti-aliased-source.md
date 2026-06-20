# ADR-0009 — Phase 1 vectorizes via colour quantization (amends ADR-0005)

- **Status:** Accepted
- **Date:** 2026-06-18
- **Amends:** [ADR-0005 — pixel-art PoC first](0005-pixel-art-poc-first.md)

## Context
ADR-0005 assumed the Clean Mascot Source is flat pixel art with a small fixed palette, so
Phase 1 could do exact same-colour clustering → `<rect>` RLE/greedy-mesh with no quantization
("no K-means in v1"). Decoding the actual approved source
(`C:\Users\student1\Dev\DevBrain\public\mascot\default.png`, 192×192, `Format32bppArgb`)
contradicts that premise:

| Measure | Value |
|---|---|
| Opaque pixels (alpha>0) | 7,163 |
| Distinct RGB values | **2,381** |
| Distinct alpha levels | 36 (anti-aliased fringe) |
| Horizontal RLE runs | 7,026 (avg run **1.02 px**) |
| Exact-colour greedy-mesh rects | **6,433 (~10% reduction)** |

Even fully-opaque pixels (alpha==255) carry 2,316 distinct colours — it is an anti-aliased,
gradient-shaded raster, not flat pixel art. Exact-colour clustering therefore produces ~2.3k
colour groups and ~6.4k rects (≈ 1-per-pixel): a dead artifact with no meaningful layers for
Phase 2 and no compression.

More importantly for the **product** ("any image → rigged React mascot"): real inputs are
anti-aliased. A vectorizer that only works on hand-made flat art does not serve the product.
The general colour-clustering path that the research log reserved for "later" (VTracer /
median-cut) is, given the product idea, needed **now**.

## Decision
Phase 1 v1 produces `flat.svg` by **deterministic colour quantization**, not exact-colour
clustering:

1. Decode the source PNG (read-only) to an ARGB grid.
2. **Median-cut** the opaque colours to a small fixed palette (default 6), using a
   **largest-gap split** along each box's longest axis. Largest-gap (vs population-median)
   isolates small but salient accent clusters — e.g. the green antenna tip — instead of
   letting the dominant orange mass swallow them.
3. Map each opaque pixel to its nearest palette colour; RLE per row; greedy-merge
   vertically-adjacent equal `(x, width, colour)` runs into `<rect>`s.
4. Emit one `<g data-color="#rrggbb">` per palette colour, deterministic ordering.

`flat.svg` is a **faithful colour-clustered reduction, not a bit-exact copy** of the source.
`data-render-method` is recorded as `quantized-color-rle` (the Manual Part SVG fixture keeps
its own `source-pixel-rle` method and is untouched).

## Consequences
- Phase 1 stays dependency-free (PowerShell + `System.Drawing`); median-cut is hand-rolled,
  no K-means library, no npm. Determinism preserved (byte-identical reruns).
- At the default palette of 6 the DevBrain source yields **89 rects (98.8% reduction)** while
  preserving the silhouette (0 transparent-coverage misses), dark eyes/legs, green antenna
  tip, and belly highlight — meaningful per-colour layers for Phase 2 segmentation.
- The exact pixel-RLE path from ADR-0005 remains valid for genuinely flat inputs; it is no
  longer the v1 path for this (anti-aliased) source.
- `data-render-method="quantized-color-rle"` is the new flat.svg contract; the SVG+CSS
  Manual Part SVG / emitter / goldens are unchanged.
- VTracer remains a possible future swap for the general path; the in-repo median-cut
  vectorizer covers v1 without adding a dependency.
