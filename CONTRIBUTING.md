# Contributing to mascot-forge

Thanks for looking. mascot-forge is MIT and portfolio-first — issues, forks, and PRs are welcome.

## Prerequisites

- **Node.js** — everything that matters runs on Node: the full regression gate, every self-check,
  and the React+GSAP emit.
- **PowerShell 7+** (`pwsh`) — *optional*. Only the `mf.ps1` batch path (`forge` / `emit`) is
  PowerShell. You do not need it to run the gate or to contribute a fix.
- **Python 3** (optional) — only to serve the demos locally (`python -m http.server`); `fetch()` is
  blocked on `file://`.

**One install, once per clone**, before the gate will pass:

```bash
cd mcp && npm ci
```

The shipped runtime and the emitters are dependency-free — that is the claim the gate exists to
protect, and it holds. The *gate itself* is not: its P5 row includes a segmentation-quality test that
decodes a PNG, and its P6 row exercises the MCP server, and both use the dependencies under `mcp/`.
There is no build step, and nothing is installed at the repo root (the gate asserts no root
`package.json` exists).

## Forge an asset

The pipeline is **assisted** by design — Phase 2 stops for a human to confirm the part segmentation
before a rig is authored (see [ADR-0002](docs/adr/0002-assisted-not-full-auto.md)). Workflow:

```powershell
pwsh ./mf.ps1 forge <asset>   # P1 vectorize → P2 segment, then STOPS for your review
#   → drop <asset>-segmented.svg into the browser rig editor (below) instead of hand-writing JSON
pwsh ./mf.ps1 emit  <asset>   # P3 emit SVG+CSS + React+GSAP from the confirmed rig
pwsh ./mf.ps1 check           # full regression gate
```

Author the rig **visually** with the [browser rig editor](tools/rig-editor/README.md) (forge → edit
→ emit) rather than hand-writing `rigged.json` — it exports the `manual-part.svg` + `rigged.json` pair
`mf emit` consumes.

`assets/<asset>/parts-spec.json` must exist; source PNG, rig, and out-dir default by convention and
are overridable (`-SourcePath`, `-RigPath`, `-OutDir`, …). Oversized sources: segmentation's CCL is
O(n²) over flat rects and fails fast above `-MaxRects` (default 8000) — downscale **nearest-neighbor**
first (`spikes/03-second-asset/prep-source.ps1`, [ADR-0009](docs/adr/0009-vectorize-quantize-anti-aliased-source.md)).

## The one rule for a PR

The regression gate must stay green:

```bash
cd mcp && npm ci && cd ..       # once per clone; P5 and P6 need these
node tools/gate/check-all.mjs   # full P1–P7 gate PASSes, exit 0
```

`pwsh tools/check-all.ps1` still works and prints the same thing — it is now a thin shim over the
line above, kept so `mf check` and existing habits keep working.

Keep generated artifacts as **build output** — regenerate them via `mf emit`, don't hand-patch.
Don't introduce a new runtime dependency for what a few lines can do.

## Regenerating the README hero GIFs

`docs/hero-mascot.gif` and `docs/hero-mcp-live.gif` are captures of the live demo pages
([`docs/buildable-slice/showcase.html`](docs/buildable-slice/showcase.html) and
[`docs/buildable-slice/layered-live-demo.html`](docs/buildable-slice/layered-live-demo.html)), not
hand-drawn art. They are regenerable-but-ungated: nothing checks their freshness, so if the rig, the
CSS, or the demo markup changes, re-run the capture rather than letting the README quietly go stale.

```powershell
python -m http.server 4178      # from the repo root, in one terminal
node tools/capture-hero-gifs.mjs  # in another — needs Playwright (tests/node_modules) and ffmpeg on PATH
```

Not part of the gate: it needs a real browser and ffmpeg, neither of which the zero-dependency
runtime/gate may depend on. If ffmpeg isn't on PATH, install it (`winget install ffmpeg` on Windows) —
the script has no fallback renderer.
