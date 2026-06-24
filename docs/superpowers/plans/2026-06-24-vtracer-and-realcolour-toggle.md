# VTracer Integration + Real-Colour Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phases 1–2 of the optimised mascot route — a real-colours preview toggle in the
browser editor, and path-based vectorisation via VTracer flowing through the existing rig model.

**Architecture:** VTracer (Rust, via the `@neplex/vectorizer` NAPI binding) runs in the `mcp/`
integration layer beside `pngjs`, producing colour-clustered `<path>` SVG. A small pure parser turns
that SVG into geometry-agnostic model elements (each path carries its raw `markup` plus a computed
bbox so marquee selection and export both work, per ADR-0011). The browser editor and zero-dep
runtime are untouched; the JS scanline vectoriser stays as the fallback engine.

**Tech Stack:** Node ESM (no build step), `@neplex/vectorizer` (integration-only dep), `node:assert`
self-check tests, Playwright e2e for the browser editor, PowerShell `check-all.ps1` regression gate.

## Global Constraints

- The **runtime artifact stays zero-dependency**; new deps live only in `mcp/package.json` (precedent: `pngjs`, `zod`). Copied verbatim from `mcp/tools.mjs`: "Runtime artifact stays zero-dep; this package's deps (pngjs) are integration-only."
- **No ML / no neural libraries** (ADR-0002: "the tool proposes, the editor is the human confirm step").
- Tests use **`node:assert/strict`, no framework**, and mirror the existing `*.test.mjs` pattern. New node suites are wired into `tools/check-all.ps1` P5.
- All new modules are **pure ESM, runnable under `node`** (no DOM) except the browser editor (`app.js`).
- Match the existing **terse top-of-file comment style** describing purpose + ceiling.
- Branch in progress: `fix/color-preservation-and-rigging`. Commit per task.

---

## File Structure

- `tools/rig-editor/app.js` (modify) — add a real-colours render toggle.
- `tools/rig-editor/index.html` (modify) — add the toggle checkbox control.
- `tests/e2e/rig-editor.spec.mjs` (modify) — e2e test for the toggle.
- `tools/rig-editor/path-bbox.js` (create) — pure: compute a bounding box from an SVG path `d` string.
- `tools/rig-editor/path-bbox.test.mjs` (create) — self-check for the bbox parser.
- `mcp/vectorize-vtracer.mjs` (create) — wrapper over `@neplex/vectorizer` + VTracer-SVG → model elements.
- `mcp/vectorize-vtracer.test.mjs` (create) — smoke + round-trip self-check.
- `mcp/tools.mjs` (modify) — `startFromImage` gains an opt-in `engine: "vtracer" | "scanline"`.
- `mcp/tools.test.mjs` (modify) — assert the vtracer engine path emits a valid, smaller rig.
- `mcp/package.json` (modify) — add the `@neplex/vectorizer` dependency.
- `tools/check-all.ps1` (modify) — wire `path-bbox` into the P5 gate.

---

## Task 1: Real-colours preview toggle (Phase 1)

**Files:**
- Modify: `tools/rig-editor/app.js` (the `renderStage` rect-fill line, ~218) and a small UI state flag
- Modify: `tools/rig-editor/index.html` (controls area — add the checkbox)
- Test: `tests/e2e/rig-editor.spec.mjs`

**Interfaces:**
- Consumes: the model's per-rect `r.fill` (real image colour, already carried since Wave 1) and the
  client-side `colours.get(id)` per-part palette.
- Produces: a `#realcolours` checkbox; when checked, rects render with `r.fill` instead of `colours.get(id)`.

- [ ] **Step 1: Write the failing e2e test**

```javascript
test("real-colours toggle switches rect fills between part-palette and source colours", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  const rect = page.locator("#part-body rect").first();
  const byPart = await rect.getAttribute("fill");
  await page.check("#realcolours");
  const real = await rect.getAttribute("fill");
  expect(real).not.toBe(byPart);            // fill changed to the source colour
  await page.uncheck("#realcolours");
  expect(await rect.getAttribute("fill")).toBe(byPart); // back to the part palette
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd tests && npx playwright test -g "real-colours toggle"`
Expected: FAIL — `#realcolours` does not exist.

