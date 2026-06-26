// Smoke test: the MCP server constructs and all tools register against the SDK (catches SDK-API drift).
// Run: `node mcp/server.test.mjs`.
import assert from "node:assert/strict";
import { buildServer } from "./server.mjs";

const server = buildServer();
assert.ok(server && server.constructor.name === "McpServer", "buildServer returns an McpServer");
assert.ok(server._registeredPrompts && server._registeredPrompts.rig_mascot, "rig_mascot prompt registers");

console.log("server.test.mjs: MCP server builds + tools/prompts register.");
