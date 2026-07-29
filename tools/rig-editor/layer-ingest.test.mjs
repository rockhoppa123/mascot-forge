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

// Nesting FLATTENS: a depth-aware scan hands each top-level layer its full subtree, so drawables at
// any depth join that layer's part. This replaces the old "reject nested <g>" rule — that rejection
// was a workaround for a non-greedy tokenizer that ended the outer group at the first </g> and so
// dropped the outer group's own geometry (audit I3). The scanner fixes the cause.
{
  const NESTED = '<svg viewBox="0 0 100 100">'
    + '<g id="arm">'
    +   '<g id="hand"><rect x="1" y="1" width="5" height="5" fill="#a00"/></g>'
    +   '<rect x="10" y="10" width="20" height="20" fill="#0b0"/>'
    + '</g>'
    + '</svg>';
  const { elements } = parseLayered(NESTED);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-arm"], "the nested <g> is not a part of its own");
  assert.equal(elements.length, 2, "both the nested rect AND the outer group's own rect survive");
  const outer = elements.find((e) => e.markup.includes('fill="#0b0"'));
  assert.ok(outer, "the outer group's own geometry is not dropped (the exact I3 defect)");
  assert.deepEqual(outer.bbox, { x: 10, y: 10, w: 20, h: 20 }, "outer rect bbox intact");
}

// depth is unbounded, not just one level
{
  const DEEP = '<svg viewBox="0 0 100 100"><g id="torso"><g><g><rect x="2" y="2" width="4" height="4" fill="#111"/></g>'
    + '<rect x="8" y="8" width="4" height="4" fill="#222"/></g><rect x="20" y="20" width="4" height="4" fill="#333"/></g></svg>';
  const { elements } = parseLayered(DEEP);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-torso"], "3 levels deep -> still one part");
  assert.equal(elements.length, 3, "a drawable at every depth is collected");
}

// depth must reset between sibling layers — a nested first layer must not swallow the second
{
  const SIBLINGS = '<svg viewBox="0 0 100 100">'
    + '<g id="arm"><g id="hand"><rect x="1" y="1" width="5" height="5" fill="#a00"/></g></g>'
    + '<g id="leg"><rect x="50" y="50" width="9" height="9" fill="#00b"/></g>'
    + '</svg>';
  const { elements } = parseLayered(SIBLINGS);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-arm", "part-leg"], "two sibling layers, one nested");
  assert.equal(elements.filter((e) => e.part === "part-leg").length, 1, "the second layer keeps its own element");
}

// METADATA RULE: data-* is read from the TOP-LEVEL <g> only. A nested group contributes geometry,
// never metadata and never a part of its own.
{
  const META = '<svg viewBox="0 0 100 100">'
    + '<g id="arm" data-role="limb">'
    +   '<g id="inner" data-role="core" data-pivot="9,9"><rect x="1" y="1" width="5" height="5" fill="#a00"/></g>'
    + '</g></svg>';
  const { elements, parts } = parseLayered(META);
  assert.deepEqual(Object.keys(parts), ["part-arm"], "no phantom part from the nested group");
  assert.equal(parts["part-arm"].role, "limb", "the top-level layer's role is used");
  assert.equal(parts["part-arm"].pivot, undefined, "the nested group's data-pivot is ignored");
  assert.equal(elements.length, 1, "its geometry still joins the parent part");
}

// NON-RENDERED subtrees are not art. Figma wraps clipped layers as <g clip-path="url(#c0)"> and can
// emit the <clipPath> INSIDE the group. Flattening would otherwise turn a clip shape into a phantom
// element — invisible in the source, exported as real geometry. NON_RENDERED is stripped once at the
// document level (see layer-ingest.js), before topLevelGroups picks layers, so this holds for an
// in-group subtree here AND for a root-level one (root-level cases are covered separately below).
{
  const CLIPPED = '<svg viewBox="0 0 100 100">'
    + '<g id="Head">'
    +   '<defs><clipPath id="c0"><rect x="0" y="0" width="99" height="99"/></clipPath></defs>'
    +   '<rect x="10" y="10" width="20" height="20" fill="#0b0"/>'
    + '</g></svg>';
  const { elements } = parseLayered(CLIPPED);
  assert.equal(elements.length, 1, "the clipPath's rect is not art and must not become an element");
  assert.ok(elements[0].markup.includes('fill="#0b0"'), "the real drawable is the one kept");
}

