# mascot-forge MCP — agent-driven rigging

An [MCP](https://modelcontextprotocol.io) server that lets a vision-capable agent (Claude) rig a flat-art
image into an **owned, animated mascot**. The agent supplies the one thing the deterministic pipeline
can't — **semantic part identification** ("that's a hand, that's the tongue") — and drives the *same*
node-tested modules the browser editor uses. No model is bundled; the agent is the brain.

> **Integration infra, not a runtime dependency.** This package has its own deps
> (`@modelcontextprotocol/sdk`, `pngjs`, `zod`); the emitted mascot stays dependency-free.

## Tools (10)
| Tool | What it does |
|---|---|
| `forge_start_from_layered_svg` | Primary entry: a layered vector SVG (Figma/Inkscape/Illustrator) where each top-level `<g>` is already a named part — no segmentation needed. **Ingests `rect` and `path` shapes only** — a layer containing `circle`, `ellipse`, `polygon`, `polyline`, or `line` is refused; convert to paths first, or use the browser rig editor, which handles all seven SVG shape types. |
| `forge_start_from_image` | Fallback entry when no layered source exists: PNG (base64 or project-relative path) → vectorise, grade the input, propose coarse parts. Pass `states` to declare a reactivity tier up front. Returns `{ session, viewBox, parts, inputGrade }`. Vectorises via one of two engines — see below. |
| `assign_region` | Move shapes inside a normalized box (`x,y,w,h` each 0..1 of the viewBox) into a part, with a role. The vision-driven core. |
| `set_part` | Set a part's motion metadata in one call: `role`, `kind`, `bone`, `pivot` (role-aware default if omitted), and `presets` per state. |
| `forge_propose` | Analyze-first report: a regions overlay plus a per-part motion plan (mirror-aware) for the human to confirm at a checkpoint. |
| `forge_apply_tweaks` | Inline checkpoint fixes without leaving chat: rename parts and/or change roles. |
| `forge_review` | Ask the human to approve / redo / open the editor via MCP elicitation (falls back to a plain question if the client can't elicit). |
| `forge_status` | Inspect progress: `{ parts, rigStatus:{idle,active,alert,animated,total}, ungroupedRects }`. |
| `forge_emit` | Validate + emit a self-contained animated SVG (+ demo HTML). Roles alone suffice — a default preset per role is applied. `target`: Output Target: `"svg-css"` (default) \| `"react-gsap"` \| `"both"`. |
| `forge_open_editor` | Deep-fix handoff: emit the rig as a self-describing SVG the browser rig editor loads **animated** via `?rig=`, for manual fixing. |

Plus a `rig_mascot` guided prompt (surfaces as a slash command in the host) that scripts the checkpointed
flow: pick a reactivity tier → grade → propose + present the motion plan → confirm → emit.

## The guided agent loop
1. Ask the user for a reactivity tier — Simple (`["idle"]`), Standard (`idle/active/alert`), or Signals
   (adds `loading/error/success`) — and pass it as `states` to `forge_start_from_layered_svg` (or, as a
   fallback when no layered source exists, `forge_start_from_image`). The vocabulary is fixed at start.
2. For each part you SEE in the image, `assign_region({ session, box:{x,y,w,h}/*0..1*/, partId, role })`
   (`core`=body, `limb`=arm/leg, `accent`=eyes/tongue, `passive`=still); `set_part` for role/kind/pivot/
   presets per state.
3. `forge_propose` — show the regions overlay and the returned motion `plan`; checkpoint with the human
   (`forge_review`, or `forge_apply_tweaks` to fix names/roles and re-propose).
4. `forge_status` until `rigStatus` shows every declared state covered.
5. `forge_emit({ session, assetName })` → a validated, self-contained animated mascot — code you own.
   `forge_open_editor` is available at any point for a deep manual fix in the browser rig editor.

## Choosing a raster engine (file size vs. pixel fidelity)

`startFromImage` (`mcp/tools.mjs`) vectorises a raster source through one of two engines, and the
choice is entirely about **output weight**, not rig quality — both produce a fully riggable model.

- **`scanline` (default)** — one `<rect>` per contiguous run of same-colour pixels, preserving the
  source's exact per-pixel colour (including anti-aliasing). Faithful, but that fidelity is expensive:
  the shipped `devbrain-manual-part.svg` fixture is ~500 KB for a 192×192 pixel-art image, because an
  anti-aliased source produces thousands of near-duplicate colours, each needing its own `<rect>`.
- **`vtracer`** — proper contour tracing into compact `<path>` geometry. The same DevBrain source
  vectorises to ~5 KB through this engine — two orders of magnitude smaller, visually indistinguishable
  at icon/badge scale. The cost: one path per colour region, geometry-agnostic parts only (no
  per-pixel colour data), so it suits flat/limited-palette art better than a smoothly-shaded source.

**Rule of thumb:** default (`scanline`) for the primary rigged asset, where fidelity matters and the
file is served from your own app. Reach for `vtracer` when the output needs to be small and portable —
embedded in a README, a favicon, anywhere download weight or a hard size ceiling matters more than
per-pixel exactness.

Selectable over the wire: pass `engine: "vtracer"` (or omit for `"scanline"`) to `forge_start_from_image`.

## Run / connect

> **This folder is not standalone.** `tools.mjs` imports the shared pure modules from
> `../tools/rig-editor/*` and `../tools/emit-react-gsap/*`, and resolves paths against the repo root.
> Copying `mcp/` out on its own will fail at import time — run it from inside a full clone. That is
> deliberate: the server calls the same rig and emit code the browser editor and the gate use, rather
> than carrying a second copy that could drift.

```bash
cd mcp && npm install
node server.mjs            # stdio MCP server
npm test                   # the same 7 self-checks the gate's P6 row runs
```
Wire it into an agent host (Claude Desktop / Claude Code `.mcp.json`):
```json
{ "mcpServers": { "mascot-forge": { "command": "node", "args": ["mcp/server.mjs"] } } }
```

## Status
The full ten-tool guided loop, proven by an agent-simulation test (the **smiley worked example** run
tool-by-tool on a synthetic multi-block PNG → all states covered → valid animated SVG), an in-memory-
transport protocol test, and a VTracer-integration test — all over the shared modules the browser editor
also uses. Logs go to stderr (stdout is the protocol). Paths are restricted to the project root.
