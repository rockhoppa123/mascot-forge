# ADR-0008 — Lock `rigged.json` to schema v2 (canonical pivots, structured channels)

- **Status:** Accepted
- **Date:** 2026-06-17
- **Implements:** the three `rigged.json` changes required by [ADR-0007](0007-output-target-verdict-both-svg-css-default.md) and `spikes/01-emitter/FINDINGS.md` §8
- **Evidence:** live DOM verification of `tools/emit-react-gsap/` against the Spike 01 golden

## Context
ADR-0007 shipped both Output Targets and flagged that `rigged.json` needed three fixes
before it was a robust cross-emitter contract. Building the React+GSAP emitter forced the
issue: the two runtimes resolve pivots differently (GSAP animates via the SVG `transform`
attribute, so CSS `transform-box`/`transform-origin` are inert on the GSAP path), and the
fixture's absolute `pivot` and CSS `origin` **disagreed** for most parts (e.g. leg `origin`
"50% 0%" resolves to y≈152 but `pivot.y` was 137). The SVG+CSS emitter, its check script,
and the accepted reduced-motion goldens all consume the v1 shape, so any change had to stay
backward-compatible.

## Decision
Lock `rigged.json` to **version 2**, **additively**:

1. **Canonical pivot.** Each part's absolute `pivot` is the source of truth; emitters derive
   the bbox-relative `%` at emit time. The previously-drifted pivots were **corrected to
   equal the point each accepted CSS `origin` resolves to** (e.g. leg hip → `72.5, 152`), so
   both targets rotate around the **identical** point with no `%`-resolution drift. The
   React+GSAP target uses the absolute pivot as a GSAP `svgOrigin`.
2. **Structured channels.** Added `channels[] {offset, rotate, scaleX, scaleY, x, y}` plus
   explicit `ease` / `repeat` / `yoyo` / `reducedChannel` per recipe — emitter-neutral, no
   CSS-string parsing. The legacy CSS-string `keyframes` / `iteration` / `reduced` fields are
   **retained** as the back-compat contract the SVG+CSS emitter reads verbatim.
3. **Explicit loop semantics.** `repeat` (numeric, −1 = infinite) and `yoyo` (boolean)
   replace inferring yoyo from `infinite` + symmetric keyframes.

A target-specific `reactGsap.accents` block carries React+GSAP-only body motion (bob/jitter);
the SVG+CSS emitter ignores it. The six shared recipes remain the cross-target contract.

### Pivot-vs-goldens reconciliation
The accepted goldens were rendered from the CSS `origin` %. Rather than re-baking accepted
provenance PNGs, the drifted **pivots were corrected to match the accepted look**. A future
move to a truer anatomical hip is a separate, reviewed golden-acceptance pass.

## Consequences
- `emit-svg-css.ps1` is **unchanged**; its generated CSS/demo and the three reduced-motion
  goldens are **byte-unchanged**. `check-buildable-slice.ps1` now asserts version 2, the
  structured channel fields, and the optional `reactGsap` block, alongside all prior
  SVG+CSS invariants.
- The React+GSAP emitter (`tools/emit-react-gsap/`) generates a component whose GSAP origin
  equals the canonical pivot for every part (verified live), closing the FINDINGS pivot-drift
  fidelity risk.
- Residual friction for a future major: `iteration` (CSS string) is now redundant with
  `repeat`; `ease` stores GSAP-syntax strings rather than an abstract easing token; accents
  hint that the rig may eventually want a first-class accent-layer concept.

```text
Superseded decisions: none. Implements the schema changes ADR-0007 deferred.
```
