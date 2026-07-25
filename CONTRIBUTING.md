# Contributing to mascot-forge

Thanks for looking. mascot-forge is MIT and portfolio-first — issues, forks, and PRs are welcome.

## Prerequisites

- **PowerShell 7+** (`pwsh`) — the pipeline tools are PowerShell.
- **Node.js** — for the dependency-free orchestrator self-check (and the React+GSAP emit).
- **Python 3** (optional) — only to serve the demos locally (`python -m http.server`); `fetch()` is
  blocked on `file://`.

No `npm install` and no build step are needed to run the core pipeline or the gate.

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

```powershell
pwsh tools/check-all.ps1   # full P1–P6 gate PASSes, exit 0
```

Keep generated artifacts as **build output** — regenerate them via `mf emit`, don't hand-patch.
Don't introduce a new runtime dependency for what a few lines can do.

## Help wanted — capture the showcase hero

The README hero is an interim still. The live two-asset before/after page
([`docs/buildable-slice/showcase.html`](docs/buildable-slice/showcase.html)) is the real thing but a
GIF/screenshot of it can only be captured by a human running it in a browser:

1. `python -m http.server 4178` from the repo root.
2. Open `http://localhost:4178/docs/buildable-slice/showcase.html`.
3. Record the auto-cycling idle → active → alert loop; export a GIF.
4. Replace `docs/hero-mascot.png` and drop the interim-still note in the README.

### …and the MCP live-data hero (P-D)

The headline story — an agent-rigged mascot reacting to live data — runs at
[`docs/buildable-slice/mcp-live-demo.html`](docs/buildable-slice/mcp-live-demo.html). Same human-only
capture step:

1. (Optional) regenerate the agent-rigged SVG: `cd mcp && npm install && node build-smiley-demo.mjs`.
2. `python -m http.server 4178` from the repo root.
3. Open `http://localhost:4178/docs/buildable-slice/mcp-live-demo.html`.
4. Screen-record one full idle → active → alert → idle cycle (~9 s); export a GIF.
5. Save it as `docs/hero-mcp-live.gif` — the README hero slot already points there.
