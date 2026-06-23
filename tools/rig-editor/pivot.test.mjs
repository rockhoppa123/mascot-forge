// Self-check for the pivot geometry. A dragged handle (absolute viewBox coords) becomes a CSS
// transform-origin (% of the part's fill-box) + a canonical absolute pivot{x,y}.
// Run: `node tools/rig-editor/pivot.test.mjs`.
import assert from "node:assert/strict";
import { bboxOf, pivotToOrigin, originToPivot, dragToPivot, defaultPivotFor } from "./pivot.js";

// --- defaultPivotFor: the ONE role-aware default-pivot helper shared by editor + MCP + segment -----
// A limb hinges at its joint — the top-edge centre (hip/shoulder line) — so it rotates about where it
// meets the body. Every other role rotates/scales about its bbox centre.
{
  const bb = { x: 10, y: 20, w: 40, h: 40 }; // centre 30,40 ; top-edge centre 30,20
  assert.deepEqual(defaultPivotFor("limb", bb), { x: 30, y: 20 }, "limb -> hip line (top-edge centre)");
  assert.deepEqual(defaultPivotFor("core", bb), { x: 30, y: 40 }, "core -> bbox centre");
  assert.deepEqual(defaultPivotFor("accent", bb), { x: 30, y: 40 }, "accent -> bbox centre");
  assert.deepEqual(defaultPivotFor("passive", bb), { x: 30, y: 40 }, "passive -> bbox centre");
  // matches the segment.js leg golden: leg bbox {12,30,4,10} -> {14,30}
  assert.deepEqual(defaultPivotFor("limb", { x: 12, y: 30, w: 4, h: 10 }), { x: 14, y: 30 }, "segment leg golden");
  // zero-area bbox is safe (no NaN)
  assert.deepEqual(defaultPivotFor("limb", { x: 5, y: 5, w: 0, h: 0 }), { x: 5, y: 5 }, "zero-area limb safe");
}

const rects = [
  { x: 10, y: 20, w: 20, h: 40 }, // -> bbox 10,20 .. 30,60
  { x: 20, y: 20, w: 30, h: 10 }, // -> extends x to 50
];
const bbox = bboxOf(rects);
assert.deepEqual(bbox, { x: 10, y: 20, w: 40, h: 40 });

// drag to the centre of the part -> "50% 50%" and the centre pivot
const mid = dragToPivot({ x: 30, y: 40 }, bbox);
assert.equal(mid.origin, "50% 50%");
assert.deepEqual(mid.pivot, { x: 30, y: 40 });

// top-left corner -> 0% 0%
const tl = dragToPivot({ x: 10, y: 20 }, bbox);
assert.equal(tl.origin, "0% 0%");

// bottom edge -> "50% 100%" (antenna-style)
assert.equal(dragToPivot({ x: 30, y: 60 }, bbox).origin, "50% 100%");

// a drag outside the bbox is clamped into it
const clamped = dragToPivot({ x: 999, y: -5 }, bbox);
assert.deepEqual(clamped.pivot, { x: 50, y: 20 });
assert.equal(clamped.origin, "100% 0%");

// round-trip: pivotToOrigin then originToPivot returns the same point
const origin = pivotToOrigin({ x: 22, y: 30 }, bbox);
assert.deepEqual(originToPivot(origin, bbox), { x: 22, y: 30 });

// zero-area bbox degrades to 0% (no divide-by-zero)
assert.equal(pivotToOrigin({ x: 5, y: 5 }, { x: 5, y: 5, w: 0, h: 0 }), "0% 0%");

console.log("pivot.test.mjs: all assertions passed.");
