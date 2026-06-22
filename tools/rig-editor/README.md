# Rig editor (browser) — Phase 1

A dependency-free static page that replaces the one painful manual step in the pipeline:
hand-authoring `<asset>-rigged.json`. It sits **between** `mf forge` and `mf emit` and changes
nothing else.

```
pwsh ./mf.ps1 forge <asset>     →   <asset>-segmented.svg
        ↓  drop into the editor
  tools/rig-editor   (assign parts · roles · pivots · presets · live preview · validate)
        ↓  export
  <asset>-manual-part.svg  +  <asset>-rigged.json  (+ parts-spec.json)
        ↓
pwsh ./mf.ps1 emit <asset>      →   animated SVG+CSS / React+GSAP mascot
```

## Use it

1. Serve the repo over HTTP (ESM + `fetch`, so `file://` is blocked by CORS):
   `python -m http.server 4178` then open `http://localhost:4178/tools/rig-editor/index.html`.
2. Give it an asset, either way:
   - **Drop a PNG** — it is vectorised + segmented in-browser into proposed parts (no terminal). Set
     **max px** (nearest-neighbour downscale cap, default 256) and **colours** (palette size, default 6).
   - **Or drop a `segmented.svg`** produced by `pwsh ./mf.ps1 forge <asset>` (better for large assets).
4. For each part: pick a **role** (`core` breathes · `limb` walks/rotates · `accent`
   shakes/blinks/recoils · `passive` still), set a **bone** name, press **p** then click the canvas
   to place its **pivot**, and choose a **preset** per state. Use the preview buttons to watch it move.
   - **Split a fused part:** when `mf forge` colour-fuses regions into one part (e.g. wheels stuck in
     `part-body`), **drag a marquee** on the canvas to select the enclosed rects, type a target part id,
     and press **move** to peel them into their own part. (Plain click = part-select; drag = marquee.)
5. **Export** — downloads `<asset>-manual-part.svg`, `<asset>-rigged.json`, and a `parts-spec.json`
   write-back. Drop them into `assets/<asset>/`.
6. `pwsh ./mf.ps1 emit <asset>`.

Unassigned rects are never lost — they land in a still `part-background` group.

## How it's built

Vanilla ESM + SVG, **zero build, no dependency** (matches `runtime/`). The pure-logic core is
node-tested (`*.test.mjs`, run by `tools/check-all.ps1` → *P5 rig-editor*); `app.js` is thin DOM glue.

| Module | Role |
|---|---|
| `model.js` | rect-granular rig state (assign/split/rename/role/pivot/preset); every rect stays in exactly one group |
| `loader.js` | parse `segmented.svg` → model; merge a `parts-spec.json` vocabulary |
| `pivot.js` | dragged handle → CSS `transform-origin` + canonical pivot |
| `select.js` | marquee hit-test: rects fully enclosed by a drag box (full-containment policy) |
| `vectorize.js` | PNG RGBA grid → flat rects (median-cut quantize + RLE/greedy-mesh); browser port of `vectorize-pixel.ps1` |
| `segment.js` | flat rects → proposed parts (CCL + geometry naming + joint pivots) → segmented.svg; port of `segment-parts.ps1` |
| `presets.js` | role-keyed recipe templates (generalised from devbrain + land-rover), stamped with the chosen part id at export |
| `validator.js` | pre-flight the load-bearing `rigged.json` v2 invariants (`mf check` stays canonical) |
| `exporter.js` | serialise model → the `mf emit` input pair + `parts-spec.json` |

Run the self-checks directly: `node tools/rig-editor/exporter.test.mjs` (the golden round-trip:
committed devbrain `segmented.svg` → export → validate → `mf emit`).

## Scope

**Does:** in-browser PNG → vectorise → segment → propose parts (Phase 2); part structure (incl.
drag-marquee rect-level *split* of colour-fused regions), roles, pivots, preset animations, live
preview, valid export. Also loads a terminal-produced `segmented.svg` directly.
**Doesn't (deferred):** preset-*feel* tuning and the README screenshot — owner tasks.
**Big assets:** the segmenter's CCL is O(n²), guarded at 8000 rects. Downscale further (raise/lower
**max px**), or rig large assets via terminal `mf forge`.

> **Preview feel** is approximate (CSS injection); `mf emit` output is the source of truth.
