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

// --- parseLayered: groups -> parts; rect AND path bbox computed (path via pathBBox) --------------
{
  const { viewBox, elements } = parseLayered(LAYERED);
  assert.equal(viewBox, "0 0 100 100");
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head", "part-body"]);
  assert.equal(elements.length, 3, "two rects + one path");
  const path = elements.find((e) => e.markup.startsWith("<path"));
  assert.deepEqual(path.bbox, { x: 10, y: 10, w: 20, h: 20 }, "path bbox computed from `d` via pathBBox");
  const headRect = elements.find((e) => e.part === "part-head" && e.markup.startsWith("<rect"));
  assert.deepEqual(headRect.bbox, { x: 10, y: 10, w: 20, h: 20 }, "rect bbox from attributes");
}

// --- premium path: a layered SVG of named <path> layers ingests directly (Phase 3 Task 0) --------
{
  const PATHS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g id="ear-left"><path d="M4 4 L20 4 L12 20 Z" fill="#333"/></g>
  <g id="body"><path d="M16 24 L48 24 L48 56 L16 56 Z" fill="#888"/></g>
</svg>`;
  const { elements } = parseLayered(PATHS);
  assert.equal(elements.length, 2, "two path layers -> two elements");
  for (const e of elements) {
    assert.ok(e.markup.startsWith("<path"), "each element is a path");
    assert.ok(e.bbox && Number.isFinite(e.bbox.x) && e.bbox.w > 0, "each path layer carries a finite bbox");
  }
  const model = toModel({ viewBox: "0 0 64 64", elements });
  assert.deepEqual(Object.keys(model.parts()).sort(), ["part-body", "part-ear-left"], "named path parts");
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
  const model = toModel(parsed); // path bbox is now computed in parseLayered (no manual inject needed)
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

// a self-describing rig SVG (editorHandoff output) rebuilds a fully-animated model
{
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,loading">',
    '  <g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe">',
    '    <rect x="30" y="30" width="40" height="40" fill="#111"/>',
    '  </g>',
    '  <g id="part-arm" data-role="limb" data-bone="arm" data-kind="wheel" data-preset-active="walk" data-preset-loading="spin">',
    '    <rect x="5" y="35" width="14" height="30" fill="#222"/>',
    '  </g>',
    '</svg>',
  ].join("\n");
  const parsed = parseLayered(svg);
  assert.deepEqual(parsed.states, ["idle", "active", "loading"], "root data-states parsed");
  assert.equal(parsed.parts["part-body"].role, "core");
  assert.deepEqual(parsed.parts["part-body"].pivot, { x: 50, y: 50 });
  assert.equal(parsed.parts["part-body"].presets.idle, "breathe");
  assert.equal(parsed.parts["part-arm"].kind, "wheel", "data-kind parsed");
  assert.equal(parsed.parts["part-arm"].presets.loading, "spin");
  const m = toModel(parsed);
  assert.deepEqual(m.states(), ["idle", "active", "loading"], "model built with the declared vocabulary");
  assert.equal(m.parts()["part-body"].role, "core", "role applied");
  assert.equal(m.parts()["part-arm"].kind, "wheel", "kind applied to the model");
  assert.equal(m.preset("idle", "part-body"), "breathe", "preset applied");
  assert.equal(m.preset("loading", "part-arm"), "spin", "signal-state preset applied");
}

// I3a: nested <g> exports silently lose the outer group's own geometry with a non-greedy tokenizer.
// Reject them with a clear message rather than emit a broken part (the browser DOMParser path handles
// nesting; the node regex path cannot, so it must fail loudly).
assert.throws(
  () => parseLayered('<svg viewBox="0 0 100 100"><g id="arm"><g id="hand"><rect x="1" y="1" width="5" height="5" fill="#a"/></g><rect x="10" y="10" width="20" height="20" fill="#b"/></g></svg>'),
  /nested/i,
  "nested <g> layers are rejected (flat exports only)"
);

// I3b: a state name with a digit/hyphen (e.g. 'phase-2') must still be captured as a preset.
{
  const { parts } = parseLayered('<svg viewBox="0 0 10 10" data-states="idle,phase-2"><g id="p" data-role="core" data-preset-phase-2="breathe"><rect x="0" y="0" width="5" height="5" fill="#c"/></g></svg>');
  assert.equal(parts["part-p"].presets["phase-2"], "breathe", "hyphen/digit state preset captured");
}

console.log("layer-ingest.test.mjs: all assertions passed.");
