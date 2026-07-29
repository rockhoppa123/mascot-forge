# mascot-forge

[![CI](https://github.com/rockhoppa123/mascot-forge/actions/workflows/ci.yml/badge.svg)](https://github.com/rockhoppa123/mascot-forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Runtime dependencies: none](https://img.shields.io/badge/runtime%20dependencies-none-brightgreen)
![Gate: P1–P7 green](https://img.shields.io/badge/gate-P1%E2%80%93P7%20green-brightgreen)

**Hand your agent a layered SVG — the layers you already named in Figma become an animated web
component you own, bound to your app's real data.** Each top-level layer becomes a named part — no
vision, no guessing anatomy. Two independent ways in: the mascot-forge **MCP**, so your agent can do
it, or the **browser editor**, which reads layers on its own without the MCP. Either way you get
editable **SVG/CSS or React+GSAP** whose animation **states bind to your app's live data** — no binary
runtime, no black box.

No layered source on hand? Both entry points also take a flat raster image as a fallback,
auto-proposing parts by vision for you to confirm — useful, but not the same guarantee as layers a
human already named.

The former DevBrain mascot now lives here as the flagship showoff asset: source sheets, exported poses,
and the old DevBrain runtime baseline are kept under [`assets/devbrain/`](assets/devbrain/) so the
project can prove the whole loop from existing art → MCP-assisted rig → owned animated code.

> The two differentiators are **named-layer rigging** (your Figma layers become parts with zero
> guessing — no vision, no invented anatomy) and the **live-data binding** (animation states wired to
> your app's data as code you own). See [Rig your mascot with your agent](#rig-your-mascot-with-your-agent-mcp)
> and the live demo above.

> **Scope:** input is a **layered SVG** (Figma/Illustrator/Inkscape export, each top-level `<g>` a named
> part) — or, as a fallback with no such source, a flat raster / clean vector image. Raster auto-part
> detection is a best-effort starting point — you finish the rig in the visual editor. Photographic
> input is out of scope either way.

![A mascot forged by mascot-forge — semantic parts that articulate and react to live state](docs/hero-mascot.png)

> _Interim still. The live before/after showcase animates two assets side by side — serve the repo
> and open [`docs/buildable-slice/showcase.html`](docs/buildable-slice/showcase.html). An animated
> GIF/screenshot of that page is the one remaining capture step (see [CONTRIBUTING](CONTRIBUTING.md))._

### Hand your layers to your agent → get an owned mascot that reacts to live data

<!-- HERO SLOT (P-D): record one full idle→active→alert cycle of the demo below as docs/hero-mcp-live.gif,
     then this image renders the headline story. Until then the link runs it live. -->

> _No GIF yet — and none is required: the demo below is a working, tested page, not a placeholder. A
> recording is an optional upgrade on top of it (see [CONTRIBUTING](CONTRIBUTING.md)), not a
> prerequisite. Serve the repo and open
> [`docs/buildable-slice/layered-live-demo.html`](docs/buildable-slice/layered-live-demo.html) — **the
> hero:** a layered SVG (each top-level `<g>` a named part) was rigged by an agent through the **MCP**
> (`forge_start_from_layered_svg` → `set_part` → `forge_emit`) into the self-contained SVG you see, then
> driven by the dependency-free [`runtime/mascot-state.js`](runtime/mascot-state.js) bound to a mock
> telemetry feed — no buttons, the state machine cycles idle → active → alert. Regenerate it with
> `node mcp/build-robot-demo.mjs`. No layered source on hand? The same story runs on the **raster**
> fallback path at [`docs/buildable-slice/mcp-live-demo.html`](docs/buildable-slice/mcp-live-demo.html),
> where a flat smiley PNG is auto-segmented and rigged instead — regenerate that one with
> `node mcp/build-smiley-demo.mjs`._

mascot-forge is an open-source pipeline that takes a **layered SVG** — a Figma/Illustrator/Inkscape
export where each top-level `<g>` is already a named part — and produces an **animated,
component-segmented mascot** that you drop into a React app. No layered export on hand? The same
pipeline also accepts a flat raster image (PNG, pixel-art first), vectorizing and auto-segmenting it
as a **fallback path** with best-effort parts you finish in the visual editor. Either way, and unlike a
black-box runtime, the output is **human-readable code you can read, edit, and own**: a `.tsx`
component, GSAP timelines (or pure SVG/CSS), and a small state machine that binds animation states to
your application's live data.

**Proven on two visually different assets** — a pixel-art creature (DevBrain) and a cartoon
vehicle (Land Rover) — forged by the same engine with **zero engine edits** (see the
[second-asset validation](spikes/03-second-asset/FINDINGS.md)). That is the difference between
*one hand-tuned demo* and *an engine*.

> Status: **v1 complete** (pre-1.0). Two entries feed one rig: a **layered SVG** goes straight to
> rig → emit → orchestrate; a **raster image** first runs vectorize → segment as a fallback
> preprocessing step. Both are verifiable with one command (`node tools/gate/check-all.mjs`). The raster path is
> proven on two visually different assets end-to-end; the layered path is proven on parser correctness
> plus one hand-authored example carried through the full editor/agent → export → emit loop — it has
> not been through the same cold-start playtest that stress-tested raster (see
> [`docs/research/landscape.md`](docs/research/landscape.md) §5). Scoped to the SVG+CSS / React+GSAP
> Output Targets; broader automation is post-1.0. See the [Run / Quickstart](#run--quickstart) section
> and [`docs/`](docs/).

---

## Why this exists

Modern AI is great at generating *static* mascots and *heavy* video loops. The painful
gap is the step *after* art exists: turning a flat image into an interactive,
data-driven web element. Today that means hours of manual work in Illustrator/Figma —
separating layers, setting transform-origins, hand-writing animation code — per asset.

Existing tools each solve part of this but leave the gap open:

- **Rive** — excellent interactive state machines and rigging, but ships a binary
  `.riv` file played by a ~200 KB WASM canvas runtime. You don't own the animation as
  editable code. (Size is not the argument — our own payload is the emitted SVG geometry and scales
  with the art; see [ADR-0007](docs/adr/0007-output-target-verdict-both-svg-css-default.md). Ownership is.)
- **Lottie / dotLottie** — great After-Effects-to-JSON playback (and now state
  machines), but again a JSON asset + a runtime player, not code you author.
- **AI mascot generators** (svgapp.ai, mascot.bot, …) — generate *their* art from a
  prompt. They don't rig *your* existing asset into *your* codebase.
- **Vectorizers** (VTracer, Potrace) — flatten an image into one path/colour stack with
  no semantic anatomy: legs, body, and antenna fuse into a rigid blob.

**The wedge:** nothing turns your art into *owned, editable* code — SVG/CSS or React+GSAP — whose
animation **states bind to your app's live data**. That data-reactive binding, as code you control, is
the part Rive and Lottie structurally can't give you. And since **GSAP became 100% free (all plugins,
commercial use) in April 2025**, the React+GSAP output carries no licensing asterisk.

## The showoff asset: DevBrain

mascot-forge starts as dogfooding. [DevBrain](https://github.com/) (the author's
self-hosted homelab dashboard) used to carry a pixel-art moustache mascot. That mascot has moved out
of DevBrain and into mascot-forge. Its old implementation was a **flipbook of pre-rendered PNG poses**
swapped per state, with whole-sprite motion — exactly why it looked "good but not pro": the legs and
antenna could not move independently. That asset is now the flagship showoff asset
(see [`assets/devbrain/`](assets/devbrain/)) and the baseline mascot-forge must beat.

## Pipeline (shipped — v1 buildable slice)

```
[ layered .svg ]                        [ image.png ]  (raster — fallback, no layered source)
  Figma/Illustrator export,                    │  ✅ Phase 1 — Ingest & Vectorize
  named <g> per part                           ▼                (pixel-grid → colour-quantized SVG)
       │                               [ flat SVG ]
       │                                     │  ✅ Phase 2 — Assisted Segmentation
       │                                     ▼      (AI proposes parts, human confirms)
       │                        [ semantic <g> layers + transform-origins ]
       └────────────────┬───────────────────┘
                         ▼
       ✅ Phase 3 — Rig & Emit (pluggable backend)
                         ▼
      [ React+GSAP component ]  ──or──  [ framework-agnostic SVG+CSS ]
                         │  ✅ Phase 4 — State Orchestrator (bind states to live telemetry)
                         ▼
      [ mascot that breathes on idle, walks on activity, panics on alert ]
```

The layered path skips Phase 1/2 entirely — the named layers *are* the semantic parts, no vectorizing
or segmenting needed. Raster is the fallback branch: it still needs Phase 1/2 to arrive at the same
"semantic `<g>` layers" shape before rigging.

See the [Technical Proposal](docs/technical-proposal.md) for the full architecture.

## Design decisions so far

| Decision | Choice | ADR |
|---|---|---|
| Scope | Reusable **engine**, not one mascot | [0001](docs/adr/0001-scope-engine-not-just-mascot.md) |
| Automation (v1) | **Assisted / human-in-the-loop** (full-auto is a stretch goal) | [0002](docs/adr/0002-assisted-not-full-auto.md) |
| Output | **Pluggable emitter**: React+GSAP ↔ SVG+CSS | [0003](docs/adr/0003-pluggable-emitter.md) |
| License | **MIT** (portfolio-first, fully open) | [0004](docs/adr/0004-mit-license.md) |
| PoC scope | **Pixel-art first** (clean grid → reliable trace) | [0005](docs/adr/0005-pixel-art-poc-first.md) |
| Build order | **Research-first buildable slice** (prove one path end-to-end) | [0006](docs/adr/0006-research-first-buildable-slice.md) |
| Output verdict | **Both targets; SVG+CSS default**, React+GSAP opt-in | [0007](docs/adr/0007-output-target-verdict-both-svg-css-default.md) |
| Rig contract | **`rigged.json` schema v2** (canonical pivots, structured channels) | [0008](docs/adr/0008-rigged-json-schema-v2-lock.md) |
| Vectorization | **Deterministic colour quantization** for anti-aliased source | [0009](docs/adr/0009-vectorize-quantize-anti-aliased-source.md) |

## Repository layout

```
mascot-forge/
├── README.md                  ← you are here
├── LICENSE                    ← MIT
├── CONTEXT.md                 ← project vocabulary + concept glossary
├── runtime/                   ← dep-free Phase-4 orchestrator core + node self-check
│   ├── mascot-state.js
│   └── mascot-state.test.mjs
├── mcp/                       ← the agent-rigging MCP server (its own deps; 10 guided tools)
├── tests/                     ← Playwright e2e for the editor + demos (dev-dependency only)
├── tools/                     ← emitters + structural checks (PowerShell + node)
│   ├── rig-editor/            ← browser rig editor (zero-dependency ESM, no build)
│   ├── vectorize-pixel.ps1    ← P1: PNG → colour-quantized flat.svg
│   ├── segment-parts.ps1      ← P2: proposed semantic segmentation
│   ├── emit-svg-css.ps1       ← P3: SVG+CSS Output Target emitter
│   ├── emit-react-gsap/       ← P3: React+GSAP emitter + useMascotState hook
│   ├── gate/                  ← the regression gate: zero-dep Node, runs on any OS
│   │   ├── check-flat-svg.mjs · check-segmented.mjs · check-buildable-slice.mjs
│   │   ├── check-orchestrator.mjs · emit-land-rover.mjs · svg-scan.mjs
│   │   └── check-all.mjs      ← runs every check above + the node determinism test
│   └── check-all.ps1          ← thin shim → node tools/gate/check-all.mjs
├── docs/
│   ├── product-discovery.md   ← problem, market gap, personas, scope, success criteria
│   ├── technical-proposal.md  ← architecture, phases, stack, open questions
│   ├── buildable-slice/       ← the v1 slice: rig fixture, emitter output, demos
│   │   ├── generated/         ← emitted SVG+CSS Output Target + flat/segmented SVGs
│   │   ├── orchestrator-demo.html  ← Phase-4 data-reactive demo
│   │   └── showcase.html      ← before (PNG) / after (forged) side-by-side
│   ├── research/              ← landscape, references, research-log, phase plans
│   └── adr/                   ← architecture decision records (0001–0011)
└── assets/
    └── devbrain/                 ← flagship showoff asset + legacy DevBrain baseline
```

## Rig your mascot with your agent (MCP)

An agent (e.g. Claude in Claude Desktop / Claude Code) drives the mascot-forge **MCP server** to emit
an owned, animated mascot — no terminal, no manual rigging. Two entries: hand it a **layered SVG**
(`forge_start_from_layered_svg`, the layers already are the parts) or a **raster image**
(`forge_start_from_image`, the fallback — the agent proposes parts by vision). The runtime artifact
stays dependency-free; the MCP lives in `mcp/` with its own deps.

**1. Install the MCP server's dependencies** (one-time; isolated to `mcp/`):

```bash
cd mcp && npm install
```

**2. Register the server with your agent host.** The repo ships a ready [`.mcp.json`](.mcp.json) at the
root (Claude Code auto-discovers it); or add this to your host config:

```json
{
  "mcpServers": {
    "mascot-forge": {
      "command": "node",
      "args": ["mcp/server.mjs"]
    }
  }
}
```

**3. Hand the agent your art and ask it to rig it.**

**Layered SVG (recommended):** `forge_start_from_layered_svg` — each top-level `<g>` becomes a part
named by its layer, nested groups included (see [`docs/guides/exporting-layers.md`](docs/guides/exporting-layers.md)
for the export rules, incl. the transform-flattening step it demands before ingest). Then `set_part`
per part (role, kind, bone, pivot, preset per state) and `forge_status` → `forge_emit`. No
segmentation, no region-guessing — the layer names are the semantics.

**Raster image (fallback, vision-guided):** the guided path (the `rig_mascot` prompt scripts it):

1. `forge_start_from_image` — vectorises, grades the input, proposes coarse parts; returns a `session`.
   Pass `states` to pick a reactivity tier (Simple `["idle"]` / Standard idle-active-alert / Signals
   adds loading-success-error).
2. `assign_region` — carve each part the agent *sees* (a box in `0..1` fractions of the viewBox + a role:
   `core` body / `limb` arm-leg / `accent` small mover / `passive` still); `set_part` — role, kind, bone,
   pivot (omit for a role-aware default), and a preset per state.
3. `forge_propose` — a regions overlay + a per-part motion plan (mirror-aware) to confirm at a checkpoint.
4. `forge_apply_tweaks` / `forge_review` — inline rename/role fixes and a human approve/redo/editor
   checkpoint (MCP elicitation when the host supports it).
5. `forge_status` then `forge_emit` — validate and write a self-contained animated SVG (+ demo HTML) you own.
   Pass `target: "react-gsap"` (or `"both"`) to emit the opt-in React+TS GSAP component instead of/alongside
   the dependency-free SVG+CSS default.

`forge_open_editor` completes the **ten tools**: a self-describing handoff into the browser rig editor
(returns a ready `?rig=` URL that loads the rig animated) — useful from either entry point, and the only
way to rig shapes the agent path can't ingest (see the honest-scope note below).

A runnable, no-live-agent reproduction of the whole raster loop is `mcp/build-smiley-demo.mjs` (it emits
the agent-rigged mascot behind the [live-data raster demo](docs/buildable-slice/mcp-live-demo.html)). Its
layered counterpart, `node mcp/build-robot-demo.mjs`, is a runnable, no-live-agent reproduction of the
whole layered loop: it emits the agent-rigged mascot behind the
[live-data hero demo](docs/buildable-slice/layered-live-demo.html) from
`assets/example-layered/robot.svg`, gated by its own freshness golden (`mcp/robot-golden.test.mjs`). The
tool chain is proven in CI by an agent-simulation test and an in-memory-transport protocol test
(`cd mcp && npm test`).

> **Honest scope — four limits, stated plainly:**
> 1. **The agent/MCP path only ingests `rect` and `path` layers.** A layer containing `circle`,
>    `ellipse`, `polygon`, `polyline`, or `line` is refused outright (`mcp/tools.mjs:199-204`) — convert
>    those to paths before export, or drop the file into the **browser rig editor** instead, which
>    handles all seven SVG shape types because it measures real DOM geometry (`getBBox`) rather than
>    parsing coordinates from text.
> 2. **The `mf.ps1` CLI has no layered entry at all.** Layered SVGs go through the browser editor or the
>    MCP — never `mf.ps1 forge` / `mf.ps1 emit`.
> 3. **`assets/example-layered/robot.svg` is hand-authored** to the ingest rules, not a captured
>    real-world Figma/Illustrator export — it proves the rules are internally consistent, not that a
>    real export from those tools comes out clean on the first try.
> 4. **What's proven, precisely:** the layered parser is correct, and one hand-authored example has
>    gone through the full loop — browser editor and MCP agent path alike — to an exported, downloadable
>    mascot. That is *not* the adversarial cold-start playtest that discredited raster auto-segmentation
>    (3-for-3 failures on unseen assets, [`docs/research/landscape.md`](docs/research/landscape.md) §5);
>    layered hasn't been run through an equivalent test yet.
>
> On the raster fallback: the agent supplies the *semantics* (which box is a hand) — the MCP does not
> guess anatomy on its own. The auto first-pass parts are a hint the agent re-segments by vision.
> Photographic input and a hosted auto-button are out of scope for v1.

## Run / Quickstart

Requirements: **PowerShell 7+** (`pwsh`) and **Node.js** (for the orchestrator self-check and the MCP).
No npm install, no build step for the runtime core — it's dependency-free.

### Fastest path: rig the shipped layered SVG (no CLI, no raster step)

1. Serve the repo over HTTP (`python -m http.server 4178`) and open the
   [browser rig editor](tools/rig-editor/README.md) at
   `http://localhost:4178/tools/rig-editor/index.html`.
2. Drop in [`assets/example-layered/robot.svg`](assets/example-layered/robot.svg) — seven named layers
   (Antenna, Head, Body, Left/Right Arm, Left/Right Leg) become parts immediately, no segmentation step.
3. Assign roles, pivots, and presets; preview the motion; export — a self-contained animated `.svg` +
   demo `.html`, no terminal involved.

Exporting your own Figma/Illustrator/Inkscape layers instead of using the shipped example? Follow
[`docs/guides/exporting-layers.md`](docs/guides/exporting-layers.md) for the naming and transform rules
the ingest expects. Prefer an agent to drive it? See
[Rig your mascot with your agent](#rig-your-mascot-with-your-agent-mcp) — `forge_start_from_layered_svg` is
the layered entry point there.

### Verify the gate

```bash
node tools/gate/check-all.mjs
```

Runs the whole pipeline in one command — P1 → P7, including the MCP/VTracer chain and the node
determinism test. Pure Node, zero dependencies, any OS; CI runs this same command on Linux.

`pwsh tools/check-all.ps1` still works and prints the same thing — it is a thin shim over the line
above, kept so `mf check` and existing habits keep working. PowerShell is not required to verify
this repo.

### Fallback: forge a new asset from a raster image (the `mf` CLI)

`mf.ps1` is a dependency-free dispatcher over the **raster** pipeline scripts (v1.2) — no Node CLI, no
install. **It has no layered entry**: a layered SVG never goes through `mf.ps1` — it goes through the
browser rig editor or the MCP, as above.

```powershell
pwsh ./mf.ps1 forge <asset>   # P1 vectorize → P2 segment, then stops for the human review (ADR-0002)
#   → drop <asset>-segmented.svg into the browser rig editor (below), then export the rig
pwsh ./mf.ps1 emit  <asset>    # P3 emit SVG+CSS + React+GSAP from the confirmed rig
pwsh ./mf.ps1 check            # full regression gate (alias for tools/check-all.ps1)
```

Between `forge` and `emit`, author the rig **visually** in the same
[browser rig editor](tools/rig-editor/README.md) (`tools/rig-editor/index.html`) used above — it also
loads a `segmented.svg` from this raster path — assign parts, roles, pivots, and animation presets,
preview the motion, and export the `manual-part.svg` + `rigged.json` pair instead of hand-writing JSON.

- It assumes `assets/<asset>/parts-spec.json` exists; source PNG, rig, and out-dir default by
  convention and are overridable (`-SourcePath`, `-RigPath`, `-OutDir`, …). `mf forge devbrain`
  reproduces the committed DevBrain output byte-for-byte.
- **Oversized sources:** segmentation's CCL is O(n²) over flat `<rect>`s, so `segment-parts.ps1`
  fails fast above `-MaxRects` (default 8000). Downscale a large source with **nearest-neighbor**
  first (`spikes/03-second-asset/prep-source.ps1`, ADR-0009) before forging.

### Regenerate the shipped demo output (optional)

```powershell
# Re-emit the SVG+CSS Output Target from the committed DevBrain rig contract (regenerates docs/buildable-slice/generated/)
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\emit-svg-css.ps1
```

The demos `fetch()` the generated SVG, so serve them over HTTP (file:// is blocked by CORS) — same
`python -m http.server 4178` as above. Then open:

- `http://localhost:4178/docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` — the generated SVG+CSS demo (manual state buttons).
- `http://localhost:4178/docs/buildable-slice/layered-live-demo.html` — **the hero:** a layered-SVG, MCP/agent-rigged mascot reacting to a live (mock) telemetry feed (idle → active → alert).
- `http://localhost:4178/docs/buildable-slice/mcp-live-demo.html` — the **raster** fallback: a flat-PNG, MCP/agent-rigged mascot reacting to the same live (mock) telemetry feed.
- `http://localhost:4178/docs/buildable-slice/orchestrator-demo.html` — Phase-4: the (hand-rigged DevBrain) mascot reacting to a live (mock) telemetry feed.
- `http://localhost:4178/docs/buildable-slice/showcase.html` — **before vs after for both assets** (DevBrain + Land Rover), forged and data-reactive side-by-side — the engine proof.

## License

[MIT](LICENSE) © 2026 Andrew Lawson
