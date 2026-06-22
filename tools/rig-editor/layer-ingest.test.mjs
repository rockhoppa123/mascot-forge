// Self-check for layered-SVG ingest (ADR-0011). No framework — node:assert, mirrors model.test.mjs.
// Run: `node tools/rig-editor/layer-ingest.test.mjs`.
import assert from "node:assert/strict";
import { sanitizeId, parseLayered, toModel } from "./layer-ingest.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";

// --- sanitizeId: layer name -> valid, unique part id --------------------------------------------
{
  const used = new Set();
  assert.equal(sanitizeId("Left Arm", used), "part-left-arm");
  assert.equal(sanitizeId("Body", used), "part-body");
  assert.equal(sanitizeId("Body", used), "part-body-2", "duplicate names dedupe");
  assert.equal(sanitizeId("part-eyes", used), "part-eyes", "an already-prefixed id is kept");
  assert.equal(sanitizeId("", used), "part", "empty name falls back to 'part'");
}

// a flat layered SVG: a "Head" layer (rect + path), a "body" layer (rect)
const LAYERED = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g inkscape:label="Head"><rect x="10" y="10" width="20" height="20" fill="#eee"/><path d="M10 10 L30 30" fill="#111"/></g>
  <g id="body"><rect x="40" y="40" width="30" height="30" fill="#c00"/></g>
</svg>`;

// --- parseLayered: groups -> parts; rect bbox computed, path bbox null ---------------------------
{
  const { viewBox, elements } = parseLayered(LAYERED);
  assert.equal(viewBox, "0 0 100 100");
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head", "part-body"]);
  assert.equal(elements.length, 3, "two rects + one path");
  const path = elements.find((e) => e.markup.startsWith("<path"));
  assert.equal(path.bbox, null, "non-rect bbox is left for the browser (getBBox)");
  const headRect = elements.find((e) => e.part === "part-head" && e.markup.startsWith("<rect"));
  assert.deepEqual(headRect.bbox, { x: 10, y: 10, w: 20, h: 20 }, "rect bbox from attributes");
}

// --- toModel: every element grouped, names carried --------------------------------------------
{
  const model = toModel(parseLayered(LAYERED));
  assert.equal(model.rects().length, 3);
  assert.ok(model.everyRectGrouped(), "every element belongs to exactly one part");
  assert.deepEqual(model.rectsOf("part-head").map((e) => e.id).length, 2);
  assert.equal(model.viewBox(), "0 0 100 100");
}

// --- export: non-rect markup passes through; rect goldens-style output preserved ----------------
{
  const parsed = parseLayered(LAYERED);
  // browser would fill the path bbox via getBBox; inject one here so export can place its pivot
  parsed.elements.find((e) => e.markup.startsWith("<path")).bbox = { x: 10, y: 10, w: 20, h: 20 };
  const model = toModel(parsed);
  // head = accent (idle blink + alert pulse), body = limb (active walk) → all three states covered
  model.setRole("part-head", "accent"); model.setBone("part-head", "head");
  model.setPreset("idle", "part-head", "blink"); model.setPreset("alert", "part-head", "pulse");
  model.setRole("part-body", "limb"); model.setBone("part-body", "body");
  model.setPreset("active", "part-body", "walk");
  const out = exportRig(model, { assetName: "layered", recipeFor });
  const v = validate(out.riggedJson);
  assert.equal(v.ok, true, `layered export must validate: ${v.errors.join("; ")}`);
  assert.ok(out.manualSvg.includes('<path d="M10 10 L30 30"'), "path geometry carried through verbatim");
  assert.equal((out.manualSvg.match(/<rect\b/g) || []).length, 2, "both rects preserved");
  assert.ok(/id="part-head"[^>]*class="part"/.test(out.manualSvg), "named part group emitted");
}

console.log("layer-ingest.test.mjs: all assertions passed.");
