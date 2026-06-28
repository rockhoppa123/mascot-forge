// Smoke test: the MCP server constructs and all tools register against the SDK (catches SDK-API drift).
// Run: `node mcp/server.test.mjs`.
import assert from "node:assert/strict";
import { buildServer, rigMascotPrompt } from "./server.mjs";

const server = buildServer();
assert.ok(server && server.constructor.name === "McpServer", "buildServer returns an McpServer");
assert.ok(server._registeredPrompts && server._registeredPrompts.rig_mascot, "rig_mascot prompt registers");

// the guided prompt scripts the new flow: declare signal states, present a motion plan, checkpoint.
const t = rigMascotPrompt({ image: "blip.png" }).messages[0].content.text;
assert.match(t, /blip\.png/, "prompt threads the image arg");
assert.match(t, /signal state/i, "prompt asks about app-signal states (loading/error/success)");
assert.match(t, /\bplan\b/i, "prompt presents a motion plan");
assert.match(t, /options|alternativ/i, "prompt presents per-part motion options");
assert.match(t, /continue/i, "checkpoint offers continue");
assert.match(t, /change/i, "checkpoint offers change");
assert.match(t, /forge_open_editor/, "points to the editor for live motion preview");
assert.match(t, /Simple|Standard|Signals/, "prompt offers reactivity tiers");
assert.match(t, /silhouette/i, "prompt steers silhouettes to whole-body");

console.log("server.test.mjs: MCP server builds + tools/prompts register; rig_mascot scripts the guided plan flow.");
