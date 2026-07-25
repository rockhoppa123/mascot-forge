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
| `forge_start_from_image` | PNG (base64 or project-relative path) → vectorise, grade the input, propose coarse parts. Pass `states` to declare a reactivity tier up front. Returns `{ session, viewBox, parts, inputGrade }`. |
| `forge_start_from_layered_svg` | Alt entry: a layered vector SVG (Figma/Inkscape/Illustrator) where each top-level `<g>` is already a named part — no segmentation needed. |
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
   (adds `loading/error/success`) — and pass it as `states` to `forge_start_from_image` (or
   `forge_start_from_layered_svg`). The vocabulary is fixed at start.
2. For each part you SEE in the image, `assign_region({ session, box:{x,y,w,h}/*0..1*/, partId, role })`
   (`core`=body, `limb`=arm/leg, `accent`=eyes/tongue, `passive`=still); `set_part` for role/kind/pivot/
   presets per state.
3. `forge_propose` — show the regions overlay and the returned motion `plan`; checkpoint with the human
   (`forge_review`, or `forge_apply_tweaks` to fix names/roles and re-propose).
4. `forge_status` until `rigStatus` shows every declared state covered.
5. `forge_emit({ session, assetName })` → a validated, self-contained animated mascot — code you own.
   `forge_open_editor` is available at any point for a deep manual fix in the browser rig editor.

## Run / connect
```bash
cd mcp && npm install
node server.mjs            # stdio MCP server
npm test                   # tools + server-build + protocol + VTracer-integration self-checks
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
