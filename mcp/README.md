# mascot-forge MCP — agent-driven rigging (M2)

An [MCP](https://modelcontextprotocol.io) server that lets a vision-capable agent (Claude) rig a flat-art
image into an **owned, animated mascot**. The agent supplies the one thing the deterministic pipeline
can't — **semantic part identification** ("that's a hand, that's the tongue") — and drives the *same*
node-tested modules the browser editor uses. No model is bundled; the agent is the brain.

> **Integration infra, not a runtime dependency.** This package has its own deps
> (`@modelcontextprotocol/sdk`, `pngjs`, `zod`); the emitted mascot stays dependency-free.

## Tools (M2)
| Tool | What it does |
|---|---|
| `forge_start_from_image` | PNG (base64 or project-relative path) → vectorise → coarse parts. Returns `{ session, viewBox, parts }`. |
| `assign_region` | Move shapes inside a normalized box (`x,y,w,h` each 0..1 of the viewBox) into a part, with a role. The vision-driven core. |
| `set_part` | Set a part's motion metadata in one call: `role`, `bone`, `pivot` (0..1, role-aware default if omitted), `presets` per state. Changing role clears now-invalid presets; invalid preset/role pairs are rejected. Returns `{ part, rigStatus }`. |
| `forge_status` | Inspect progress: `{ parts, rigStatus:{idle,active,alert,animated,total}, ungroupedRects }`. Confirm every state has coverage before emit. |
| `forge_emit` | Validate + emit a self-contained animated SVG (+ demo HTML). Roles alone suffice — a default preset per role is applied; `set_part` lets the agent override. |

(M3 optional previews + layered-SVG; see the spec.)

## The agent loop
1. `forge_start_from_image({ base64 })` → session + coarse parts.
2. For each part you SEE in the image, `assign_region({ session, box:{x,y,w,h}/*0..1*/, partId, role })`
   (`core`=body, `limb`=arm/leg, `accent`=eyes/tongue, `passive`=still); read back `moved` and adjust.
3. `set_part({ session, partId, role, presets:{idle?,active?,alert?} })` per part to choose motion; omit
   `pivot` for a role-aware default (limb hinges at its joint, others at their bbox centre).
4. `forge_status({ session })` until `rigStatus` shows idle / active / alert all covered.
5. `forge_emit({ session, assetName })` → a validated, self-contained animated mascot — code you own.

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
**M2** — the full agent loop. `set_part` (role / bone / role-aware pivot / per-state presets, with
role-change preset cleanup) + `forge_status` (per-state coverage) on top of the M1 trio, all over the
shared modules. Proven by the agent-simulation test (M1 block + the **smiley worked example** run
tool-by-tool on a synthetic multi-block PNG → all states covered → valid animated SVG) and the
server-build smoke. Logs go to stderr (stdout is the protocol). Paths are restricted to the project root.