// A self-closing NON_RENDERED tag (<clipPath id="empty"/>) must be consumed on its own. A lazy
// `<tag>...</tag>` regex has no way to know a same-named tag later in the layer is a SEPARATE,
// paired instance — it pairs the self-closer with that later close tag and swallows every real
// drawable in between. This is the inverse of the CLIPPED defect above: instead of clip geometry
// leaking in as phantom art, real art silently disappears.
{
  const SELFCLOSING_THEN_PAIRED = '<svg viewBox="0 0 100 100">'
    + '<g id="Head">'
    +   '<clipPath id="empty"/>'
    +   '<rect x="1" y="1" width="5" height="5" fill="#a00"/>'
    +   '<clipPath id="c0"><rect x="0" y="0" width="9" height="9"/></clipPath>'
    +   '<rect x="2" y="2" width="5" height="5" fill="#0b0"/>'
    + '</g></svg>';
  const { elements } = parseLayered(SELFCLOSING_THEN_PAIRED);
  const fills = elements.map((e) => e.markup.match(/fill="([^"]*)"/)[1]).sort();
  assert.deepEqual(fills, ["#0b0", "#a00"], "both real drawables survive; only the two clipPaths' own geometry is stripped");
}

// A transform living inside a stripped <clipPath>/<defs> must not trigger the transform refusal —
// the guard tests the STRIPPED body, so a transform used only to warp a clip shape is invisible to
// it. Only a transform in the surviving (real-art) subtree should refuse ingest.
{
  const CLIP_TRANSFORM = '<svg viewBox="0 0 100 100">'
    + '<g id="Head">'
    +   '<clipPath id="c1" transform="translate(5,5)"><rect x="0" y="0" width="9" height="9"/></clipPath>'
    +   '<rect x="10" y="10" width="20" height="20" fill="#0b0"/>'
    + '</g></svg>';
  let elements;
  assert.doesNotThrow(
    () => { ({ elements } = parseLayered(CLIP_TRANSFORM)); },
    "a transform confined to a stripped clipPath must not trigger the transform refusal"
  );
  assert.equal(elements.length, 1, "only the real drawable survives ingest");
  assert.ok(elements[0].markup.includes('fill="#0b0"'), "the surviving element is the real, untransformed drawable");
}

// The document's OWN attrs must be read from the stripped text too. A comment before the root element
// can contain an `<svg …>` fragment (a commented-out wrapper); matching raw source would take viewBox
// and data-states from the comment, while the browser's DOMParser never sees comments at all — the two
// paths would then disagree about the document's coordinate system, silently placing every part wrong.
{
  const COMMENTED_ROOT = '<!-- <svg viewBox="9 9 9 9" data-states="ghost"> -->'
    + '<svg viewBox="0 0 100 100" data-states="idle,active">'
    + '<g id="Head"><rect x="10" y="10" width="20" height="20" fill="#0b0"/></g>'
    + '</svg>';
  const { viewBox, states } = parseLayered(COMMENTED_ROOT);
  assert.equal(viewBox, "0 0 100 100", "viewBox comes from the real root, not a commented-out one");
  assert.deepEqual(states, ["idle", "active"], "data-states likewise ignores the commented fragment");
}

// ROOT-LEVEL non-rendered subtrees must not leak into the node path either. `topLevelGroups` chooses
// layers by scanning raw text — a <g> sitting inside a root-level <defs>/<clipPath> is not a child of
// <svg> in the DOM (so the browser never treats it as a layer), but the old per-layer strip ran too
// late to stop it from being picked up as a top-level layer here. Stripping NON_RENDERED once at the
// document level, before topLevelGroups runs, closes that gap.
{
  const ROOT_DEFS = '<svg viewBox="0 0 100 100">'
    + '<defs><clipPath id="c0"><g id="clipgroup"><rect x="0" y="0" width="9" height="9" fill="#000"/></g></clipPath></defs>'
    + '<g id="Head"><rect x="10" y="10" width="20" height="20" fill="#0b0"/></g>'
    + '</svg>';
  const { elements } = parseLayered(ROOT_DEFS);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head"],
    "a <g> inside a root-level <defs>/<clipPath> must not become a layer of its own");
  assert.equal(elements.length, 1, "only the real Head rect is art");
}

// A transform confined to a root-level <defs>/<pattern> must not refuse ingest. Before the document-
// level strip, this was the worst outcome on the branch: the MCP tool refused the whole file, naming a
// phantom "layer-1" the user cannot find or flatten because it does not exist as a layer in their file.
{
  const ROOT_DEFS_TRANSFORM = '<svg viewBox="0 0 100 100">'
    + '<defs><pattern id="p"><g transform="translate(3,3)"><rect x="0" y="0" width="9" height="9" fill="#000"/></g></pattern></defs>'
    + '<g id="Head"><rect x="10" y="10" width="20" height="20" fill="#0b0"/></g>'
    + '</svg>';
  let elements;
  assert.doesNotThrow(
    () => { ({ elements } = parseLayered(ROOT_DEFS_TRANSFORM)); },
    'a transform confined to a root-level <defs>/<pattern> must not trigger the transform refusal, nor name a phantom "layer-1"'
  );
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head"]);
  assert.equal(elements.length, 1, "only the real Head rect is art");
}

