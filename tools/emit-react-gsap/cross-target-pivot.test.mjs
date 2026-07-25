// ADR-0007's #1 named automation risk, tested: SVG+CSS resolves a part's rotation centre from a
// PERCENTAGE against the rendered fill-box; React+GSAP uses the ABSOLUTE pivot via GSAP svgOrigin.
// If the bbox the percentage was authored against ever diverges from the rendered geometry's bbox,
// the two targets rotate the same part around different points and the rig silently desyncs.
// Run: `node tools/emit-react-gsap/cross-target-pivot.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { computeBBoxes } from "./emit-react.mjs";
import { originToPivot } from "../rig-editor/pivot.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const slice = join(here, "..", "..", "docs", "buildable-slice");

const rig = JSON.parse(readFileSync(join(slice, "devbrain-rigged.json"), "utf8"));
const svg = readFileSync(join(slice, "devbrain-manual-part.svg"), "utf8");

assert.ok(rig.parts.length >= 2, "the fidelity proof must run against a real multi-part rig");

const bboxes = computeBBoxes(svg, rig.parts.map((p) => p.id));

for (const part of rig.parts) {
  const b = bboxes[part.id];
  // computeBBoxes speaks {minX,minY,maxX,maxY}; pivot.js speaks {x,y,w,h}
  const box = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };

  // what the BROWSER will resolve the SVG+CSS percentage to, against the rendered geometry
  const cssResolved = originToPivot(part.origin, box);
  // what GSAP receives directly on the React target
  const gsapAbsolute = part.pivot;

  const tolX = box.w * 0.005; // 0.5% of the part bbox, matching the emitter's internal tolerance
  const tolY = box.h * 0.005;
  assert.ok(
    Math.abs(cssResolved.x - gsapAbsolute.x) <= tolX && Math.abs(cssResolved.y - gsapAbsolute.y) <= tolY,
    `cross-target pivot drift on '${part.id}': SVG+CSS origin '${part.origin}' resolves to ` +
      `(${cssResolved.x.toFixed(2)}, ${cssResolved.y.toFixed(2)}) against the rendered bbox, but ` +
      `React+GSAP rotates around (${gsapAbsolute.x}, ${gsapAbsolute.y}). Both targets must share one point.`
  );
}

// a deliberately corrupted origin MUST be caught — proves the assertion has teeth rather than
// passing vacuously because the tolerance swallows everything.
{
  const [first] = rig.parts;
  const b = bboxes[first.id];
  const box = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  const drifted = originToPivot("0% 0%", box); // top-left instead of the authored pivot
  const far = Math.abs(drifted.x - first.pivot.x) > box.w * 0.005 ||
              Math.abs(drifted.y - first.pivot.y) > box.h * 0.005;
  assert.ok(far, "the tolerance is tight enough to catch a real drift (guards against a vacuous pass)");
}

console.log(`cross-target-pivot.test.mjs: ${rig.parts.length} parts share one rotation centre across both targets.`);
