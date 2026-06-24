// mcp/vectorize-vtracer.test.mjs — VTracer wrapper smoke + SVG->model parse round-trip.
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { vtracerSvg, elementsFromVtracerSvg } from "./vectorize-vtracer.mjs";

// build a 16x16 PNG: a solid red square on a green field (two clear colour regions)
const png = new PNG({ width: 16, height: 16 });
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const o = (y * 16 + x) * 4, red = x >= 4 && x < 12 && y >= 4 && y < 12;
  png.data[o] = red ? 220 : 30; png.data[o + 1] = red ? 30 : 200; png.data[o + 2] = 30; png.data[o + 3] = 255;
}
const buf = PNG.sync.write(png);

// 1. wrapper returns an SVG with at least one <path>
const svg = vtracerSvg(buf, { colorPrecision: 6, filterSpeckle: 2 });
assert.ok(/<svg[\s>]/.test(svg) && /<path[\s>]/.test(svg), "vtracer emits an SVG with <path> elements");

// 2. parser yields >=1 element, each with a finite bbox and raw path markup
const { viewBox, elements } = elementsFromVtracerSvg(svg);
assert.ok(/^\d/.test(viewBox) || /\d+ \d+ \d+ \d+/.test(viewBox), "a viewBox is recovered");
assert.ok(elements.length >= 1, "at least one path element");
for (const el of elements) {
  assert.ok(Number.isFinite(el.x) && Number.isFinite(el.w) && el.w >= 0, "element has a finite bbox");
  assert.ok(/^<path[\s>]/.test(el.markup), "element carries its raw <path> markup");
  assert.ok(typeof el.fill === "string" && el.fill.length > 0, "element carries a fill colour");
}
// 3. the translate transform is folded into the bbox (VTracer positions shapes via translate, `d` is
// local) — without this, marquee selection sees every shape collapsed to the origin.
{
  const fake = `<svg width="20" height="20"><path d="M0 0 L10 0 L10 10 Z" fill="#abcabc" transform="translate(5,7)"/></svg>`;
  const { elements: els } = elementsFromVtracerSvg(fake);
  assert.deepEqual({ x: els[0].x, y: els[0].y, w: els[0].w, h: els[0].h }, { x: 5, y: 7, w: 10, h: 10 },
    "translate(5,7) shifts the local-coord path bbox to (5,7)");
}

console.log("vectorize-vtracer.test.mjs: all assertions passed.");
