# Phase 1 — Ingest & Vectorize: Implementation Plan

**Status:** ✅ done 2026-06-18 (`tools/vectorize-pixel.ps1`). Created 2026-06-17.
**Build-plan position:** step 3 of [`technical-proposal.md` §7](technical-proposal.md). Phase 3
(codegen — both emitters + schema-lock v2) is complete; this is the next phase.

> **Outcome note (2026-06-18):** the Clean Mascot Source proved to be an anti-aliased raster
> (2,381 distinct colours), not flat pixel art, so the "exact same-colour clustering, no
> K-means" approach below degenerates to ~1 rect/pixel. v1 instead vectorizes by deterministic
> **colour quantization** (median-cut, largest-gap split) — see
> [ADR-0009](adr/0009-vectorize-quantize-anti-aliased-source.md). `flat.svg` is a faithful
> colour-clustered reduction (default palette 6 → 89 rects, 98.8% reduction), not bit-exact.
> The contract (viewBox, per-colour `<g>` groups, rects-not-paths, transparent pose preserved,
> deterministic) below still holds; `data-render-method` is `quantized-color-rle`.

---

## Goal

Turn the raster **Clean Mascot Source** (the approved DevBrain pixel-art PNG) into a clean,
layer-able **`flat.svg`** — as few, as meaningful shapes as possible, mathematically exact,
with no curve-fitting and no scaling artifacts. This replaces the hand-authored
`devbrain-manual-part.svg` geometry with **generated** geometry, closing the first
intermediate-artifact contract of the pipeline.

`flat.svg` is the input to Phase 2 (assisted segmentation), which adds the named part groups.
**Phase 1 does not segment** — it produces colour-clustered geometry only.

---

## Evidence basis (documented)

- **[technical-proposal.md §2](technical-proposal.md)** — Phase 1 contract: pixel-art path
  v1, RLE / greedy-meshing so contiguous same-colour pixels collapse into one `<rect>`;
  output `flat.svg` with colours preserved, geometry grouped by colour cluster, viewBox
  matching source dimensions. "Vectorization is a solved, deterministic problem — no VLM."
- **[ADR-0005 — pixel-art PoC first](adr/0005-pixel-art-poc-first.md)** — pixel-grid →
  exact SVG geometry is the reliable v1 route; DevBrain mascot is pixel art.
- **[research/references.md](research/references.md)** — prior art: GLORP (greedy meshing),
  pixel2svg (RLE: contiguous pixels → one rect), jwolle1 grid approach; **VTracer (MIT,
  O(n), colour clustering)** reserved for the *later* general flat-art path, not v1.
- **Existing proof:** `devbrain-manual-part.svg` already carries `data-render-method=
  "source-pixel-rle"` and `data-source-bounds="21,77,170,177"` over `viewBox="0 0 192 192"`
  with 100s of pixel-run `<rect>`s. That fixture demonstrates the RLE geometry renders the
  DevBrain likeness exactly — Phase 1 **generates** that geometry from the PNG instead of
  hand-embedding it.

---

## Input / Output contract

**Input:** the Clean Mascot Source PNG (read-only, never copied/edited — same rule as the
Buildable Slice). Documented source:
`C:\Users\student1\Dev\DevBrain\public\mascot\default.png` — `192x192`, `Format32bppArgb`,
alpha true, visible bounds `21,77,170,177`.

**Output:** `flat.svg` — a single SVG:

- `viewBox="0 0 192 192"` matching source dimensions; `width`/`height` = source px.
- Fully-transparent pixels (alpha 0) emit **no** geometry (preserve the transparent pose).
- Opaque pixels collapsed into `<rect x y width height fill="#rrggbb">` runs via RLE /
  greedy meshing — **exact**, no anti-alias blur, no curves.
- Geometry **grouped by colour cluster**: one `<g data-color="#rrggbb">` per distinct
  colour, rects nested inside. (This per-colour layering is the documented *head start* for
  Phase 2 segmentation.)
- Deterministic output (stable rect ordering) so it is diff-able and golden-testable.
- `data-source-bounds` + `data-render-method="source-pixel-rle"` metadata carried through,
  matching the existing fixture's invariants.

---

## Approach

1. **Decode** the PNG to an ARGB pixel grid (read-only).
2. **Quantise / cluster** by exact colour (pixel art has a small fixed palette → exact-match
   clustering, no K-means needed for v1; K-means/VTracer is the later general path).
