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

// --- RELATIVE commands. Figma/Illustrator/Inkscape emit these by default; the 2026-07-30 cold-start
// playtest measured 0/10 and 0/9 layer bboxes matching DOM truth on real Adobe exports (worst error
// 259 user units on a 240x240 canvas) because the old implementation paired every number in `d`
// positionally and assumed absolute. Each case below is the relative spelling of an absolute case
// above and must produce the identical box.
{
  // relative triangle == the absolute triangle in case 1
  const bb = pathBBox("m10 10 l20 0 l-10 15 z");
  assert.deepEqual(bb, { x: 10, y: 10, w: 20, h: 15 });
}
{
  // relative cubic == the absolute cubic in case 2
  const bb = pathBBox("M0 0 c0 40 40 40 40 0");
  assert.deepEqual(bb, { x: 0, y: 0, w: 40, h: 40 });
}
// h/v carry ONE value each, so positional pairing shifts every later number in the path
{
  const bb = pathBBox("M10 10 h20 v15 z");
  assert.deepEqual(bb, { x: 10, y: 10, w: 20, h: 15 });
  assert.deepEqual(pathBBox("M10 10 H30 V25 z"), { x: 10, y: 10, w: 20, h: 15 });
}
// implicit repeated parameter sets: one command letter, many coordinate tuples
{
  const bb = pathBBox("M0 0 l10 0 10 10");
  assert.deepEqual(bb, { x: 0, y: 0, w: 20, h: 10 });
}
// z returns the current point to the subpath start, so a following relative m is measured from there
{
  // points: (10,10) (15,10) -> z back to (10,10) -> m0 20 lands (10,30) -> (15,30)
  const bb = pathBBox("M10 10 l5 0 z m0 20 l5 0");
  assert.deepEqual(bb, { x: 10, y: 10, w: 5, h: 20 });
}
// quadratic + shorthand smooth curves, relative and absolute
{
  assert.deepEqual(pathBBox("M0 0 q10 10 20 0"), { x: 0, y: 0, w: 20, h: 10 });
  assert.deepEqual(pathBBox("M0 0 Q10 10 20 0"), { x: 0, y: 0, w: 20, h: 10 });
  assert.deepEqual(pathBBox("M0 0 c0 10 10 10 10 0 s10 -10 10 0"), { x: 0, y: -10, w: 20, h: 20 });
}
// arcs: radii, rotation and the two flags are NOT coordinates. A semicircle of r=5 from (0,0) to
// (10,0) spans exactly 10 wide and bulges exactly 5 — measured, not padded.
{
  const bb = pathBBox("M0 0 a5 5 0 0 1 10 0");
  assert.equal(+bb.w.toFixed(4), 10, `arc width should be exact, got ${JSON.stringify(bb)}`);
  assert.equal(+bb.h.toFixed(4), 5, `arc height should be the true bulge, got ${JSON.stringify(bb)}`);
  assert.equal(+bb.x.toFixed(4), 0);
  // both endpoints are on the box edge, so the sweep direction decides which side the bulge is on
  assert.ok(bb.y === 0 || +(bb.y + bb.h).toFixed(4) === 0, `endpoints must sit on an edge, got ${JSON.stringify(bb)}`);
  // the opposite sweep flag must bulge the other way, and never produce the same box
  const other = pathBBox("M0 0 a5 5 0 0 0 10 0");
  assert.equal(+other.w.toFixed(4), 10);
  assert.equal(+other.h.toFixed(4), 5);
  assert.notEqual(other.y, bb.y, "sweep flag must change which side the arc bulges");
}
// a full-circle pair of arcs (the shape Inkscape emits for a circle) bounds the whole circle
{
  const bb = pathBBox("M10 20 a10 10 0 1 1 20 0 a10 10 0 1 1 -20 0");
  assert.deepEqual(
    { x: +bb.x.toFixed(4), y: +bb.y.toFixed(4), w: +bb.w.toFixed(4), h: +bb.h.toFixed(4) },
    { x: 10, y: 10, w: 20, h: 20 });
}
// a large-arc flag must not be read as a coordinate, and must not inflate the box either
{
  const bb = pathBBox("M0 0 A5 5 0 1 1 10 0");
  assert.equal(+bb.w.toFixed(4), 10);
  assert.ok(+bb.h.toFixed(4) <= 10.0001, `large-arc box must not exceed the circle, got ${JSON.stringify(bb)}`);
}
// a real-export shape: Adobe-style relative data must stay inside its own canvas
{
  const bb = pathBBox("M120.5 40.25c-8.5 0-15.75 6.5-15.75 15s7.25 15 15.75 15 15.75-6.5 15.75-15-7.25-15-15.75-15z");
  assert.ok(bb.x >= 100 && bb.x + bb.w <= 141, `expected an on-canvas box, got ${JSON.stringify(bb)}`);
  assert.ok(bb.y >= 40 && bb.y + bb.h <= 71, `expected an on-canvas box, got ${JSON.stringify(bb)}`);
}
// malformed / empty input still throws rather than returning a garbage box
{
  assert.throws(() => pathBBox("Z"), /no coordinates/);
  assert.throws(() => pathBBox(""), /no coordinates/);
}
console.log("path-bbox.test.mjs: all assertions passed.");
