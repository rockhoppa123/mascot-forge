// Smoke test: the MCP server constructs and all tools register against the SDK (catches SDK-API drift).
// Run: `node mcp/server.test.mjs`.
import assert from "node:assert/strict";
import { buildServer } from "./server.mjs";

const server = buildServer();
assert.ok(server && server.constructor.name === "McpServer", "buildServer returns an McpServer");

console.log("server.test.mjs: MCP server builds + tools register.");
