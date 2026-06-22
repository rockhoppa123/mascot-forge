// Self-check for the part segmenter. No framework — node:assert, mirrors model.test.mjs. Synthetic
// flat rects in, proposed parts + a loader-compatible segmented.svg out. Also asserts the full
// browser path (vectorize -> segment -> loader -> export -> validate) is green.
// Run: `node tools/rig-editor/segment.test.mjs`.
import assert from "node:assert/strict";
import { segment } from "./segment.js";
import { vectorizeRaster } from "./vectorize.js";
import { parseSegmented } from "./loader.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";

// A mascot-shaped flat layout: big body, one leg below, antenna above, two eye islands inside.
function mascotRects() {
  return [
    { x: 10, y: 10, w: 20, h: 20, fill: "#cccccc" }, // body  (largest area)
    { x: 12, y: 30, w: 4, h: 10, fill: "#333333" },  // leg   (protrudes below body)
    { x: 18, y: 2, w: 4, h: 8, fill: "#33cc33" },    // antenna (protrudes above body)
    { x: 14, y: 14, w: 2, h: 2, fill: "#000000" },   // eye L (island in upper body)
    { x: 24, y: 14, w: 2, h: 2, fill: "#000000" },   // eye R
  ];
}

// --- naming + joint pivots -----------------------------------------------------------------------
{
  const { parts } = segment(mascotRects(), { viewBoxSize: 48 });
  assert.deepEqual(parts.map((p) => p.id), ["part-body", "part-leg-left", "part-antenna", "part-eyes"]);
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  assert.deepEqual(byId["part-body"].pivot, { x: 20, y: 20 }, "body pivot = bbox centre");
  assert.deepEqual(byId["part-leg-left"].pivot, { x: 14, y: 30 }, "leg pivot = hip line (top-edge centre)");
  assert.deepEqual(byId["part-antenna"].pivot, { x: 20, y: 10 }, "antenna pivot = base centre (bottom row)");
  assert.deepEqual(byId["part-eyes"].pivot, { x: 20, y: 15 }, "eyes pivot = bbox centre of both islands");
  assert.equal(byId["part-eyes"].rects.length, 2, "both eye islands merge into one part");
}

// --- emitted SVG round-trips through the existing loader (D6: every rect in one group) ------------
{
  const { svg } = segment(mascotRects(), { viewBoxSize: 48 });
  const model = parseSegmented(svg);
  assert.equal(model.rects().length, 5, "all 5 flat rects survive into the model");
  assert.ok(model.everyRectGrouped(), "every rect lands in exactly one part");
  assert.equal(model.viewBox(), "0 0 48 48");
  assert.deepEqual(model.parts()["part-leg-left"].pivot, { x: 14, y: 30 }, "loader reads the joint pivot");
}

// --- sliver absorption: a rect matching no rule is folded into the nearest named part -------------
{
  const rects = [...mascotRects(), { x: 35, y: 20, w: 1, h: 1, fill: "#ff00ff" }]; // side sliver, no rule
  const { svg, parts } = segment(rects, { viewBoxSize: 48 });
  const total = parts.reduce((n, p) => n + p.rects.length, 0);
  assert.equal(total, 6, "the sliver is absorbed, not dropped (no orphan rect)");
  assert.ok(parseSegmented(svg).everyRectGrouped(), "every rect (incl. sliver) lands in exactly one part");
}

// --- parts-spec vocab override (ADR-0010) --------------------------------------------------------
{
  const spec = { viewBoxSize: 48, parts: [{ id: "torso", hint: "largest-blob" }] };
  const { parts } = segment(mascotRects(), { spec });
  assert.equal(parts[0].id, "torso", "largest blob takes the spec id");
  assert.ok(!parts.some((p) => p.id === "part-body"), "default id replaced by spec vocab");
}

// --- guard: refuse to grind on an over-large flat input ------------------------------------------
{
  const many = Array.from({ length: 11 }, (_, i) => ({ x: i, y: 0, w: 1, h: 1, fill: "#000" }));
  assert.throws(() => segment(many, { viewBoxSize: 48, maxRects: 10 }), /maxRects/);
}

// --- end-to-end: vectorize -> segment -> loader -> export -> validate is green --------------------
{
  // 8x8: orange 3x3 body, a dark "leg" below it, a green "antenna" above it -> 3 parts, one per state
  const W = 8, H = 8;
  const rgba = new Uint8ClampedArray(W * H * 4).fill(0);
  const put = (x, y, [r, g, b]) => { const i = (y * W + x) * 4; rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255; };
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) put(x, y, [230, 130, 30]); // body
  put(2, 5, [40, 40, 40]); put(2, 6, [40, 40, 40]);                                    // leg (below body)
  put(3, 0, [40, 200, 60]); put(3, 1, [40, 200, 60]);                                  // antenna (above body)
  const { rects } = vectorizeRaster({ rgba, w: W, h: H }, { colors: 3 });
  const { svg } = segment(rects, { viewBoxSize: W });
  const model = parseSegmented(svg);
  assert.ok(model.parts()["part-body"] && model.parts()["part-leg-left"] && model.parts()["part-antenna"],
    "the PNG path proposed body + leg + antenna");
  model.setRole("part-body", "core"); model.setBone("part-body", "body"); model.setPreset("idle", "part-body", "breathe");
  model.setRole("part-leg-left", "limb"); model.setBone("part-leg-left", "leg"); model.setPreset("active", "part-leg-left", "walk");
  model.setRole("part-antenna", "accent"); model.setBone("part-antenna", "antenna"); model.setPreset("alert", "part-antenna", "pulse");
  const out = exportRig(model, { assetName: "synthetic", recipeFor });
  const v = validate(out.riggedJson);
  assert.equal(v.ok, true, `full PNG-path export must validate: ${v.errors.join("; ")}`);
}

console.log("segment.test.mjs: all assertions passed.");
