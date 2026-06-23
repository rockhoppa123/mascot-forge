# mascot-forge MCP — agent-driven rigging (M1)

An [MCP](https://modelcontextprotocol.io) server that lets a vision-capable agent (Claude) rig a flat-art
image into an **owned, animated mascot**. The agent supplies the one thing the deterministic pipeline
can't — **semantic part identification** ("that's a hand, that's the tongue") — and drives the *same*
node-tested modules the browser editor uses. No model is bundled; the agent is the brain.

> **Integration infra, not a runtime dependency.** This package has its own deps
> (`@modelcontextprotocol/sdk`, `pngjs`, `zod`); the emitted mascot stays dependency-free.

## Tools (M1)
| Tool | What it does |
|---|---|
| `forge_start_from_image` | PNG (base64 or project-relative path) → vectorise → coarse parts. Returns `{ session, viewBox, parts }`. |
| `assign_region` | Move shapes inside a normalized box (`x,y,w,h` each 0..1 of the viewBox) into a part, with a role. The vision-driven core. |
| `forge_emit` | Validate + emit a self-contained animated SVG (+ demo HTML). Roles alone suffice — a default preset per role is applied. |

(M2 adds `set_part` / `forge_status` / role-aware pivots; M3 optional previews + layered-SVG; see the spec.)

## The agent loop
1. `forge_start_from_image({ base64 })` → session + coarse parts.
2. For each part you SEE in the image, `assign_region({ session, box:{x,y,w,h}/*0..1*/, partId, role })`
   (`core`=body, `limb`=arm/leg, `accent`=eyes/tongue, `passive`=still); read back `moved` and adjust.
3. `forge_emit({ session, assetName })` → a validated, self-contained animated mascot — code you own.

## Run / connect
```bash
cd mcp && npm install
node server.mjs            # stdio MCP server
npm test                   # agent-simulation + server-build smoke
```
Wire it into an agent host (Claude Desktop / Claude Code `.mcp.json`):
```json
{ "mcpServers": { "mascot-forge": { "command": "node", "args": ["mcp/server.mjs"] } } }
```

## Status
**M1** — `start_from_image` + `assign_region` + `forge_emit` over the shared modules, proven by an
agent-simulation test (synthetic image → assigned-by-region → valid animated SVG) and a server-build
smoke. Logs go to stderr (stdout is the protocol). Paths are restricted to the project root.
