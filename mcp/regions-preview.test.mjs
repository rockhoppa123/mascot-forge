// regions-preview.test.mjs — the analyze-first preview artifact. Run: `node mcp/regions-preview.test.mjs`.
import assert from "node:assert/strict";
import { emitRegionsPreview } from "./regions-preview.mjs";

const html = emitRegionsPreview(
  "data:image/png;base64,AAAA",
  "0 0 100 80",
  [{ id: "part-body", role: "core", bbox: { x: 10, y: 10, w: 40, h: 40 } },
   { id: "part-eyes", role: "accent", bbox: { x: 20, y: 15, w: 8, h: 6 } }]
);
assert.ok(html.includes("data:image/png;base64,AAAA"), "embeds the source image");
assert.ok(html.includes('viewBox="0 0 100 80"'), "overlay uses the viewBox");
assert.ok(html.includes("part-body") && html.includes("part-eyes"), "labels every part");
assert.ok((html.match(/<rect /g) || []).length >= 2, "draws a box per part");
assert.ok(html.includes("Proposed parts"), "renders the key panel");
assert.ok(/breathes on idle/.test(html), "key says what the core part will do");
assert.ok(html.includes("#2563eb") && html.includes("#dc2626"), "parts get distinct colours");

// empty parts list still renders (no boxes, just the image)
const bare = emitRegionsPreview("data:image/png;base64,BBBB", "0 0 10 10", []);
assert.ok(bare.includes("data:image/png;base64,BBBB"), "renders with no parts");

console.log("regions-preview.test.mjs: all assertions passed.");
