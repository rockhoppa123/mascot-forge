// Self-check for marquee selection + the rect-level SPLIT round-trip. No framework — node:assert,
// mirrors model.test.mjs / exporter.test.mjs. Run: `node tools/rig-editor/select.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSegmented } from "./loader.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";
import { bboxOf } from "./pivot.js";
import { rectsInMarquee } from "./select.js";

// --- geometry: full-containment policy, direction-agnostic ---------------------------------------
{
  const rects = [
    { id: "r0", x: 0, y: 0, w: 10, h: 10 },
    { id: "r1", x: 20, y: 20, w: 10, h: 10 },
    { id: "r2", x: 50, y: 50, w: 10, h: 10 },
  ];
  // box fully encloses r0 + r1, stops short of r2
  assert.deepEqual(rectsInMarquee(rects, { x: -1, y: -1, w: 42, h: 42 }), ["r0", "r1"]);
  // partial overlap is NOT a hit: a box clipping only r2's corner selects nothing
  assert.deepEqual(rectsInMarquee(rects, { x: 55, y: 55, w: 20, h: 20 }), []);
  // dragged up-left (negative w/h) normalises to the same enclosed set
  assert.deepEqual(rectsInMarquee(rects, { x: 41, y: 41, w: -42, h: -42 }), ["r0", "r1"]);
}

// --- fixture: whole-viewBox marquee encloses every rect; an off-canvas box, none -----------------
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const seg = readFileSync(join(repoRoot, "docs", "buildable-slice", "generated", "devbrain-segmented.svg"), "utf8");
{
  const m = parseSegmented(seg);
  const all = m.rects();
  const [minX, minY, w, h] = m.viewBox().split(/\s+/).map(Number);
  const got = rectsInMarquee(all, { x: minX, y: minY, w, h });
  assert.equal(got.length, all.length, "whole-viewBox marquee encloses all rects");
  assert.deepEqual(got.slice().sort(), all.map((r) => r.id).sort());
  assert.deepEqual(rectsInMarquee(all, { x: minX - 100, y: minY - 100, w: 10, h: 10 }), [],
    "an off-canvas marquee encloses nothing");
}

// --- S3 split: peel a subset of part-body into a new part; geometry conserved --------------------
{
  const m = parseSegmented(seg);
  const bodyIds = m.rectsOf("part-body").map((r) => r.id);
  assert.ok(bodyIds.length >= 2, "part-body has rects to split");
  const subset = bodyIds.slice(0, 2);
  const before = m.rects().length;
  m.assign(subset, "part-front-wheel");
  assert.deepEqual(m.rectsOf("part-front-wheel").map((r) => r.id), subset, "new part gets the subset");
  assert.deepEqual(m.rectsOf("part-body").map((r) => r.id), bodyIds.slice(2), "part-body keeps the remainder");
  assert.ok(m.everyRectGrouped(), "every rect still in exactly one group after split");
  assert.equal(m.rects().length, before, "rect count conserved");
}

// --- editor-level: load → marquee a subset → split → export still validates, no rect lost --------
{
  const m = parseSegmented(seg);
  const box = bboxOf(m.rectsOf("part-body").slice(0, 2)); // marquee around two body rects
  const picked = rectsInMarquee(m.rects(), box);
  assert.ok(picked.length >= 2, "marquee encloses the targeted rects");
  m.assign(picked, "part-front-wheel");
  m.setRole("part-body", "core"); m.setBone("part-body", "body"); m.setPreset("idle", "part-body", "breathe");
  m.setRole("part-front-wheel", "limb"); m.setBone("part-front-wheel", "wheel"); m.setPreset("active", "part-front-wheel", "walk");
  m.setRole("part-leg-left", "limb"); m.setBone("part-leg-left", "leg_left"); m.setPreset("active", "part-leg-left", "walk");
  m.setRole("part-antenna", "accent"); m.setBone("part-antenna", "antenna"); m.setPreset("alert", "part-antenna", "pulse");
  const out = exportRig(m, { assetName: "devbrain", recipeFor });
  const v = validate(out.riggedJson);
  assert.equal(v.ok, true, `split export must validate: ${v.errors.join("; ")}`);
  assert.equal((out.manualSvg.match(/<rect\b/g) || []).length, 89, "no rect lost after split + export");
}

console.log("select.test.mjs: all assertions passed.");