3. **RLE per row** within each colour, then **greedy-merge** vertically adjacent equal runs
   into rectangles (GLORP-style) to minimise rect count.
4. **Emit** grouped `<rect>` runs as `flat.svg` with the contract above.

**Language decision (recommended):** PowerShell + `System.Drawing.Bitmap`, to stay
**dependency-free** and consistent with `tools/emit-svg-css.ps1` (the SVG+CSS path adds no
npm). A Node alternative (e.g. `pngjs`) is possible but would introduce a dependency outside
the React+GSAP folder — avoid for v1 unless `System.Drawing` proves insufficient.
*(This is a stop-and-confirm point — see Stop conditions.)*

---

## Planned files

| File | Purpose |
|---|---|
| `tools/vectorize-pixel.ps1` | PNG → `flat.svg` pixel-art vectorizer (RLE + greedy-mesh + colour grouping). |
| `docs/buildable-slice/generated/devbrain-flat.svg` | Generated Phase-1 artifact for the DevBrain Clean Mascot Source. |
| `tools/check-flat-svg.ps1` *(or extend `check-buildable-slice.ps1`)* | Structural checks for `flat.svg` (viewBox, no curves, rect count sane, colours preserved, transparent pixels omitted). |
| `docs/buildable-slice/goldens/devbrain-flat.png` *(optional)* | Reduced/static golden render of `flat.svg` for visual provenance, only if human-accepted. |

---

## Implementation steps

1. Build `vectorize-pixel.ps1`: decode PNG → grid; exact-colour clustering; per-colour RLE +
   vertical greedy-merge; emit grouped `flat.svg` per the output contract.
2. Generate `devbrain-flat.svg` from the documented source PNG.
3. Write/extend the structural check: `flat.svg` has `viewBox 0 0 192 192`, zero `<path>`,
   `<rect>` count within a sane bound, ≥1 `<g data-color>` group, no geometry over fully
   transparent pixels, opaque-pixel coverage matches the source's visible bounds.
4. **Visually verify** `flat.svg` is pixel-identical to the source PNG at native size
   (overlay / side-by-side); confirm the transparent pose is preserved.
5. Record the result and, only on explicit human acceptance, store any golden.

---

## Verification

- Run `tools/vectorize-pixel.ps1`; confirm `devbrain-flat.svg` regenerates deterministically
  (re-run → byte-identical).
- Structural check passes.
- Live/visual: `flat.svg` rendered at 192×192 matches the source PNG pixel-for-pixel; rect
  count is materially lower than the naive 1-rect-per-pixel count (greedy-mesh working).
- Scan changed files for TODO/TBD/FIXME.

---

## Non-goals (explicit)

- **No segmentation / named parts** — that is Phase 2. `flat.svg` is colour-clustered only.
- **No VTracer / general flat-art path** — reserved for later; v1 is the exact pixel-art path.
- **No curve-fitting, no VLM, no telemetry, no emitter changes.**
- **Do not copy, move, or edit the DevBrain source PNG** — read-only input only.
- **Do not alter** the accepted Buildable Slice goldens, the rigged.json contract, or any ADR.

---

## Stop conditions — stop and ask before

- adding any dependency (e.g. a Node PNG library) instead of the dependency-free
  `System.Drawing` path.
- writing any new file derived from a DevBrain asset beyond the agreed read-only `flat.svg`
  generation, or copying/editing the source PNG.
- producing a golden, or overwriting/altering any existing accepted golden.
- changing the Manual Part SVG, the rigged.json contract, the emitters, or any ADR.

---

## Open questions touched (from §9)

- This phase does **not** resolve **Q3** (GSAP-vs-CSS runtime benchmark) or **Q5** (where the
  human-confirm UI lives) — both remain open and are addressed in later phases. Phase 1 is
  deterministic and UI-free.

---

## Handoff summary

Phase 3 is complete: one `rigged.json` (schema v2) drives both Output Targets around
identical canonical pivots; the React+GSAP emitter lives at `tools/emit-react-gsap/` and was
live-verified. Phase 1 is net-new tooling: a dependency-free PNG→`flat.svg` pixel-art
vectorizer that generates the geometry currently hand-embedded in `devbrain-manual-part.svg`,
producing the first generated intermediate artifact and the documented head start for
Phase 2 segmentation.
