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
2. Give it an asset (recommended order — highest fidelity first):
   - **Drop a layered SVG** (Figma / Inkscape / Illustrator) — *recommended*. Each top-level layer/group
     becomes a named part automatically, with its real geometry (paths, curves, anything) carried
     through verbatim (ADR-0011). This is the cleanest path: the anatomy is already in the file.
   - **Drop a PNG** — vectorised + segmented in-browser into *best-effort* proposed parts (no terminal).
     Set **max px** (nearest-neighbour downscale cap, default 256) and **colours** (palette size, 6).
     Same-colour regions fuse — split them with the marquee (below).
   - **Or drop a `segmented.svg`** produced by `pwsh ./mf.ps1 forge <asset>` (good for large flat assets).
4. For each part: pick a **role** (`core` breathes · `limb` walks/rotates · `accent`
   shakes/blinks/recoils · `passive` still), set a **bone** name, press **p** then click the canvas
   to place its **pivot**, and choose a **preset** per state. Use the preview buttons to watch it move.
   - **Split a fused part:** when `mf forge` colour-fuses regions into one part (e.g. wheels stuck in
     `part-body`), **drag a marquee** on the canvas to select the enclosed rects, type a target part id,
     and press **move** to peel them into their own part. (Plain click = part-select; drag = marquee.)
5. **Export animated mascot** — one click downloads a **self-contained animated `.svg`** (it animates on
   its own — CSS is inlined) plus a standalone demo `.html` with state buttons. No terminal, no `mf emit`.
   - **Advanced — `rig files…`** — exports the raw `<asset>-manual-part.svg` + `<asset>-rigged.json` +
     `parts-spec.json` for `pwsh ./mf.ps1 emit <asset>` (the React+GSAP path / batch pipeline).

Unassigned rects are never lost — they land in a still `part-background` group.

## How it's built

Vanilla ESM + SVG, **zero runtime dependency** (matches `runtime/`). The pure-logic core is node-tested
(`*.test.mjs`, run by `node tools/gate/check-all.mjs` → *P5 rig-editor*); `app.js` is thin DOM glue, covered by a
Playwright smoke test (`tests/e2e/`, dev-dependency only — the runtime stays dependency-free).

> **Canonical pipeline:** `vectorize.js` + `segment.js` here are the source of truth. The PowerShell
> `vectorize-pixel.ps1` / `segment-parts.ps1` are a Windows-only legacy/batch path for `mf forge` — see
> their headers. Don't fork logic; change the JS.

| Module | Role |
|---|---|
| `model.js` | rect-granular rig state (assign/split/rename/role/pivot/preset); every rect stays in exactly one group |
| `loader.js` | parse `segmented.svg` → model; merge a `parts-spec.json` vocabulary |
| `layer-ingest.js` | layered vector SVG → model; layer name → part id; geometry-agnostic elements (ADR-0011) |
| `pivot.js` | dragged handle → CSS `transform-origin` + canonical pivot (bbox-aware) |
| `select.js` | marquee hit-test: rects fully enclosed by a drag box (full-containment policy) |
| `vectorize.js` | PNG RGBA grid → flat rects (median-cut quantize + RLE/greedy-mesh); browser port of `vectorize-pixel.ps1` |
| `segment.js` | flat rects → proposed parts (CCL + geometry naming + joint pivots) → segmented.svg; port of `segment-parts.ps1` |
| `presets.js` | role-keyed recipe templates (generalised from devbrain + land-rover), stamped with the chosen part id at export |
| `validator.js` | pre-flight the load-bearing `rigged.json` v2 invariants (`mf check` stays canonical) |
| `exporter.js` | serialise model → the `mf emit` input pair + `parts-spec.json` |
| `emit.js` | rig → animation CSS (shared by live preview + export) → a self-contained animated SVG + demo HTML |

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
