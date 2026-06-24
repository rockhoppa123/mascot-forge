// Protocol smoke test (M4): drive the server over the SDK's in-memory transport with a REAL client, so
// the actual MCP wire path is exercised — tool registration, JSON-Schema (zod) validation, request/
// response framing, and the structured error contract — not just construction (server.test.mjs) or the
// handlers in isolation (tools.test.mjs). Catches SDK-API drift a fresh agent host would hit.
// Run: `node mcp/protocol.test.mjs` (after `npm install`).
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ElicitRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { buildServer } from "./server.mjs";

// A 90x90 PNG: three stacked opaque colour blocks on transparent — core/limb/accent candidates that,
// once assigned, cover all three Animation States so forge_emit validates (the blocks worked example).
function threeBlockPngBase64() {
  const w = 90, h = 90, png = new PNG({ width: w, height: h });
  const set = (x, y, c) => { const i = (y * w + x) << 2; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = [0, 0, 0, 0];
    if (x >= 10 && x < 80) {
      if (y >= 10 && y < 30) c = [220, 40, 40, 255];
      else if (y >= 35 && y < 55) c = [40, 200, 80, 255];
      else if (y >= 60 && y < 80) c = [40, 80, 220, 255];
    }
    set(x, y, c);
  }
  return PNG.sync.write(png).toString("base64");
}
const parseResult = (r) => JSON.parse(r.content[0].text);

// --- wire a real client to the server over the in-memory transport -------------------------------
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const server = buildServer();
const client = new Client({ name: "protocol-smoke", version: "0.0.0" }, { capabilities: {} });
await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

try {
  // 1. tools/list returns the five tools with their schemas
  const { tools } = await client.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names,
    ["assign_region", "forge_emit", "forge_propose", "forge_review", "forge_start_from_image", "forge_start_from_layered_svg", "forge_status", "set_part"],
    "all eight tools are advertised over the protocol");
  assert.ok(tools.every((t) => t.description && t.inputSchema), "every tool ships a description + inputSchema");

  // 2. the full chain over the wire: start -> assign_region -> forge_emit, all valid
  const started = parseResult(await client.callTool({
    name: "forge_start_from_image", arguments: { base64: threeBlockPngBase64(), colors: 4 },
  }));
  assert.ok(started.session && started.viewBox === "0 0 90 90", "start returns a session + viewBox over the wire");

  // carve the three blocks into core/limb/accent so all three states get a default-preset recipe
  const regions = [
    [{ x: 0.05, y: 0.05, w: 0.9, h: 0.30 }, "part-top", "core"],
    [{ x: 0.05, y: 0.36, w: 0.9, h: 0.27 }, "part-mid", "limb"],
    [{ x: 0.05, y: 0.62, w: 0.9, h: 0.27 }, "part-bot", "accent"],
  ];
  for (const [box, partId, role] of regions) {
    const assigned = parseResult(await client.callTool({ name: "assign_region", arguments: { session: started.session, box, partId, role } }));
    assert.ok(assigned.moved > 0, `assign_region grabbed shapes for ${partId} over the wire (moved=${assigned.moved})`);
  }

  const emitted = parseResult(await client.callTool({
    name: "forge_emit", arguments: { session: started.session, assetName: "wire" },
  }));
  assert.equal(emitted.ok, true, `forge_emit is valid over the wire: ${JSON.stringify(emitted.validation || emitted.error)}`);
  assert.ok(emitted.svgBytes > 0, "produced a self-contained svg over the wire");

  // 2b. the layered-SVG alt entry also works over the wire (parts named from layers, no segmentation)
  const layered = parseResult(await client.callTool({
    name: "forge_start_from_layered_svg",
    arguments: { svg: '<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g id="body"><rect x="10" y="10" width="20" height="20" fill="#ccc"/></g></svg>' },
  }));
  assert.deepEqual(layered.parts.map((p) => p.id), ["part-body"], "layered entry names the part from its layer over the wire");

  // 3. the structured error contract survives the protocol (handler error -> isError, not a crash)
  const err = await client.callTool({ name: "forge_start_from_image", arguments: {} });
  assert.equal(err.isError, true, "a handler error is reported as an MCP tool error, not a transport failure");
  assert.match(err.content[0].text, /base64 or path/, "the error message reaches the client");

  // 4. forge_review with a NON-eliciting client falls back to a plain result (never hangs)
  const rev = parseResult(await client.callTool({ name: "forge_review", arguments: { session: started.session } }));
  assert.equal(rev.elicitation, false, "forge_review degrades gracefully without client elicitation");
  assert.ok(Array.isArray(rev.parts), "fallback still returns the parts for the agent to relay");

  console.log("protocol.test.mjs: in-memory transport — tools/list + full chain + error contract green.");
} finally {
  await client.close();
  await server.close();
}

// 5. forge_review WITH an eliciting client returns the human's chosen action over the wire
{
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const eServer = buildServer();
  const eClient = new Client({ name: "elicit-smoke", version: "0.0.0" }, { capabilities: { elicitation: { form: {} } } });
  eClient.setRequestHandler(ElicitRequestSchema, async () => ({ action: "accept", content: { action: "approve" } }));
  await Promise.all([eServer.connect(st), eClient.connect(ct)]);
  try {
    const s2 = parseResult(await eClient.callTool({ name: "forge_start_from_image", arguments: { base64: threeBlockPngBase64(), colors: 4 } }));
    const rev2 = parseResult(await eClient.callTool({ name: "forge_review", arguments: { session: s2.session } }));
    assert.equal(rev2.elicitation, true, "elicitation ran with a capable client");
    assert.equal(rev2.action, "approve", "the human's chosen action is returned");
    console.log("protocol.test.mjs: elicitation checkpoint — capable client approve path green.");
  } finally {
    await eClient.close();
    await eServer.close();
  }
}
