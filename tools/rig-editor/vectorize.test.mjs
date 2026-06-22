// Self-check for the PNG vectorizer. No framework — node:assert, mirrors model.test.mjs. Pure logic
// only (no canvas): synthetic RGBA grids in, rects out. Run: `node tools/rig-editor/vectorize.test.mjs`.
import assert from "node:assert/strict";
import { quantize, meshRects, vectorizeRaster } from "./vectorize.js";

// helper: build an RGBA Uint8ClampedArray from a w*h array of [r,g,b,a] (a defaults to 255).
function grid(w, h, pixels) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a = 255] = pixels[i];
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = a;
  }
  return { rgba, w, h };
}
const R = [255, 0, 0], B = [0, 0, 255], T = [0, 0, 0, 0];

// --- two flat colours, full opacity: median-cut -> 2 palette entries, greedy-merged rects --------
{
  // 4x4: left two columns red, right two columns blue
  const px = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px.push(x < 2 ? R : B);
  const out = vectorizeRaster(grid(4, 4, px), { colors: 2 });
  assert.deepEqual(out.palette.slice().sort(), ["#0000ff", "#ff0000"], "palette is the two source colours");
  // rects grouped by colour asc, vertically merged into one block each
  assert.deepEqual(out.rects, [
    { x: 2, y: 0, w: 2, h: 4, fill: "#0000ff" },
    { x: 0, y: 0, w: 2, h: 4, fill: "#ff0000" },
  ], "each colour meshes to one 2x4 rect");
  assert.equal(out.viewBox, "0 0 4 4");
  assert.deepEqual(out.bounds, { minX: 0, minY: 0, maxX: 3, maxY: 3 });
}

// --- transparency: alpha < threshold emits no geometry; every opaque pixel lands in one rect ------
{
  const px = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px.push(x < 2 ? R : B);
  px[0] = T; // make (0,0) transparent
  const out = vectorizeRaster(grid(4, 4, px), { colors: 2 });
  const area = out.rects.reduce((n, r) => n + r.w * r.h, 0);
  assert.equal(area, 15, "15 opaque pixels => total rect area 15 (transparent pixel excluded)");
  const covers00 = out.rects.some((r) => 0 >= r.x && 0 < r.x + r.w && 0 >= r.y && 0 < r.y + r.h);
  assert.equal(covers00, false, "no rect covers the transparent pixel");
}

// --- largest-GAP split isolates a rare-but-salient accent instead of swallowing it ---------------
{
  // a dense near-black cluster (lots of pixels) + a single bright-green accent pixel
  const counts = new Map([
    [0x000000, 10], [0x010101, 10], [0x020202, 10], [0x00ff00, 1],
  ]);
  const palette = quantize(counts, 2).map(
    (p) => "#" + [(p >> 16) & 255, (p >> 8) & 255, p & 255].map((c) => c.toString(16).padStart(2, "0")).join("")
  );
  assert.ok(palette.includes("#00ff00"), "the lone green accent gets its own palette entry (gap-split, not median)");
}

// --- meshRects directly: a transparent hole splits a vertical run ---------------------------------
{
  // 1-wide, 3-tall column of one colour with the middle cell transparent
  const c = "#abcdef";
  const q = [c, null, c];
  const rects = meshRects(q, 1, 3);
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 1, h: 1, fill: c },
    { x: 0, y: 2, w: 1, h: 1, fill: c },
  ], "the hole prevents a single 1x3 merge");
}

// --- errors ------------------------------------------------------------------------------------
{
  const allClear = grid(2, 2, [T, T, T, T]);
  assert.throws(() => vectorizeRaster(allClear, { colors: 2 }), /no opaque pixels/);
  assert.throws(() => quantize(new Map([[0, 1]]), 0), /colors must be/);
}

console.log("vectorize.test.mjs: all assertions passed.");