// SVG comments must not corrupt the scan. A commented-out `<g>` reads as real markup to a text scanner
// — the browser ignores comments entirely (they never enter the DOM), so this must too.
{
  const COMMENTED = '<svg viewBox="0 0 100 100">'
    + '<!-- <g id="old"><rect x="0" y="0" width="9" height="9" fill="#000"/></g> -->'
    + '<g id="Head"><rect x="10" y="10" width="20" height="20" fill="#0b0"/></g>'
    + '</svg>';
  const { elements } = parseLayered(COMMENTED);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head"], "a commented-out <g> must not become a phantom part");
  assert.equal(elements.length, 1, "only the real Head rect is art");
}

// An UNBALANCED comment (an opening `<!--` whose `<g` never got a matching close before ` -->`) must
// not leave the depth counter open — that starved every real layer after it, reported as "no drawable
// shapes found" for a file that plainly has them.
{
  const UNBALANCED_COMMENT = '<svg viewBox="0 0 100 100">'
    + '<!-- <g id="old"> -->'
    + '<g id="Head"><rect x="10" y="10" width="20" height="20" fill="#0b0"/></g>'
    + '</svg>';
  const { elements } = parseLayered(UNBALANCED_COMMENT);
  assert.deepEqual([...new Set(elements.map((e) => e.part))], ["part-head"], "an unbalanced comment must not swallow the real layers that follow");
  assert.equal(elements.length, 1, "only the real Head rect is art");
}

// A transform cannot be resolved by either ingest path (bbox arithmetic here, getBBox in the browser,
// and `markup` is re-parented away from its ancestors on export). Refuse it, naming the layers, rather
// than place the art silently wrong.
{
  assert.throws(
    () => parseLayered('<svg viewBox="0 0 100 100"><g id="Head"><g transform="translate(10,10)"><rect x="0" y="0" width="5" height="5" fill="#a00"/></g></g></svg>'),
    /transform/i,
    "a transform on a NESTED group is refused"
  );
  assert.throws(
    () => parseLayered('<svg viewBox="0 0 100 100"><g id="Head"><g transform="translate(10,10)"><rect x="0" y="0" width="5" height="5" fill="#a00"/></g></g></svg>'),
    /"Head"/,
    "the refusal names the TOP-LEVEL layer — the thing a user can find and flatten in Figma"
  );
  assert.throws(
    () => parseLayered('<svg viewBox="0 0 100 100"><g inkscape:label="Left Arm" transform="rotate(4)"><rect x="0" y="0" width="5" height="5" fill="#a00"/></g></svg>'),
    /"Left Arm"/,
    "a transform on the layer root is refused too, named by its authored label not its part id"
  );
  // every offending layer is reported in ONE pass, not one error per fix-and-retry cycle
  try {
    parseLayered('<svg viewBox="0 0 100 100">'
      + '<g id="Head" transform="translate(1,1)"><rect x="0" y="0" width="5" height="5" fill="#a00"/></g>'
      + '<g id="Tail" transform="translate(2,2)"><rect x="0" y="0" width="5" height="5" fill="#0b0"/></g>'
      + '</svg>');
    assert.fail("expected a throw");
  } catch (e) {
    assert.match(e.message, /"Head"/, "first offending layer named");
    assert.match(e.message, /"Tail"/, "second offending layer named in the SAME error");
  }
  // negative control: `gradientTransform` is not a transform and must not trip the guard
  assert.doesNotThrow(
    () => parseLayered('<svg viewBox="0 0 100 100"><g id="ok"><rect x="0" y="0" width="5" height="5" gradientTransform="x" fill="#a00"/></g></svg>'),
    "gradientTransform / patternTransform must not be mistaken for transform"
  );
}

// I3b: a state name with a digit/hyphen (e.g. 'phase-2') must still be captured as a preset.
{
  const { parts } = parseLayered('<svg viewBox="0 0 10 10" data-states="idle,phase-2"><g id="p" data-role="core" data-preset-phase-2="breathe"><rect x="0" y="0" width="5" height="5" fill="#c"/></g></svg>');
  assert.equal(parts["part-p"].presets["phase-2"], "breathe", "hyphen/digit state preset captured");
}

console.log("layer-ingest.test.mjs: all assertions passed.");
