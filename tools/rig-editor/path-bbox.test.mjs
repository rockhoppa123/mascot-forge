import assert from "node:assert/strict";
import { pathBBox } from "./path-bbox.js";

// a simple triangle: M10 10 L30 10 L20 25 Z
{
  const bb = pathBBox("M10 10 L30 10 L20 25 Z");
  assert.deepEqual(bb, { x: 10, y: 10, w: 20, h: 15 });
}
// cubic with control points beyond the anchors -> bbox is the superset over all pairs
{
  const bb = pathBBox("M0 0 C0 40 40 40 40 0");
  assert.deepEqual(bb, { x: 0, y: 0, w: 40, h: 40 });
}
// comma + negative + decimal coordinates parse correctly
{
  const bb = pathBBox("M-2.5,-2.5 L7.5,-2.5 L7.5,7.5 Z");
  assert.deepEqual(bb, { x: -2.5, y: -2.5, w: 10, h: 10 });
}
console.log("path-bbox.test.mjs: all assertions passed.");
