// segment-quality.test.mjs — a 10-case rigging-quality battery for the segmenter + region assignment.
// Locks the quality bar that regressions slip past: never collapse a multi-part image to one blob,
// never lose geometry (D6), always emit valid pivots, and surface a mis-aimed region instead of
// silently dropping a part. Pure where it can be; case 10 drives the MCP tools over a synthetic PNG.
// Run: `node tools/rig-editor/segment-quality.test.mjs`.
import assert from "node:assert/strict";
import { PNG } from "../../mcp/node_modules/pngjs/lib/png.js";
import { segment } from "./segment.js";
import { parseSegmented } from "./loader.js";
import { startFromImage, assignRegion } from "../../mcp/tools.mjs";

let pass = 0;
const ok = (label, fn) => { fn(); pass++; console.log(`  [${pass}/10] ${label}`); };

// helpers
const partsOf = (rects, vb) => segment(rects, { viewBoxSize: vb }).parts;
const totalRects = (parts) => parts.reduce((n, p) => n + p.rects.length, 0);
const finiteIn = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

// 1. a single solid blob stays exactly one part (no spurious splitting, no loss)
ok("single solid blob -> 1 part", () => {
  const parts = partsOf([{ x: 5, y: 5, w: 20, h: 20, fill: "#777" }], 32);
  assert.equal(parts.length, 1);
  assert.equal(totalRects(parts), 1, "no geometry lost");
});

// 2. two side-by-side blobs never collapse into one part
ok("two side-by-side blobs -> 2 parts", () => {
  const parts = partsOf([
    { x: 0, y: 10, w: 30, h: 20, fill: "#aaa" },
    { x: 40, y: 12, w: 20, h: 16, fill: "#222" },
  ], 64);
  assert.equal(parts.length, 2, "must not collapse to a single part");
});

// 3. concentric rings (3 colours, all enclosed) yield 3 parts, not 1
ok("concentric 3 colours -> 3 parts", () => {
  const parts = partsOf([
    { x: 0, y: 0, w: 60, h: 60, fill: "#111" },
    { x: 14, y: 14, w: 32, h: 32, fill: "#888" },
    { x: 24, y: 24, w: 12, h: 12, fill: "#fff" },
  ], 60);
  assert.equal(parts.length, 3);
});

// 4. a row of many distinct colours never collapses
ok("6-colour row -> >=2 parts", () => {
  const rects = Array.from({ length: 6 }, (_, i) => ({
    x: i * 10, y: 0, w: 8, h: 10, fill: ["#100000", "#001000", "#000010", "#101000", "#100010", "#001010"][i],
  }));
  rects[0].w = 9; rects[0].h = 12;
  assert.ok(partsOf(rects, 60).length >= 2);
});

// 5. a mascot silhouette gets SEMANTIC names (body/leg/antenna/eyes), not generic part-N
ok("mascot silhouette -> semantic part names", () => {
  const parts = partsOf([
    { x: 10, y: 10, w: 20, h: 20, fill: "#ccc" }, // body
    { x: 12, y: 30, w: 4, h: 10, fill: "#333" },  // leg below
    { x: 18, y: 2, w: 4, h: 8, fill: "#3c3" },    // antenna above
    { x: 14, y: 14, w: 2, h: 2, fill: "#000" },   // eye island
  ], 48);
  assert.deepEqual(parts.map((p) => p.id), ["part-body", "part-leg-left", "part-antenna", "part-eyes"]);
});

// 6. KNOWN CEILING: a single-colour silhouette (ears/tail fused to body by 8-adjacency) cannot be
// auto-split by a colour segmenter — body + its one colour-island (eyes) is all we get. Documents the
// cat case. ponytail: spatial subdivision of the dominant blob is the upgrade path if this bites.
ok("single-colour silhouette -> body + island only (documented ceiling)", () => {
  const parts = partsOf([
    { x: 10, y: 8, w: 40, h: 44, fill: "#3a2f3e" },  // body+ears+tail, all one colour = one blob
    { x: 22, y: 18, w: 16, h: 6, fill: "#fbd778" },  // eye island (distinct colour, inside upper body)
  ], 64);
  const ids = parts.map((p) => p.id).sort();
  assert.deepEqual(ids, ["part-body", "part-eyes"], "fused silhouette yields body + eyes, nothing more");
});

// 7. geometry conservation (D6): every input rect lands in some part, none duplicated or dropped
ok("geometry conserved across a complex input (D6)", () => {
  const rects = [
    { x: 0, y: 0, w: 40, h: 40, fill: "#222" },
    { x: 8, y: 42, w: 6, h: 12, fill: "#555" },
    { x: 30, y: 42, w: 6, h: 12, fill: "#555" },
    { x: 18, y: 4, w: 4, h: 8, fill: "#2c2" },
    { x: 12, y: 10, w: 3, h: 3, fill: "#000" },
    { x: 39, y: 20, w: 1, h: 1, fill: "#f0f" }, // stray sliver
  ];
  const parts = partsOf(rects, 64);
  assert.equal(totalRects(parts), rects.length, "rect count out == in (nothing lost or cloned)");
});

// 8. loader round-trip: emitted SVG re-parses with every rect grouped, count preserved
ok("loader round-trip keeps every rect grouped", () => {
  const rects = [
    { x: 0, y: 0, w: 30, h: 30, fill: "#aaa" },
    { x: 40, y: 0, w: 20, h: 20, fill: "#222" },
  ];
  const { svg } = segment(rects, { viewBoxSize: 64 });
  const model = parseSegmented(svg);
  assert.ok(model.everyRectGrouped(), "no ungrouped rects after round-trip");
  assert.equal(model.rects().length, rects.length, "no rects lost through loader");
});

// 9. every proposed pivot is finite and inside the viewBox (no NaN / out-of-bounds joints)
ok("all pivots finite and within viewBox", () => {
  const vb = 48;
  const parts = partsOf([
    { x: 10, y: 10, w: 20, h: 20, fill: "#ccc" },
    { x: 12, y: 30, w: 4, h: 10, fill: "#333" },
    { x: 18, y: 2, w: 4, h: 8, fill: "#3c3" },
  ], vb);
  for (const p of parts) {
    assert.ok(finiteIn(p.pivot.x, 0, vb), `${p.id} pivot.x in [0,${vb}]`);
    assert.ok(finiteIn(p.pivot.y, 0, vb), `${p.id} pivot.y in [0,${vb}]`);
  }
});

// 10. RIGGING FEEDBACK: a region that misses the art returns a warning + moved:0 instead of silently
// producing an empty part that drops from the export (the bug that lost the cat's ear).
ok("assign_region warns when it grabs 0 rects", () => {
  // 4x4 PNG: a single opaque red pixel at (1,1), everything else transparent.
  const png = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < png.data.length; i++) png.data[i] = 0;
  const set = (x, y, r, g, b) => { const o = (y * 4 + x) * 4; png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = 255; };
  set(1, 1, 220, 30, 30);
  const base64 = PNG.sync.write(png).toString("base64");
  const s = startFromImage({ base64, colors: 2 });
  // aim a region at the empty bottom-right corner — it must grab nothing and say so
  const miss = assignRegion({ session: s.session, box: { x: 0.7, y: 0.7, w: 0.25, h: 0.25 }, partId: "ghost" });
  assert.equal(miss.moved, 0, "region over empty space grabs no rects");
  assert.ok(miss.warning && /0 rects/.test(miss.warning), "a 0-rect region is surfaced as a warning");
});

console.log(`segment-quality.test.mjs: all ${pass}/10 cases passed.`);