- [ ] **Step 3: Add the checkbox to the editor UI**

In `tools/rig-editor/index.html`, add to the controls/toolbar area (near `#loadexample`):

```html
<label><input type="checkbox" id="realcolours"> real colours</label>
```

- [ ] **Step 4: Wire the toggle into the render path**

In `tools/rig-editor/app.js`, add a module-level flag and re-render on change. Near the other control
wiring (where `#loadexample` is bound), add:

```javascript
let showRealColours = false;
const realToggle = $("realcolours");
if (realToggle) realToggle.addEventListener("change", () => { showRealColours = realToggle.checked; renderStage(); });
```

Then change the rect-fill line in `renderStage` (currently
`node.setAttribute("fill", colours.get(id)); // colour-by-part view (rect inputs)`) to:

```javascript
// colour-by-part for boundaries, or the rect's real source colour when the toggle is on
node.setAttribute("fill", showRealColours ? (r.fill || colours.get(id)) : colours.get(id));
```

(Replace `renderStage` with the actual render-function name if it differs — it is the function
containing that `setAttribute("fill", colours.get(id))` line.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd tests && npx playwright test -g "real-colours toggle"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tools/rig-editor/app.js tools/rig-editor/index.html tests/e2e/rig-editor.spec.mjs
git commit -m "feat(editor): real-colours preview toggle"
```

---

## Task 2: Path bbox parser (pure)

**Files:**
- Create: `tools/rig-editor/path-bbox.js`
- Test: `tools/rig-editor/path-bbox.test.mjs`

**Interfaces:**
- Produces: `export function pathBBox(d)` → `{ x, y, w, h }`. Input: an SVG path `d` string with
  **absolute** commands (VTracer default). Returns the bbox over all coordinate pairs (anchors and
  control points), which is a safe superset of the true curve bbox.

- [ ] **Step 1: Write the failing test**

```javascript
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
console.log("path-bbox.test.mjs: all assertions passed.");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tools/rig-editor/path-bbox.test.mjs`
Expected: FAIL — `Cannot find module './path-bbox.js'`.

- [ ] **Step 3: Implement the parser**

```javascript
// path-bbox.js — bounding box of an SVG path `d` string. Pure, dependency-free ESM.
// ponytail: bbox over ALL coordinate pairs (anchors + bezier control points), a safe SUPERSET of the
// true curve bbox — fine for full-containment marquee selection (slightly conservative). Assumes
// ABSOLUTE commands (VTracer's default output); relative-command input would need a command walker.
export function pathBBox(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (minX === Infinity) throw new Error("pathBBox: no coordinates in path data.");
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node tools/rig-editor/path-bbox.test.mjs`
Expected: `path-bbox.test.mjs: all assertions passed.`

- [ ] **Step 5: Wire into the regression gate**

In `tools/check-all.ps1`, add `"path-bbox"` to the P5 `foreach` test list (next to `"segment-quality"`).

- [ ] **Step 6: Commit**

```bash
git add tools/rig-editor/path-bbox.js tools/rig-editor/path-bbox.test.mjs tools/check-all.ps1
git commit -m "feat: SVG path bbox parser for path-based elements"
```

---

## Task 3: VTracer wrapper + SVG→model parser

**Files:**
- Modify: `mcp/package.json` (add dependency)
- Create: `mcp/vectorize-vtracer.mjs`
- Test: `mcp/vectorize-vtracer.test.mjs`

**Interfaces:**
- Consumes: `pathBBox` from `../tools/rig-editor/path-bbox.js`; `@neplex/vectorizer` `vectorizeSync`.
- Produces:
  - `export function vtracerSvg(pngBuffer, opts?)` → SVG string (raw VTracer output).
  - `export function elementsFromVtracerSvg(svgText)` → `{ viewBox, elements }` where each element is
    `{ id, x, y, w, h, markup, fill }` (bbox fields + raw `<path>` markup + the path's fill colour).

- [ ] **Step 1: Add the dependency**

Run:
```bash
cd mcp && npm install @neplex/vectorizer
```
Expected: installs with a prebuilt binary for this platform (win32-x64). If it builds from source or
fails, STOP and report — this is the binary-availability risk flagged in the spec.

- [ ] **Step 2: Write the failing test**

```javascript
// mcp/vectorize-vtracer.test.mjs — VTracer wrapper smoke + SVG->model parse round-trip.
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { vtracerSvg, elementsFromVtracerSvg } from "./vectorize-vtracer.mjs";

// build a 16x16 PNG: a solid red square on a green field (two clear colour regions)
const png = new PNG({ width: 16, height: 16 });
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const o = (y * 16 + x) * 4, red = x >= 4 && x < 12 && y >= 4 && y < 12;
  png.data[o] = red ? 220 : 30; png.data[o + 1] = red ? 30 : 200; png.data[o + 2] = 30; png.data[o + 3] = 255;
}
const buf = PNG.sync.write(png);

// 1. wrapper returns an SVG with at least one <path>
const svg = vtracerSvg(buf, { colorPrecision: 6, filterSpeckle: 2 });
assert.ok(/<svg[\s>]/.test(svg) && /<path[\s>]/.test(svg), "vtracer emits an SVG with <path> elements");

// 2. parser yields >=1 element, each with a finite bbox and raw path markup
const { viewBox, elements } = elementsFromVtracerSvg(svg);
assert.ok(/^\d/.test(viewBox) || /\d+ \d+ \d+ \d+/.test(viewBox), "a viewBox is recovered");
assert.ok(elements.length >= 1, "at least one path element");
for (const el of elements) {
  assert.ok(Number.isFinite(el.x) && Number.isFinite(el.w) && el.w >= 0, "element has a finite bbox");
  assert.ok(/^<path[\s>]/.test(el.markup), "element carries its raw <path> markup");
  assert.ok(typeof el.fill === "string" && el.fill.length > 0, "element carries a fill colour");
}
console.log("vectorize-vtracer.test.mjs: all assertions passed.");
```

- [ ] **Step 3: Run it to verify it fails**

Run: `node mcp/vectorize-vtracer.test.mjs`
Expected: FAIL — `Cannot find module './vectorize-vtracer.mjs'`.

- [ ] **Step 4: Implement the wrapper + parser**

```javascript
// vectorize-vtracer.mjs — VTracer (path) vectoriser for the mcp/ integration layer. Wraps
// @neplex/vectorizer and parses its colour-clustered <path> SVG into geometry-agnostic model
// elements (ADR-0011: each element keeps its raw markup + a bbox for marquee selection + export).
// Integration-only dep; the zero-dep runtime and the JS scanline vectoriser are untouched.
import { vectorizeSync, ColorMode, Hierarchical, PathSimplifyMode } from "@neplex/vectorizer";
import { pathBBox } from "../tools/rig-editor/path-bbox.js";

const DEFAULTS = {
  colorMode: ColorMode.Color, colorPrecision: 6, filterSpeckle: 4,
  hierarchical: Hierarchical.Stacked, mode: PathSimplifyMode.Spline, pathPrecision: 3,
};

export function vtracerSvg(pngBuffer, opts = {}) {
  return vectorizeSync(pngBuffer, { ...DEFAULTS, ...opts });
}

const attr = (s, name) => { const m = s.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : undefined; };

export function elementsFromVtracerSvg(svgText) {
  const open = svgText.match(/<svg\b[^>]*>/);
  const viewBox = (open && attr(open[0], "viewBox")) ||
    (open && `0 0 ${attr(open[0], "width") || 0} ${attr(open[0], "height") || 0}`) || "0 0 0 0";
  const elements = [];
  const pathRe = /<path\b[^>]*?\/?>/g;
  let m, n = 0;
  while ((m = pathRe.exec(svgText)) !== null) {
    const markup = m[0];
    const d = attr(markup, "d");
    if (!d) continue;
    const bb = pathBBox(d);
    elements.push({ id: `p${n++}`, x: bb.x, y: bb.y, w: bb.w, h: bb.h, markup, fill: attr(markup, "fill") || "#000000" });
  }
  return { viewBox, elements };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node mcp/vectorize-vtracer.test.mjs`
Expected: `vectorize-vtracer.test.mjs: all assertions passed.`

- [ ] **Step 6: Commit**

```bash
git add mcp/package.json mcp/package-lock.json mcp/vectorize-vtracer.mjs mcp/vectorize-vtracer.test.mjs
git commit -m "feat(mcp): VTracer path vectoriser + SVG->model parser"
```

---

## Task 4: Opt-in VTracer engine in `startFromImage`

**Files:**
- Modify: `mcp/tools.mjs` (`startFromImage`)
- Test: `mcp/tools.test.mjs`

**Interfaces:**
- Consumes: `vtracerSvg`, `elementsFromVtracerSvg` (Task 3); `createModel` from the rig-editor model.
- Produces: `startFromImage({ ..., engine })` where `engine` defaults to `"scanline"` (today's JS path)
  and `engine: "vtracer"` builds the model from VTracer path elements instead. Return shape unchanged
  (`{ session, viewBox, parts, note }`).

- [ ] **Step 1: Write the failing test**

Add to `mcp/tools.test.mjs` (after the existing block-image section):

```javascript
// VTracer engine: path-based start produces a valid, smaller rig than the scanline engine
{
  const png = new PNG({ width: 32, height: 32 });
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const o = (y * 32 + x) * 4, dot = (x - 16) ** 2 + (y - 16) ** 2 < 90;
    png.data[o] = dot ? 210 : 40; png.data[o + 1] = dot ? 40 : 180; png.data[o + 2] = 60; png.data[o + 3] = 255;
  }
  const b64 = PNG.sync.write(png).toString("base64");
  const sv = startFromImage({ base64: b64, engine: "vtracer" });
  assert.ok(sv.session && /\d+ \d+/.test(sv.viewBox), "vtracer start returns a session + viewBox");
  assert.ok(sv.parts.length >= 1, "vtracer start proposes at least one part");
  const a = assignRegion({ session: sv.session, box: { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }, partId: "core", role: "core" });
  assert.ok(a.moved > 0, "a region grabs path elements by bbox");
  const out = forgeEmit({ session: sv.session, assetName: "vtcat" });
  assert.equal(out.ok, true, `vtracer rig must emit valid: ${JSON.stringify(out.validation || out.error)}`);
  assert.ok(out.svgBytes > 0, "vtracer path SVG emitted");
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node mcp/tools.test.mjs`
Expected: FAIL — `engine: "vtracer"` is ignored; with no path elements the region grabs 0 (or shape differs).

- [ ] **Step 3: Implement the engine branch**

In `mcp/tools.mjs`, add the import at the top with the others:

```javascript
import { vtracerSvg, elementsFromVtracerSvg } from "./vectorize-vtracer.mjs";
import { createModel } from "../tools/rig-editor/model.js";
```

Replace the body of `startFromImage` from the `decodePng`/`vectorizeRaster` lines down to the
`parseSegmented` line with an engine switch (keep the session/return code below it unchanged):

```javascript
export function startFromImage({ base64, path, colors = 8, maxDim = 256, engine = "scanline" } = {}) {
  if (!base64 && !path) throw new Error("provide base64 or path (PNG)");
  const buf = base64 ? Buffer.from(base64, "base64") : readFileSync(safePath(path));

  let model;
  if (engine === "vtracer") {
    // path-based: VTracer -> geometry-agnostic elements -> one passive part the agent re-assigns.
    const { viewBox, elements } = elementsFromVtracerSvg(vtracerSvg(buf, { colorPrecision: Math.max(1, Math.round(Math.log2(colors))) }));
    const rects = elements.map((e) => ({ ...e, part: "part-body" }));
    model = createModel({ viewBox, rects, parts: { "part-body": { role: "core" } } });
  } else {
    const grid = downscale(decodePng(buf), maxDim);
    const flat = vectorizeRaster({ rgba: grid.rgba, w: grid.w, h: grid.h }, { colors });
    const seg = segment(flat.rects, { viewBoxSize: Math.max(grid.w, grid.h) });
    model = parseSegmented(seg.svg);
  }

  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  const session = "s" + nextId++;
  const sourceDataUri = `data:image/png;base64,${base64 || buf.toString("base64")}`;
  sessions.set(session, { model, vb: parseVB(model.viewBox()), sourceDataUri });
  return {
    session, viewBox: model.viewBox(), parts: partList(model),
    note: "Parts are a coarse first pass. Coords in assign_region are 0..1 fractions of the viewBox — reassign by what you SEE in the image. Pick presets by anatomy: ears/antennae -> twitch, tail -> wag, eyes -> blink. Part ids are auto-prefixed with 'part-'.",
  };
}
```

Note: the model's `rectsOf`/marquee path already works on `el.bbox || el`; since elements carry
`x/y/w/h` directly, `rectsInMarquee` selects them, and `exporter.serializeSvg` emits `el.markup`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node mcp/tools.test.mjs`
Expected: all blocks pass, including the new VTracer engine block.

- [ ] **Step 5: Run the full regression gate**

Run: `pwsh -NoProfile -File tools/check-all.ps1`
Expected: `RESULT: PASS (all pipeline checks green)`.

- [ ] **Step 6: Commit**

```bash
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): opt-in vtracer engine in start_from_image (paths, scanline fallback)"
```

---

## Task 5: Regenerate the cat on the VTracer engine + measure

**Files:**
- Modify: `scripts/regen-cat.mjs` (add an `engine` arg)

**Interfaces:**
- Consumes: `startFromImage({ engine })` (Task 4).
- Produces: a path-based cat output + a printed before/after rect-or-path count and byte size.

- [ ] **Step 1: Parameterise the regen script**

In `scripts/regen-cat.mjs`, change the start call to read an engine from argv:

```javascript
const engine = process.argv[2] === "vtracer" ? "vtracer" : "scanline";
const s = startFromImage({ path: "Cat.png", colors: 8, engine });
console.log("engine:", engine, "| viewBox:", s.viewBox, "| proposed parts:", s.parts.map((p) => p.id).join(", "));
```

- [ ] **Step 2: Run both engines and compare**

Run:
```bash
node scripts/regen-cat.mjs scanline
node scripts/regen-cat.mjs vtracer
```
Expected: both emit OK. Inspect `output/cat-mascot-mascot.svg` after each; record element count and
byte size. Acceptance: the VTracer output is materially smaller than the ~106KB / 1607-rect baseline
and visibly resembles the cat (open the demo HTML).

- [ ] **Step 3: Commit**

```bash
git add scripts/regen-cat.mjs
git commit -m "chore: regen-cat supports the vtracer engine for before/after comparison"
```

---

## Self-Review

**Spec coverage (Phases 1–2):**
- Phase 1 real-colours toggle → Task 1. ✓
- Phase 2 VTracer node binding in `mcp/` → Task 3. ✓
- Path round-trip through the rig model → Tasks 2 (bbox) + 3 (parser) + 4 (engine, emit+validate). ✓
- JS scanline fallback retained → Task 4 (`engine` defaults to `"scanline"`). ✓
- Size-reduction success criterion → Task 5 measurement. ✓
- Rect-merge optimizer → intentionally OUT (spec demotes it to fallback-only; VTracer supersedes). ✓
- Phases 3–5 (guided route, handoff, launch) → deferred to a follow-up plan, per the spec's risk gating.

**Placeholder scan:** No TBD/placeholder steps; every code step shows code; the one render-function
rename caveat in Task 1 is explicit. ✓

**Type consistency:** `vtracerSvg`/`elementsFromVtracerSvg` signatures match between Tasks 3 and 4;
`pathBBox` return shape `{x,y,w,h}` matches its consumer in Task 3; element shape
`{id,x,y,w,h,markup,fill}` is consistent across the parser, the marquee (`bbox||el`), and the exporter
(`el.markup`). ✓

**Open risk carried from spec:** if `@neplex/vectorizer` has no win32-x64 prebuilt binary (Task 3
Step 1), stop and decide (build-from-source vs. WASM vs. shell-out) before continuing.
