# Phase 2 — In-browser PNG → riggable parts (design)

**Date:** 2026-06-22
**Status:** Approved (brainstorming complete; awaiting implementation plan)
**Context:** mascot-forge rig editor. Phase 1 (browser rig editor + marquee rect-split) is shipped.
This spec covers Phase 2 from `docs/research/rig-editor-marquee-split-prompt.md` §5: porting the
terminal `mf forge` raster pipeline into the browser so a user can drop a raw PNG and rig it with no
terminal step.

---

## Goal

Let a user drop a **PNG** onto the rig editor and get the same proposed-parts starting point that
`pwsh ./mf.ps1 forge <asset>` produces today — entirely client-side, zero build, no backend, no new
dependency (D1/D2 unchanged). After the proposal loads, the existing editor (roles, pivots, presets,
marquee split, live preview, export) takes over unchanged.

Non-goal: replacing the terminal pipeline. `mf forge` / `mf emit` and the canonical checks stay. The
browser path is an alternative front door for small/simple mascots.

---

## Decisions (locked in brainstorming, 2026-06-22)

1. **Port scope:** both stages — vectorize (PNG→quantized rects) **and** auto-segment (connected-
   component grouping into proposed parts). Keep the existing geometry naming heuristic
   (body/legs/antenna/eyes) as the default, with the per-asset parts-spec override (ADR-0010).
2. **Big images:** auto nearest-neighbour downscale to a max dimension (default 256px, adjustable) on
   upload, plus retain the 8000-rect guard as a backstop.
3. **Correctness bar:** *equivalent + valid*, not byte-parity. Node-test the pure modules on synthetic
   grids; verify the full browser path produces a VALID riggable result. Byte-parity with the
   PowerShell scripts is a best-effort spot-check, not a gate (canvas vs System.Drawing decode and
   float/sort differences make strict parity brittle).
4. **No review.html port:** ADR-0002 ("assisted, not full-auto") is satisfied by the editor itself —
   the user sees, recolours, splits, and renames the proposed parts. The separate confirm page the
   terminal flow emits is redundant in-browser.

---

## Architecture

Two new pure modules plus thin canvas glue. The PNG path reproduces what `mf forge` does, then hands
to the **existing, already-tested** editor at exactly one convergence point.

| Module | Kind | Mirrors | Responsibility |
|---|---|---|---|
| `tools/rig-editor/vectorize.js` | pure ESM, node-tested | `tools/vectorize-pixel.ps1` | RGBA grid → palette (deterministic median-cut, largest-gap split) → quantized grid → RLE per row + greedy vertical merge → flat rects + palette + bounds |
| `tools/rig-editor/segment.js` | pure ESM, node-tested | `tools/segment-parts.ps1` | flat rects → connected-component union-find (8-adjacency, same colour) → blobs → heuristic naming (+ optional spec vocab) → pivots → sliver absorption → **segmented-SVG string** |
| canvas glue in `tools/rig-editor/app.js` | thin, unverified | `spikes/03-second-asset/prep-source.ps1` + decode | PNG → `<canvas>` nearest-neighbour downscale → `getImageData` → `{ w, h, rgba }` |

**Why `segment.js` emits an SVG string rather than a model object:** the editor already has a tested
`loader.parseSegmented()` that builds the model and performs the D7 parts-spec vocabulary merge. The
PNG path therefore produces the *same* segmented SVG the PowerShell script would, then feeds the
existing loader. PNG-upload and SVG-drop converge there; everything downstream (model, marquee,
split, presets, export) is unchanged and already covered by tests.

### Module boundary detail

- `vectorize.js` takes an in-memory grid, **not** a PNG — the only browser-only step is the canvas
  decode, which stays in `app.js` glue. This keeps quantize + RLE fully node-testable with synthetic
  pixel arrays (no PNG decoder dependency).
  - Exposed (so each step is independently testable): `quantize(histogramOrGrid, n, alphaThreshold)`
    → palette; `meshRects(quantGrid, w, h)` → rects; and an orchestrator
    `vectorizeRaster({ rgba, w, h }, { colors = 6, alphaThreshold = 1 })` → `{ rects, palette, bounds, viewBox }`.
- `segment.js` takes the flat rects (in-memory objects from `vectorize.js`, no intermediate flat-SVG
  round-trip) and an optional parts-spec, and returns the segmented-SVG string. The single
  serialize→parse hop is segment→SVG→loader, deliberately, to reuse the loader.

---

## Data flow

```
PNG file ─┐
          ├─(app glue)→ downscale canvas (nearest-neighbour) → getImageData {w,h,rgba}
          │                    │
          │              vectorize.js → flat rects + palette
          │                    │
          │               segment.js → segmented.svg string
          │                    │
          └────────→ loader.parseSegmented() ──→ model ──→ [existing editor unchanged]
.svg drop ───────────────────────────────────┘  (today's path)
```

The dropzone (and file picker) accept `.png` in addition to `.svg`. On a PNG, run the new chain; on
an SVG, run today's `loadText` path verbatim.

---

## Big-image handling

- On upload, downscale to a max dimension (default **256px**, exposed as a small numeric input) using
  a `<canvas>` with `imageSmoothingEnabled = false` (nearest-neighbour — matches `prep-source.ps1`).
- `segment.js` retains the **8000-rect guard**: above it, throw a clear, actionable message
  ("downscale further, or this asset belongs in terminal `mf forge`"). The guard fires before the
  O(n²) union, so failure is instant.
- v1 target is small/simple mascots. **No Web Worker** in v1 (YAGNI); revisit only if a real asset
  janks the main thread under the downscale cap.

---

## Error handling

| Condition | Behaviour |
|---|---|
| Dropped file is neither `.png` nor `.svg` | `status()` message; ignore. |
| PNG decode fails | `status()` error; no crash. |
| Zero opaque pixels above `alphaThreshold` | `status()` error (mirror script's `Fail`). |
| Rect count over guard after downscale | `status()` error with the downscale/terminal hint. |
| Transparent pixels (alpha < `alphaThreshold`, default 1) | emit no geometry — preserves the transparent pose, same contract as the script. |

---

## Testing (equivalent + valid)

- `tools/rig-editor/vectorize.test.mjs` — synthetic RGBA grids → known palette + meshed rects;
  transparency excluded; determinism (stable sort, largest-gap split tie-breaks; r>g>b axis ties).
- `tools/rig-editor/segment.test.mjs` — synthetic flat rects (small body + leg + antenna layout) →
  expected parts, pivots, and sliver absorption; the emitted segmented SVG parses cleanly through the
  existing `loader` + `validator`; `everyRectGrouped()` holds.
- End-to-end assertion (within one of the above) — synthetic grid → `vectorize` → `segment` →
  `loader` → model → `exporter` → `validate` is green. No PNG needed under node.
- Browser spot-check (preview eval, logged not gated) — upload committed
  `assets/devbrain-mascot-reference-v1.png`, confirm proposed parts appear; compare emitted rect
  count to the committed `docs/buildable-slice/generated/devbrain-flat.svg` as best-effort parity.
- `tools/check-all.ps1` — add `"vectorize", "segment"` to the P5 rig-editor test list.
- `tools/rig-editor/README.md` — document PNG upload + downscale control; note big assets still use
  terminal `mf forge`; remove the "Phase 2 deferred" line.

---

## Out of scope

- Web Worker / progress UI (revisit only on measured jank).
- React+GSAP emit of arbitrary part ids (`PART_IDS`-from-rig — separate pipeline v1.1 backlog item).
- Undo history, multi-asset project management, new animation states.
- Strict byte-parity gating against the PowerShell scripts.
