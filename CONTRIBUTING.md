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

## Help wanted — capture the showcase hero

The README hero is an interim still. The live two-asset before/after page
([`docs/buildable-slice/showcase.html`](docs/buildable-slice/showcase.html)) is the real thing but a
GIF/screenshot of it can only be captured by a human running it in a browser:

1. `python -m http.server 4178` from the repo root.
2. Open `http://localhost:4178/docs/buildable-slice/showcase.html`.
3. Record the auto-cycling idle → active → alert loop; export a GIF.
4. Replace `docs/hero-mascot.png` and drop the interim-still note in the README.

### …and the MCP live-data hero (P-D) — optional, the demo already works without it

The headline story — an agent-rigged mascot reacting to live data — runs at
[`docs/buildable-slice/layered-live-demo.html`](docs/buildable-slice/layered-live-demo.html), the
**layered** path. The README hero slot links straight to that page and it genuinely animates on its
own — a GIF is **not a prerequisite**, only an optional upgrade for people skimming the README without
running it. If you'd like to capture one anyway:

1. (Optional) regenerate the agent-rigged SVG: `cd mcp && npm install && node build-robot-demo.mjs`.
2. `python -m http.server 4178` from the repo root.
3. Open `http://localhost:4178/docs/buildable-slice/layered-live-demo.html`.
4. Screen-record one full idle → active → alert → idle cycle (~9 s); export a GIF.
5. Save it as `docs/hero-mcp-live.gif` and swap it into the README's `<!-- HERO SLOT -->` — do this
   only if you want to; the linked page is the real demo either way.

The same page also exists in its **raster** form,
[`docs/buildable-slice/mcp-live-demo.html`](docs/buildable-slice/mcp-live-demo.html) (regenerate with
`node build-smiley-demo.mjs` from `mcp/`), for anyone without a layered source to rig.
