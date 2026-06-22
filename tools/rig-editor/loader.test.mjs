// Self-check for the segmented.svg loader. Parses the committed devbrain fixture (the golden
// round-trip input) and asserts the rect-granular model matches its known shape.
// Run: `node tools/rig-editor/loader.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSegmented, applyPartsSpec } from "./loader.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const segPath = join(repoRoot, "docs", "buildable-slice", "generated", "devbrain-segmented.svg");
const segText = readFileSync(segPath, "utf8");

const m = parseSegmented(segText);

// viewBox carried through
assert.equal(m.viewBox(), "0 0 192 192");

// the committed fixture: 89 rects across 5 proposed parts
assert.equal(m.rects().length, 89, "all rects parsed");
const parts = Object.keys(m.parts()).sort();
assert.deepEqual(parts, [
  "part-antenna",
  "part-body",
  "part-eyes",
  "part-leg-left",
  "part-leg-right",
]);

// per-part rect counts (the known devbrain segmentation)
assert.equal(m.rectsOf("part-body").length, 56);
assert.equal(m.rectsOf("part-antenna").length, 22);
assert.equal(m.rectsOf("part-eyes").length, 5);
assert.equal(m.rectsOf("part-leg-left").length, 2);
assert.equal(m.rectsOf("part-leg-right").length, 4);

// proposed pivots are read from data-pivot="x,y"
assert.deepEqual(m.parts()["part-body"].pivot, { x: 96, y: 123 });
assert.deepEqual(m.parts()["part-leg-left"].pivot, { x: 72.5, y: 152 });

// every rect carries geometry + fill and is grouped (D6)
const r = m.rects()[0];
for (const k of ["id", "x", "y", "w", "h", "fill", "part"]) {
  assert.ok(r[k] !== undefined, `rect has ${k}`);
}
assert.ok(m.everyRectGrouped());

// parts-spec merges vocabulary + bone hints onto the model (D7 read side)
const spec = {
  parts: [
    { id: "part-body", bone: "body" },
    { id: "part-leg-left", bone: "leg_left" },
    { id: "part-grille", bone: "grille" }, // a vocabulary entry with no rects yet
  ],
};
applyPartsSpec(m, spec);
assert.equal(m.parts()["part-body"].bone, "body", "bone hint applied to an existing part");
assert.ok(m.parts()["part-grille"], "spec vocabulary adds candidate parts even with no rects");
assert.equal(m.rectsOf("part-grille").length, 0);

console.log("loader.test.mjs: all assertions passed.");
