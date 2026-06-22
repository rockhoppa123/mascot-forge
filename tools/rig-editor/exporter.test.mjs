// Self-check for the exporter — the headline GOLDEN ROUND-TRIP.
// Load the committed devbrain segmented.svg, apply the known devbrain assignment, export, and
// assert the pair is (a) valid per the in-browser validator, (b) SHAPE-equivalent to the committed
// devbrain-rigged.json (schema-equivalence golden — see browser-rig-editor-prompt decision: the
// 5-part/89-rect segmented input cannot reproduce the 6-part hand-tuned rig, so we assert schema
// shape + states + role-derived recipes, not part-for-part identity), and (c) loses no rect.
// Run: `node tools/rig-editor/exporter.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSegmented } from "./loader.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";
import { bboxOf, pivotToOrigin } from "./pivot.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const seg = readFileSync(join(repoRoot, "docs", "buildable-slice", "generated", "devbrain-segmented.svg"), "utf8");
const goldenRig = JSON.parse(readFileSync(join(repoRoot, "docs", "buildable-slice", "devbrain-rigged.json"), "utf8"));

// --- the known devbrain assignment over the 5 proposed parts -------------------------------------
const m = parseSegmented(seg);
const plan = [
  ["part-body", "body", "core", "idle", "breathe"],
  ["part-eyes", "body", "accent", "idle", "blink"],
  ["part-leg-left", "leg_left", "limb", "active", "walk"],
  ["part-leg-right", "leg_right", "limb", "active", "walk-mirror"],
  ["part-antenna", "antenna", "accent", "alert", "pulse"],
];
for (const [id, bone, role, state, preset] of plan) {
  m.setRole(id, role);
  m.setBone(id, bone);
  const bb = bboxOf(m.rectsOf(id));
  m.setPivot(id, m.parts()[id].pivot || { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 },
    pivotToOrigin(m.parts()[id].pivot || { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 }, bb));
  m.setPreset(state, id, preset);
}

const out = exportRig(m, {
  assetName: "devbrain",
  recipeFor,
  source: goldenRig.source,
});

// (a) valid per the in-browser validator
const v = validate(out.riggedJson);
assert.equal(v.ok, true, `exported rig must validate: ${v.errors.join("; ")}`);

// (b) shape-equivalent to the committed golden: same top-level keys, version, states, recipe shape
for (const key of ["version", "source", "states", "bones", "parts", "animations", "accents"]) {
  assert.ok(key in out.riggedJson, `rig has top-level '${key}'`);
}
assert.equal(out.riggedJson.version, 2);
assert.deepEqual(out.riggedJson.states, goldenRig.states);
// every part carries the v2 contract fields
for (const p of out.riggedJson.parts) {
  assert.ok(p.id && p.bone && typeof p.origin === "string", `part ${p.id} has id/bone/origin`);
  assert.ok(Number.isFinite(p.pivot.x) && Number.isFinite(p.pivot.y), `part ${p.id} numeric pivot`);
}
// recipes match the golden's recipe shape (same property set) and reference real parts
const goldKeys = Object.keys(goldenRig.animations.idle[0]).sort();
for (const s of out.riggedJson.states) {
  assert.ok(out.riggedJson.animations[s].length >= 1, `state ${s} has a recipe`);
  for (const rec of out.riggedJson.animations[s]) {
    assert.deepEqual(Object.keys(rec).sort(), goldKeys, `recipe in ${s} matches golden recipe shape`);
  }
}

// (c) no geometry lost: every input rect appears in exactly one part group in the output SVG
const rectCount = (out.manualSvg.match(/<rect\b/g) || []).length;
assert.equal(rectCount, 89, "all 89 input rects survive export");
// each is inside exactly one <g class="part"> (count rects nested under part groups)
const groupRectTotal = [...out.manualSvg.matchAll(/<g\b[^>]*class="part"[^>]*>([\s\S]*?)<\/g>/g)]
  .reduce((n, g) => n + (g[1].match(/<rect\b/g) || []).length, 0);
assert.equal(groupRectTotal, 89, "every rect nested under exactly one part group");

// output SVG carries the manual-part contract
assert.ok(/<svg[^>]*id="mascot"/.test(out.manualSvg));
assert.ok(/viewBox="0 0 192 192"/.test(out.manualSvg));
assert.ok(/<g id="rig-root">/.test(out.manualSvg));
for (const p of out.riggedJson.parts) {
  const re = new RegExp(`id="${p.id}"[^>]*class="part"[^>]*data-origin="[^"]+"[^>]*data-pivot-x="[^"]+"[^>]*data-pivot-y="[^"]+"`);
  assert.ok(re.test(out.manualSvg), `${p.id} group has class/origin/pivot metadata`);
}

// (D7) parts-spec write-back carries the final part set + roles
assert.equal(out.partsSpec.assetName, "devbrain");
assert.deepEqual(out.partsSpec.parts.map((p) => p.id).sort(),
  ["part-antenna", "part-body", "part-eyes", "part-leg-left", "part-leg-right"]);
assert.ok(out.partsSpec.parts.every((p) => p.role && p.bone));

// (D6) unassigned rects route to part-background so geometry is never lost; the UI blocks the
// export button on a non-empty ungroupedRects() — the exporter itself always preserves every rect.
{
  const m2 = parseSegmented(seg);
  m2.assign(["r0"], ""); // user cleared a rect's part
  assert.deepEqual(m2.ungroupedRects().map((r) => r.id), ["r0"], "UI can see the unassigned rect");
  m2.setRole("part-body", "core"); m2.setBone("part-body", "body");
  m2.setPreset("idle", "part-body", "breathe");
  m2.setRole("part-leg-left", "limb"); m2.setBone("part-leg-left", "leg_left");
  m2.setPreset("active", "part-leg-left", "walk");
  m2.setRole("part-antenna", "accent"); m2.setBone("part-antenna", "antenna");
  m2.setPreset("alert", "part-antenna", "pulse");
  const o2 = exportRig(m2, { assetName: "x", recipeFor });
  assert.equal((o2.manualSvg.match(/<rect\b/g) || []).length, 89, "the unassigned rect is not lost");
  assert.ok(/id="part-background"/.test(o2.manualSvg), "it lands in part-background");
}
{
  const m3 = parseSegmented(seg);
  m3.remove("part-eyes"); // its rects fall to part-background (passive, no recipe)
  m3.setRole("part-body", "core");
  m3.setBone("part-body", "body");
  m3.setPreset("idle", "part-body", "breathe");
  m3.setRole("part-leg-left", "limb"); m3.setBone("part-leg-left", "leg_left");
  m3.setPreset("active", "part-leg-left", "walk");
  m3.setRole("part-antenna", "accent"); m3.setBone("part-antenna", "antenna");
  m3.setPreset("alert", "part-antenna", "pulse");
  const o3 = exportRig(m3, { assetName: "x", recipeFor });
  assert.ok(/id="part-background"/.test(o3.manualSvg), "unassigned rects land in part-background");
  assert.ok(!o3.riggedJson.animations.idle.some((r) => r.part === "part-background"),
    "background carries no recipe");
}

console.log("exporter.test.mjs: all assertions passed.");
