// Self-check for the part segmenter. No framework — node:assert, mirrors model.test.mjs. Synthetic
// flat rects in, proposed parts + a loader-compatible segmented.svg out. Also asserts the full
// browser path (vectorize -> segment -> loader -> export -> validate) is green.
// Run: `node tools/rig-editor/segment.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { segment } from "./segment.js";
import { vectorizeRaster } from "./vectorize.js";
import { parseSegmented } from "./loader.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";

// Read a flat SVG (un-segmented, original colours) into segment()-shaped rects: {x,y,w,h,fill}.
function flatRectsFromSvg(svgText) {
  const out = [];
  const re = /<rect\b([^>]*?)\/?>/g;
  let m;
  while ((m = re.exec(svgText)) !== null) {
    const a = m[1];
    const get = (n) => { const r = a.match(new RegExp(`\\b${n}="([^"]*)"`)); return r ? r[1] : undefined; };
    out.push({ x: Number(get("x")), y: Number(get("y")), w: Number(get("width")), h: Number(get("height")), fill: get("fill") || "#000000" });
  }
  return out;
}

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
// Positional fallback ids get NO anatomy-specific pivot treatment (bbox centre for all): the hip-line
// and base-centre rules are keyed to literal "part-leg-*"/"part-antenna" strings, which only exist
// when a parts-spec asserts them. Not assuming a joint shape for a blob of unknown anatomy is correct.
{
  const { parts } = segment(mascotRects(), { viewBoxSize: 48 });
  assert.deepEqual(parts.map((p) => p.id), ["part-body", "part-lower-left", "part-upper", "part-island-1", "part-island-2"]);
  const byId = Object.fromEntries(parts.map((p) => [p.id, p]));
  assert.deepEqual(byId["part-body"].pivot, { x: 20, y: 20 }, "body pivot = bbox centre");
  assert.deepEqual(byId["part-lower-left"].pivot, { x: 14, y: 35 }, "lower blob pivot = bbox centre (no leg assumed)");
  assert.deepEqual(byId["part-upper"].pivot, { x: 20, y: 6 }, "upper blob pivot = bbox centre (no antenna assumed)");
  assert.deepEqual(byId["part-island-1"].pivot, { x: 15, y: 15 }, "island 1 pivot = bbox centre");
  assert.deepEqual(byId["part-island-2"].pivot, { x: 25, y: 15 }, "island 2 pivot = bbox centre");
  assert.equal(parts.length, 5, "the two colour islands are distinct parts, not merged (D6: no anatomy-based merge)");
}

// --- emitted SVG carries real per-rect colors and data-tint on groups ----------------------------
{
  const { svg } = segment(mascotRects(), { viewBoxSize: 48 });
  // rects carry original image colors, not the diagnostic tint
  assert.ok(svg.includes('fill="#cccccc"'), "body rect carries its real color #cccccc");
  assert.ok(svg.includes('fill="#333333"'), "leg rect carries its real color #333333");
  assert.ok(svg.includes('fill="#33cc33"'), "antenna rect carries its real color #33cc33");
  assert.ok(svg.includes('fill="#000000"'), "eye rect carries its real color #000000");
  // groups carry data-tint for the editor
  assert.ok(svg.includes('data-tint="#c9ced1"'), "body group carries data-tint");
  assert.ok(svg.includes('data-tint="#ff7f0e"'), "lower-left group carries data-tint");
  assert.ok(svg.includes('data-tint="#2ca02c"'), "upper group carries data-tint");
  assert.ok(svg.includes('data-tint="#d62728"'), "island-1 group carries data-tint");
  // groups do NOT have a fill= attribute (tint no longer baked into group fill)
  assert.ok(!/<g[^>]*\bfill="/.test(svg.replace(/data-role="pivot-markers"[^>]*fill="none"/, "")),
    "part groups do not carry a fill= attribute");
}

// --- emitted SVG round-trips through the existing loader (D6: every rect in one group) ------------
{
  const { svg } = segment(mascotRects(), { viewBoxSize: 48 });
  const model = parseSegmented(svg);
  assert.equal(model.rects().length, 5, "all 5 flat rects survive into the model");
  assert.ok(model.everyRectGrouped(), "every rect lands in exactly one part");
  assert.equal(model.viewBox(), "0 0 48 48");
  assert.deepEqual(model.parts()["part-lower-left"].pivot, { x: 14, y: 35 }, "loader reads the joint pivot");
  // loader captures the diagnostic tint from data-tint
  assert.equal(model.parts()["part-body"].tint, "#c9ced1", "loader reads data-tint into part meta");
  assert.equal(model.parts()["part-lower-left"].tint, "#ff7f0e", "loader reads lower-left tint");
  // real colors survive into the model rects
  const bodyRects = model.rectsOf("part-body");
  assert.ok(bodyRects.some((r) => r.fill === "#cccccc"), "body rect fill is the real color, not the tint");
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
  assert.ok(model.parts()["part-body"] && model.parts()["part-lower-left"] && model.parts()["part-upper"],
    "the PNG path proposed body + lower-left + upper (positional, no spec)");
  model.setRole("part-body", "core"); model.setBone("part-body", "body"); model.setPreset("idle", "part-body", "breathe");
  model.setRole("part-lower-left", "limb"); model.setBone("part-lower-left", "leg"); model.setPreset("active", "part-lower-left", "walk");
  model.setRole("part-upper", "accent"); model.setBone("part-upper", "antenna"); model.setPreset("alert", "part-upper", "pulse");
  const out = exportRig(model, { assetName: "synthetic", recipeFor });
  const v = validate(out.riggedJson);
  assert.equal(v.ok, true, `full PNG-path export must validate: ${v.errors.join("; ")}`);
}

