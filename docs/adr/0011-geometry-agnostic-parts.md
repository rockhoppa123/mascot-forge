# ADR-0011 — Geometry-agnostic parts (elements, not just rects)

- **Status:** Accepted
- **Date:** 2026-06-22
- **Amends:** extends the editor model behind ADR-0008 (schema v2) and the Phase-1/2 rig editor.

## Context
The rig editor's atomic unit was the `<rect>` (pixel-grid output of the vectorizer). That blocks the
highest-fidelity input a designer actually has: a **layered vector file** (Figma / Inkscape /
Illustrator), whose layers are named parts but whose geometry is `<path>` / `<circle>` / `<polygon>`,
not rects. The refocus (council 2026-06-22) makes structured layered input the primary path, so the
model must carry arbitrary geometry, not only rects.

## Decision
Generalise the atomic unit from "rect" to **element**: an opaque source-SVG fragment with a stable id,
a cached axis-aligned **bbox**, a `part` assignment, and its raw **markup**. A rect is the special case
(markup `<rect …/>`, bbox from its attributes). The change is **additive** — `markup` and `bbox` are
optional fields that ride alongside the existing `{x,y,w,h,fill}` — so the rect pipeline is unchanged
and its goldens are preserved byte-for-byte.

Key points:
- **Conservation (D6) generalises:** every source element belongs to exactly one part; export drops
  none. (Same invariant, "rect" → "element".)
- **Bbox is computed once, at ingest.** Rects: from attributes (pure, node-safe). Paths/curves: via the
  browser's `SVGGraphicsElement.getBBox()` in `app.js` glue — the *only* DOM-dependent step. Pure
  modules consume the cached `bbox` and never re-parse geometry, so node tests stay DOM-free.
- **`rigged.json` schema v2 stays LOCKED (ADR-0008).** It never carried geometry — only
  id/bone/pivot/origin/animations. Geometry lives in `manual-part.svg`. So B touches *zero* locked
  contract.
- **Exporter emits by markup when present, else reconstructs `<rect>`.** Rect inputs round-trip
  identically (markup is the same rect string) → the golden round-trip is unaffected.
- **Pivots/origins unchanged:** pivot is a viewBox point; origin = pivot as a % of the part's union
  bbox (`pivot.js`, now bbox-aware over cached bboxes).
- **Emitters pass geometry through** (`emit-svg-css.ps1`, `emit-react-gsap`): they wrap each part group
  and animate via `transform-origin`, copying the group's inner geometry as-is — arbitrary markup is
  carried unchanged.

## Consequences
- New `tools/rig-editor/layer-ingest.js` (pure: layer-name → sanitized part id, dedupe, model assembly)
  + `app.js` DOMParser/`getBBox` glue for real files.
- `pivot.js` and `exporter.js` become bbox/markup-aware (additive; rect goldens preserved).
- Layered SVG (Figma/Inkscape/Illustrator) becomes a first-class input; PNG vectorize stays the
  "flat image only" fallback; the regex segmenter is demoted to best-effort.
- Marquee split generalises to element granularity (rect-level is the special case).
- Slightly more memory (markup strings) — negligible for the target asset sizes.