// --- P-seg: generic blob fallback ----------------------------------------------------------------
// When the heuristic names ONLY part-body AND there are >=2 distinct blobs, fall back to one part per
// blob (part-1..N, area desc) instead of absorbing every blob into the body. This rescues the 16/20
// battery inputs that previously collapsed to a single part.

// two side-by-side, different colours, neither below/above the body: heuristic would name only body.
{
  const rects = [
    { x: 0, y: 10, w: 30, h: 20, fill: "#aaaaaa" },  // left blob (larger area)
    { x: 40, y: 12, w: 20, h: 16, fill: "#222222" }, // right blob (smaller)
  ];
  const { parts } = segment(rects, { viewBoxSize: 64 });
  assert.equal(parts.length, 2, "two side-by-side blobs fall back to two parts (not collapsed to body)");
  assert.deepEqual(parts.map((p) => p.id), ["part-1", "part-2"], "generic ids, ordered by area desc");
  assert.equal(parts[0].rects[0].x, 0, "part-1 is the larger (left) blob");
  assert.equal(parts[1].rects[0].x, 40, "part-2 is the smaller (right) blob");
}

// concentric rings (3 distinct colours, all inside the largest): heuristic eye-rule needs cy<midY, so
// the inner rings would otherwise be absorbed. Fallback gives one part per ring.
{
  const rects = [
    { x: 0, y: 0, w: 60, h: 60, fill: "#111111" },   // outer (largest)
    { x: 14, y: 14, w: 32, h: 32, fill: "#888888" }, // middle
    { x: 24, y: 24, w: 12, h: 12, fill: "#ffffff" }, // inner
  ];
  const { parts } = segment(rects, { viewBoxSize: 60 });
  assert.ok(parts.length >= 2, `concentric input yields >=2 parts (got ${parts.length})`);
  assert.deepEqual(parts.map((p) => p.id), ["part-1", "part-2", "part-3"], "concentric → 3 generic parts area desc");
}

// many colours in a row: every block a distinct colour, none below/above body → only body named.
{
  const rects = Array.from({ length: 6 }, (_, i) => ({
    x: i * 10, y: 0, w: 8, h: 10, fill: ["#100000", "#001000", "#000010", "#101000", "#100010", "#001010"][i],
  }));
  // give the first a clearly larger area so area-desc ordering is deterministic
  rects[0].w = 9; rects[0].h = 12;
  const { parts } = segment(rects, { viewBoxSize: 60 });
  assert.ok(parts.length >= 2, `many-colour row yields >=2 parts (got ${parts.length})`);
  assert.equal(parts[0].id, "part-1", "largest block is part-1");
}

// fallback must NOT trigger when the heuristic already names >1 part (mascot has multiple named blobs).
{
  const { parts } = segment(mascotRects(), { viewBoxSize: 48 });
  assert.deepEqual(parts.map((p) => p.id), ["part-body", "part-lower-left", "part-upper", "part-island-1", "part-island-2"],
    "named-multi case is unchanged — fallback does not fire");
}

// fallback must NOT trigger on a single blob (need >=2): one solid shape stays part-body.
{
  const { parts } = segment([{ x: 5, y: 5, w: 20, h: 20, fill: "#777777" }], { viewBoxSize: 32 });
  assert.deepEqual(parts.map((p) => p.id), ["part-body"], "single blob stays part-body (no fallback)");
}

// fallback output round-trips through the loader with every rect grouped (D6).
{
  const rects = [
    { x: 0, y: 0, w: 30, h: 30, fill: "#aaaaaa" },
    { x: 40, y: 0, w: 20, h: 20, fill: "#222222" },
  ];
  const { svg, parts } = segment(rects, { viewBoxSize: 64 });
  const model = parseSegmented(svg);
  assert.ok(model.everyRectGrouped(), "every rect lands in exactly one part after fallback");
  assert.equal(model.rects().length, 2, "no rects lost in fallback");
  assert.equal(Object.keys(model.parts()).length, parts.length, "loader sees the same part count");
}

// P-seg fallback guard: the DevBrain flat input (true pixel art), segmented WITHOUT a parts-spec,
// still yields distinct positionally-named blobs — the generic part-N fallback must never fire here.
// (The shipped DevBrain asset carries a parts-spec — see tools/check-segmented.ps1 — so in the real
// pipeline these ids resolve to the spec's anatomical names; this test drives the bare geometry
// heuristic, which is why the two colour islands land as separate island-1/island-2 here.)
{
  const flatPath = fileURLToPath(new URL("../../docs/buildable-slice/generated/devbrain-flat.svg", import.meta.url));
  const flat = flatRectsFromSvg(readFileSync(flatPath, "utf8"));
  const { parts } = segment(flat, { viewBoxSize: 192 });
  const ids = parts.map((p) => p.id).sort();
  assert.deepEqual(ids, ["part-body", "part-island-1", "part-island-2", "part-lower-left", "part-lower-right", "part-upper"],
    "DevBrain geometry still yields distinct positional parts (fallback did not fire)");
  assert.ok(!parts.some((p) => /^part-\d+$/.test(p.id)), "no generic part-N ids in the DevBrain geometry");
}

console.log("segment.test.mjs: all assertions passed.");
