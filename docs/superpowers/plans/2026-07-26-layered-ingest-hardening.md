# Layered-SVG Ingest Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nested `<g>` layers ingest correctly through the node path (matching the browser path, which already flattens them), and make an unresolvable `transform` a loud, named refusal in both paths instead of silently misplaced geometry.

**Architecture:** The node parser's non-greedy group regex is replaced by a depth-aware token scanner that hands each top-level layer its complete subtree. Flattening then costs no extra code — the existing element regex already scans whatever text it is given. The failure line moves off nesting and onto `transform`, which neither path can resolve: two one-line detections (text regex in node, `hasAttribute`/`querySelector` in the browser) sharing one exported message builder, so the two paths cannot word the same refusal differently.

**Tech Stack:** Pure ESM, zero dependencies, no build step. `node:assert/strict` self-checks, no test framework. Playwright for the one browser e2e.

**Spec:** [docs/superpowers/specs/2026-07-26-layered-ingest-hardening-design.md](../specs/2026-07-26-layered-ingest-hardening-design.md)

## Global Constraints

These apply to every task. Each has broken this repo before.

- **NEVER create a root `package.json`.** `tools/check-buildable-slice.ps1` asserts its absence to guard the zero-dependency claim. If node prints a module-type warning, ignore it.
- **MCP tool count is locked at exactly 10** (`mcp/protocol.test.mjs`). Do not add a tool. Nothing in this plan needs one.
- **`runtime/` and `tools/rig-editor/` stay zero-dependency, pure ESM, no build step.** No import outside `node:` and sibling modules. New deps are permitted only in `mcp/`, `tools/emit-react-gsap/`, and `tests/` — and this plan adds none anywhere.
- **`docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` are byte-for-byte goldens.** If one moves, STOP and report. Do not regenerate to make a test pass.
- **Tests use `node:assert/strict`, no framework**, mirroring the existing `*.test.mjs` files.
- **Gate after every task:** `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` must print `RESULT: PASS`.
- **E2E after Task 2:** `pwsh -NoProfile -File tools/check-e2e.ps1` must report **24 passed** (20 today, this plan adds four). Any other number is a regression. This supersedes the spec's figure of 21 — see Task 2 Step 6.
- **Only make the changes the task calls for.** No extra features, abstractions, or files.
- **Commit bodies end with:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Do not push.** Do not delete any tracked file. Both require asking the user first.

## Domain Orientation

You are working on a rig editor that turns a designer's layered SVG into an animated mascot. Terms:

- **Layer** — a top-level `<g>` in the source SVG. Becomes one **part**.
- **Part** — an animatable unit, id derived from the layer name (`"Left Arm"` → `part-left-arm`).
- **Element** — one drawable (`rect`/`path`/`circle`/…) carried as **opaque `markup`** plus a cached **bbox**. The exporter re-emits `markup` verbatim.
- **Two ingest paths, deliberately duplicated:** `parseLayered` in `tools/rig-editor/layer-ingest.js` is pure and node-testable (bboxes computed arithmetically). `loadLayeredSvg` in `tools/rig-editor/app.js` uses `DOMParser` + `getBBox` for real files. They share naming and model assembly via `layer-ingest.js`. Keeping them in agreement is the point of this plan.

## File Structure

| File | Change | Responsibility after this plan |
|---|---|---|
| `tools/rig-editor/layer-ingest.js` | Modify | Adds `topLevelGroups()` (depth-aware scanner) and `transformErrorMessage()`. `parseLayered` uses both; nested-`<g>` rejection removed; transform refusal added. |
| `tools/rig-editor/layer-ingest.test.mjs` | Modify | Nesting/flattening, transform refusal, metadata-rule assertions. One existing assertion is **replaced** (see Task 1 Step 1). |
| `tools/rig-editor/app.js` | Modify | `loadLayeredSvg` gains the same refusal, reported via `status()` + early return. Flattening is untouched — it already worked. |
| `tests/e2e/layered-transform.spec.mjs` | Create | One browser e2e: transformed layer is refused, names the layer, and leaks no offscreen DOM. |
| `CHANGELOG.md` | Modify | Correct the 2026-07-05 line that says nested `<g>` is rejected. |
| `README.md:207` | Modify | Correct the "flat exports only" claim. |

No gate wiring is needed: `layer-ingest` is already in `check-all.ps1`'s P5 list (line 36), and `check-e2e.ps1` runs `npx playwright test` over the whole `tests/e2e` directory, so a new spec file is picked up automatically.

---

### Task 1: Depth-aware group scan + transform refusal (node path)

**Why these ship together:** Task 1 alone would make a nested transformed export *load silently wrong* where it previously threw — strictly worse than today. The scanner and the guard are one reviewable unit because rejecting the guard while keeping the scanner is not a state anyone should be able to land.

**Files:**
- Modify: `tools/rig-editor/layer-ingest.js` (header comment lines 1-9; `GROUP_RE` line 14; `parseLayered` lines 41-82)
- Test: `tools/rig-editor/layer-ingest.test.mjs` (replace lines 107-114; append new assertions)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, both used by Task 2:
  - `export function topLevelGroups(svgText: string): Array<{ attrs: string, inner: string }>`
  - `export function transformErrorMessage(layerNames: string[]): string`

---

- [ ] **Step 1: Replace the obsolete nested-rejection test with the new expectations**

Open `tools/rig-editor/layer-ingest.test.mjs`. **Delete lines 107-114** — the block beginning `// I3a: nested <g> exports silently lose the outer group's own geometry` and ending with the closing `);` of the `assert.throws`.

That test asserts nested `<g>` throws. This plan reverses that rule. **Its failure is the intended outcome, not a regression — do not "fix" it back.**

In its place, insert:

```js
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
// element — invisible in the source, exported as real geometry. Root-level <defs> was never at risk
// (it sits outside every top-level <g>); an in-group one is.
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

// [Post-review correction, 2026-07-26]: the "Root-level <defs> was never at risk" line above was
// wrong, and that wrong reasoning is what let the bug ship. `topLevelGroups` scans the raw document
// text; a <g> inside a root-level <defs>/<clipPath> IS picked up as a top-level layer there (it is
// only outside every top-level <g> in the DOM, which is irrelevant to a text scanner run before any
// layer is chosen). The per-layer NON_RENDERED strip in this plan's implementation ran too late —
// after topLevelGroups had already selected layers from the unstripped document — to catch it. Fixed
// post-review by stripping comments + NON_RENDERED once at the document level, before topLevelGroups
// runs; see `tools/rig-editor/layer-ingest.js` and the finding write-up in
// `.superpowers/sdd/final-review-fixes-report.md`. This plan entry is left as-authored, as a record.

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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
node tools/rig-editor/layer-ingest.test.mjs
```

Expected: FAIL. The first new block throws `nested <g> layers are not supported…` from the current line-58 guard.

- [ ] **Step 3: Add the depth-aware scanner**

In `tools/rig-editor/layer-ingest.js`, **replace** the `GROUP_RE` constant on line 14:

```js
const GROUP_RE = /<g\b([^>]*)>([\s\S]*?)<\/g>/g;
```

with the token regex and the scanner (place the scanner just below the `attr`/`inkLabel` helpers, above `rectBBox`):

```js
const G_TOKEN = /<g\b([^>]*?)(\/?)>|<\/g\s*>/g;

// The TOP-LEVEL <g> layers, each with its COMPLETE subtree. A non-greedy `<g>…</g>` regex ends the
// outer group at the first inner </g> and so silently drops the outer group's own geometry (audit
// I3) — tracking depth instead fixes that, and flattening falls out for free: EL_RE below scans the
// whole subtree, so a drawable at any depth joins this layer's part. Metadata is still read from the
// top-level attrs only, so a nested group can never become a part.
export function topLevelGroups(svgText) {
  const out = [];
  let depth = 0, start = -1, attrs = "";
  let m;
  G_TOKEN.lastIndex = 0;
  while ((m = G_TOKEN.exec(svgText)) !== null) {
    if (m[0][1] === "/") {                       // </g>
      if (depth === 0) continue;                 // stray close — clamp, don't throw on a counter
      if (--depth === 0) out.push({ attrs, inner: svgText.slice(start, m.index) });
      continue;
    }
    if (m[2] === "/") continue;                  // <g/> — self-closing, carries no geometry
    if (depth === 0) { attrs = m[1]; start = G_TOKEN.lastIndex; }
    depth++;
  }
  return out;
}
```

- [ ] **Step 4: Add the shared refusal message**

Still in `layer-ingest.js`, below `topLevelGroups`:

```js
// Shared wording for both ingest paths. The DETECTION differs (text regex here, hasAttribute/
// querySelector in app.js's DOM path) — abstracting over that would cost more than it saves — but a
// user must never read two different explanations of the same refusal, so the message has one home.
export function transformErrorMessage(layerNames) {
  const list = layerNames.map((n) => `"${n}"`).join(", ");
  return `layer(s) ${list} carry a transform — layered ingest does not resolve transforms, so those `
    + `shapes would be placed incorrectly. Flatten or ungroup them before export `
    + `(Figma: right-click → Flatten selection; Illustrator: Object → Expand).`;
}

// ponytail: transforms are DETECTED, not resolved. Upgrade path if real exports make this the
// dominant first-run failure: compose ancestor translate(tx,ty) into the cached bbox and wrap the
// element in `<g transform="translate(…)">` — exporter.js emits `markup` verbatim, so the wrapper
// survives. Rotate/scale/matrix would still refuse. Not built without evidence it's needed.
const HAS_TRANSFORM = /(^|\s)transform\s*=/;   // anchored on a boundary so gradientTransform is not a match

// Subtrees that define rather than draw. Stripped before scanning a layer, so a clip shape or a
// gradient stop can never be mistaken for art now that nesting flattens. Non-greedy, so a same-tag
// nest (a <mask> inside a <mask>) would end early — SVG exporters do not emit that.
const NON_RENDERED = /<(defs|clipPath|mask|symbol|pattern|marker)\b[\s\S]*?<\/\1>/gi;
```

- [ ] **Step 5: Rewrite `parseLayered`'s group loop**

**Replace the entire `parseLayered` function** — from `export function parseLayered(svgText) {` (line 41) through its closing `}` (line 82) — with the code below. This is the whole function, not a fragment: delete what is there and paste this. The `let g;` declaration and the `GROUP_RE`-based `while` loop disappear entirely.

```js
export function parseLayered(svgText) {
  const svgOpen = svgText.match(/<svg\b[^>]*>/);
  const viewBox = (svgOpen && attr(svgOpen[0], "viewBox")) || "0 0 192 192";
  const statesAttr = svgOpen && attr(svgOpen[0], "data-states");
  const states = statesAttr ? statesAttr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  // U1: exporter output wraps the part groups in a single #rig-root group — descend one level so each
  // part <g> is a layer again (the editor's own export round-trips like any layered SVG). Same rule
  // the browser applies in app.js loadLayeredSvg.
  const top = topLevelGroups(svgText);
  const layers = (top.length === 1 && /\bid="rig-root"/.test(top[0].attrs)) ? topLevelGroups(top[0].inner) : top;

  // Names resolved up front so the transform refusal can report ALL offending layers in one pass.
  // The `layer-N` counter advances only for unnamed layers — matching the previous behaviour exactly.
  let layerN = 0;
  const names = layers.map((l) => inkLabel(l.attrs) || attr(l.attrs, "id") || attr(l.attrs, "data-name") || `layer-${++layerN}`);

  // Strip non-rendered subtrees ONCE, then use the result for both the transform check and the element
  // scan — so a transform living inside a <clipPath> cannot trigger a refusal for art it never places.
  const bodies = layers.map((l) => l.inner.replace(NON_RENDERED, ""));

  const offending = layers.map((l, i) => (HAS_TRANSFORM.test(l.attrs) || HAS_TRANSFORM.test(bodies[i])) ? names[i] : null).filter(Boolean);
  if (offending.length) throw new Error(transformErrorMessage(offending));

  const partsMeta = {};
  const used = new Set();
  const elements = [];
  let eid = 0;
  for (let i = 0; i < layers.length; i++) {
    const gAttrs = layers[i].attrs, inner = bodies[i];
    const part = sanitizeId(names[i], used);
    const meta = partsMeta[part] || (partsMeta[part] = {});
    const role = attr(gAttrs, "data-role"); if (role) meta.role = role;
    const kind = attr(gAttrs, "data-kind"); if (kind) meta.kind = kind;
    const bone = attr(gAttrs, "data-bone"); if (bone) meta.bone = bone;
    const piv = attr(gAttrs, "data-pivot");
    if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const pm of gAttrs.matchAll(/\bdata-preset-([a-z0-9-]+?)="([^"]*)"/g)) { (meta.presets || (meta.presets = {}))[pm[1]] = pm[2]; }
    EL_RE.lastIndex = 0;
    let m;
    while ((m = EL_RE.exec(inner)) !== null) {
      const tag = m[1], aStr = m[2];
      // rect bbox from attributes; path bbox from its `d` via pathBBox. Other non-rect shapes still
      // defer to the browser's getBBox.
      const d = attr(aStr, "d");
      const bbox = tag === "rect" ? rectBBox(aStr) : (tag === "path" && d ? pathBBox(d) : null);
      elements.push({ id: `e${eid++}`, part, markup: m[0], bbox });
    }
  }
  return { viewBox, elements, parts: partsMeta, states };
}
```

Two things to notice while editing: the old `#rig-root` greedy-regex unwrap (lines 44-45) is **gone**, replaced by the scanner-based `layers` line; and `svgOpen` is now matched before any unwrapping, which is equivalent because unwrapping never touched the `<svg>` open tag.

- [ ] **Step 6: Update the header comment's stated ceiling**

Replace lines 6-9 of `layer-ingest.js`:

```js
// ponytail: a regex tokenizer for the flat/known-shape case (tests + simple exports). The browser
// (app.js) uses DOMParser + getBBox for real files — it handles messy whitespace and computes path
// bboxes — but reuses the naming/sanitize/dedupe + model assembly here so both paths agree.
// Known v1 limits: per-group/element transforms are not resolved, and NESTED <g> layers are rejected
// (the non-greedy tokenizer would drop the outer group's own geometry) — flatten exports first.
```

with:

```js
// ponytail: a regex tokenizer for the known-shape case (tests + real exports). The browser (app.js)
// uses DOMParser + getBBox for arbitrary files — it handles messy whitespace and computes path bboxes
// — but reuses the naming/sanitize/dedupe + model assembly here so both paths agree.
// Nested <g> FLATTENS: a top-level layer owns every drawable in its subtree, at any depth, except
// inside non-rendered subtrees (<defs>/<clipPath>/<mask>/…), which define rather than draw. Metadata
// (data-role/kind/bone/pivot/preset-*) is read from the TOP-LEVEL <g> only — a nested group
// contributes geometry, never a part of its own.
// Known v1 limit: transforms are not RESOLVED. Any `transform=` in a layer's subtree is refused by
// name rather than silently misplacing the art (getBBox reports own-user-space, and `markup` is
// re-parented away from its ancestors on export, so a dropped transform is invisibly wrong).
// A `>` inside an attribute VALUE still confuses this tokenizer — pre-existing, browser path is safe.
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
node tools/rig-editor/layer-ingest.test.mjs
```

Expected: `layer-ingest.test.mjs: all assertions passed.`

- [ ] **Step 8: Verify the guard has teeth (anti-vacuity check)**

Temporarily change `HAS_TRANSFORM` to `/(^|\s)NOPE\s*=/` and re-run:

```bash
node tools/rig-editor/layer-ingest.test.mjs
```

Expected: FAIL on the transform assertions. Then temporarily restore `GROUP_RE`-style non-greedy behaviour by changing `if (--depth === 0)` to `if (depth-- >= 0)` and re-run — expected: FAIL on the nesting assertions. **Revert both experiments** and confirm the suite passes again. Report both observed failure messages in your task summary; a guard that cannot be made to fail is not a guard.

- [ ] **Step 9: Run the dependent node suites**

The MCP layered path and the exporter goldens both consume `parseLayered`:

```bash
node mcp/tools.test.mjs && node tools/rig-editor/exporter.test.mjs && node mcp/smiley-golden.test.mjs
```

Expected: all pass. If a golden moved, **STOP and report** — do not regenerate.

- [ ] **Step 10: Run the full gate**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
```

Expected: `RESULT: PASS (all pipeline checks green)`, P1 through P7.

- [ ] **Step 11: Commit**

```bash
git add tools/rig-editor/layer-ingest.js tools/rig-editor/layer-ingest.test.mjs
git commit -m "feat(layer-ingest): flatten nested <g>; refuse unresolvable transforms by name"
```

Body must explain that the nested-rejection test was replaced deliberately, and end with the `Co-Authored-By:` trailer.

- [ ] **Step 12: Report back**

Your reviewer sees only what you write here. Include, verbatim:

1. The commit SHA.
2. The **two failure messages you observed in Step 8** when you mutated the guards. If you skipped Step 8, say so — do not imply you ran it.
3. The final line of `check-all.ps1` output.
4. Confirmation that `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` are unmodified (`git status --short` showing neither).
5. Anything you changed that this plan did not specify, and why. "Nothing" is a valid and expected answer.

---

### Task 2: Same refusal in the browser path + e2e + doc correction

**Files:**
- Modify: `tools/rig-editor/app.js` (import line 17; `loadLayeredSvg` lines 197-244)
- Create: `tests/e2e/layered-transform.spec.mjs`
- Modify: `CHANGELOG.md` (line 72), `README.md` (line 207)

**Interfaces:**
- Consumes: `transformErrorMessage(layerNames: string[]): string` from `tools/rig-editor/layer-ingest.js` (Task 1).
- Produces: nothing later tasks depend on.

**Harness facts:** Playwright's `baseURL` is the **repo root**, which is why the sibling specs use `"/tools/rig-editor/index.html"` — the same reason the cross-path test can `import("/tools/rig-editor/layer-ingest.js")` and get the real, pure node module running in the page. `check-e2e.ps1` runs `npm install` in `tests/` automatically on first use, so a slow first run is expected, not a fault. Passing a name (`check-e2e.ps1 layered-transform`) filters to that spec.

**Context you need:** `loadLayeredSvg` parses into a **hidden offscreen `<div>` appended to `document.body`** (lines 202-205) because `getBBox` only works on rendered nodes. It removes that wrapper at line 238. Any early return you add **after** line 205 must remove the wrapper first or the DOM leaks — the e2e below asserts it does not. The browser reports failure through `status(msg)` + `return`, never a throw: this runs in a drop handler, and a throw would leave the editor in an undefined state, whereas a status message leaves the previous model intact and the user free to try another file.

---

- [ ] **Step 1: Write the failing e2e**

Create `tests/e2e/layered-transform.spec.mjs`:

```js
import { test, expect } from "@playwright/test";

const URL = "/tools/rig-editor/index.html"; // ponytail: local name shadows global URL, as in the sibling specs

const TRANSFORMED = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
  '  <g id="Head"><g transform="translate(10,10)"><rect x="0" y="0" width="20" height="20" fill="#c00"/></g></g>',
  '</svg>',
].join("\n");

// A transform the ingest cannot resolve must fail LOUDLY and by name. getBBox reports the element's
// own user space and `markup` is re-parented on export, so a silently-dropped transform puts the art
// in the wrong place with no error at all — the exact failure class the layered path exists to avoid.
test("a transformed layer is refused, naming the layer", async ({ page }) => {
  await page.goto(URL);
  const msg = await page.evaluate((svg) => {
    window.__rigEditor.loadLayeredSvg(svg, "transformed");
    return document.getElementById("status").textContent;
  }, TRANSFORMED);
  expect(msg).toContain("Head");        // the authored layer name, not the sanitized part id
  expect(msg).toContain("transform");
  expect(msg).toContain("Flatten");     // an action, not just a complaint

  // the aborted load must not leave the offscreen measuring wrapper attached
  const leaked = await page.evaluate(() => [...document.body.children].filter((n) => n.tagName === "DIV" && n.style.left === "-9999px").length);
  expect(leaked).toBe(0);
});

// the untransformed nested case is the one that must now WORK — same shape a Figma export produces
test("a nested but untransformed layer loads as one part", async ({ page }) => {
  await page.goto(URL);
  const parts = await page.evaluate(() => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '  <g id="Arm"><defs><clipPath id="c0"><rect x="0" y="0" width="99" height="99"/></clipPath></defs>',
      '    <g id="hand"><rect x="1" y="1" width="9" height="9" fill="#0b0"/></g>',
      '    <rect x="20" y="20" width="30" height="30" fill="#00b"/></g>',
      '</svg>',
    ].join("\n");
    window.__rigEditor.loadLayeredSvg(svg, "nested");
    const m = window.__rigEditor.model;
    return { parts: Object.keys(m.parts()), elements: m.rects().length };
  });
  expect(parts.parts).toEqual(["part-arm"]);
  // 2, not 3: the <clipPath>'s rect defines a clip, it is not art
  expect(parts.elements).toBe(2);
});

// THE POINT OF THE WHOLE STAGE: the two ingest paths must agree. `parseLayered` is pure ESM served
// over HTTP, so both can be run against ONE fixture inside ONE page — a real cross-check, not two
// separate suites asserting numbers that happen to match today and silently drift tomorrow.
test("node and browser ingest paths agree on the same nested fixture", async ({ page }) => {
  await page.goto(URL);
  const { node, browser } = await page.evaluate(async () => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
      '  <g id="Arm"><defs><clipPath id="c0"><rect x="0" y="0" width="99" height="99"/></clipPath></defs>',
      '    <g id="hand"><rect x="1" y="1" width="9" height="9" fill="#0b0"/></g>',
      '    <rect x="20" y="20" width="30" height="30" fill="#00b"/></g>',
      '  <g id="Leg"><path d="M50 50 L60 50 L60 70 Z" fill="#c00"/></g>',
      '</svg>',
    ].join("\n");
    const { parseLayered } = await import("/tools/rig-editor/layer-ingest.js");
    const p = parseLayered(svg);
    window.__rigEditor.loadLayeredSvg(svg, "agree");
    const m = window.__rigEditor.model;
    return {
      node: { parts: [...new Set(p.elements.map((e) => e.part))], elements: p.elements.length },
      browser: { parts: Object.keys(m.parts()), elements: m.rects().length },
    };
  });
  expect(node.parts).toEqual(["part-arm", "part-leg"]);
  expect(browser.parts).toEqual(node.parts);       // same parts, same order
  expect(node.elements).toBe(3);                   // 2 in Arm (clip rect excluded) + 1 path in Leg
  expect(browser.elements).toBe(node.elements);
});

// Both paths must also REFUSE the same input. The browser reports via status(); node throws.
test("both paths refuse the same transformed fixture", async ({ page }) => {
  await page.goto(URL);
  const { threw, message, status } = await page.evaluate(async (svg) => {
    const { parseLayered } = await import("/tools/rig-editor/layer-ingest.js");
    let threw = false, message = "";
    try { parseLayered(svg); } catch (e) { threw = true; message = e.message; }
    window.__rigEditor.loadLayeredSvg(svg, "transformed");
    return { threw, message, status: document.getElementById("status").textContent };
  }, TRANSFORMED);
  expect(threw).toBe(true);
  expect(status).toBe(message);   // ONE wording, from transformErrorMessage — the paths cannot drift
});
```

- [ ] **Step 2: Run it to verify the first test fails**

```bash
pwsh -NoProfile -File tools/check-e2e.ps1 layered-transform
```

Expected: **all four FAIL**, for three distinct reasons. Report each observed failure — if any test passes at this point, the fixture is not exercising what you think it is.

| Test | Why it fails before the change |
|---|---|
| transformed layer refused | status text is the success message — the transform is ignored today |
| nested untransformed | element count 3, not 2: `querySelectorAll` reaches into the `<clipPath>` |
| paths agree | browser over-counts by the clip rect, so the two sides disagree |
| both paths refuse | node throws (Task 1 landed) but the browser does not, so `status !== message` |

- [ ] **Step 3: Import the shared message**

In `tools/rig-editor/app.js`, change line 17:

```js
import { sanitizeId, toModel } from "./layer-ingest.js";
```

to:

```js
import { sanitizeId, toModel, transformErrorMessage } from "./layer-ingest.js";
```

- [ ] **Step 4: Add the guard to `loadLayeredSvg`**

In `loadLayeredSvg`, immediately after the `const layers = groups.length ? groups : [svgEl];` line (223) and **before** the `for (const g of layers)` geometry loop, insert:

```js
  // Resolve the layer names first so every offending layer is reported in one pass — same rule and
  // same wording as parseLayered (the message has one home in layer-ingest.js).
  let nameN = 0;
  const names = layers.map((g) => g.getAttribute("inkscape:label") || g.getAttribute("id") || g.getAttribute("data-name") || `layer-${++nameN}`);
  // NON_RENDERED: a <clipPath>/<defs> subtree defines, it does not draw. Now that a layer owns its
  // whole subtree, its clip shapes must not count as art — nor as transformed art.
  // NOTE: `clipPath` MUST keep its camelCase. Selector type-matching is case-insensitive only for HTML
  // elements; these nodes stay in the SVG namespace after being adopted into the page, so `clippath`
  // would silently match nothing. Do not "normalise" this string — the cross-path e2e catches it, but
  // only if you leave the assertion alone too.
  const NON_RENDERED = "defs,clipPath,mask,symbol,pattern,marker";
  const isArt = (el) => !el.closest(NON_RENDERED);
  const offending = layers.map((g, i) =>
    (g.hasAttribute("transform") || [...g.querySelectorAll("[transform]")].some(isArt)) ? names[i] : null).filter(Boolean);
  if (offending.length) {
    document.body.removeChild(wrap);   // the offscreen measuring wrapper must not leak on an aborted load
    status(transformErrorMessage(offending));
    return;
  }
```

Then, inside the existing `for (const g of layers)` loop, replace the label line:

```js
    const label = g.getAttribute("inkscape:label") || g.getAttribute("id") || g.getAttribute("data-name") || `layer-${++layerN}`;
    const part = sanitizeId(label, used);
```

with the pre-resolved name (change the loop to an index loop so it can read `names`):

```js
  for (let i = 0; i < layers.length; i++) {
    const g = layers[i];
    const part = sanitizeId(names[i], used);
```

Delete the now-unused `layerN` from the `let eid = 0, layerN = 0;` declaration on line 216, leaving `let eid = 0;`.

Finally, in the same loop, skip non-rendered geometry. Change:

```js
    for (const el of g.querySelectorAll(DRAW)) {
```

to:

```js
    for (const el of g.querySelectorAll(DRAW)) {
      if (!isArt(el)) continue;   // a clip shape is not art — it would export as a phantom element
```

(`getBBox` on an unrendered clip shape returns zeros rather than throwing, so without this the phantom is a zero-box element that quietly widens nothing and exports real markup.)

- [ ] **Step 5: Run the e2e to verify both tests pass**

```bash
pwsh -NoProfile -File tools/check-e2e.ps1 layered-transform
```

Expected: 4 passed.

- [ ] **Step 6: Run the whole e2e suite**

```bash
pwsh -NoProfile -File tools/check-e2e.ps1
```

Expected: **24 passed** (20 before, this file adds four). If you see fewer, something regressed — report it, do not adjust the number.

> **Deviation from the spec, recorded deliberately:** the spec pinned "one new e2e", reasoning that browser flattening was unchanged code not worth a test. Two findings overrode that. Flattening newly exposes `<clipPath>` contents as phantom art, so test 2 covers a real behaviour change in this task rather than yesterday's behaviour. And the stage's central claim — that the two ingest paths agree — was asserted nowhere: tests 3 and 4 verify it directly, importing the pure `parseLayered` into the page and running both paths over one fixture. The spec's count of 21 is superseded by **24**.

- [ ] **Step 7: Correct the two stale documentation claims**

**CHANGELOG.md** — the line at 72 sits under `### Fixed` and records the 2026-07-05 nested-`<g>` rejection. Leave it: it was true when written. Add a new entry at the **top of the `### Changed` section** (heading at line 104), i.e. as the first bullet after that heading:

```markdown
- **Layered ingest accepts nested layers.** A top-level `<g>` now owns every drawable in its subtree at
  any depth, so ordinary Figma/Illustrator exports ingest without being flattened by hand first. This
  reverses the nested-`<g>` rejection listed under Fixed above, which worked around a non-greedy
  tokenizer rather than repairing it; a depth-aware scan repairs it, and `<defs>`/`<clipPath>` subtrees
  are excluded so a clip shape cannot become phantom art. Transforms are still not *resolved*, but are
  now refused **by layer name** with a corrective action rather than silently dropped — a dropped
  transform placed the art in the wrong position with no error at all.
```

**README.md** — replace lines 205-208 exactly:

```markdown
`forge_start_from_layered_svg` and `forge_open_editor` complete the **ten tools**: an alt entry for a
**layered** vector SVG (Figma/Inkscape/Illustrator — each top-level `<g>` becomes a part named by its
layer, nested groups included; layers carrying a `transform` are refused by name, since transforms are
not resolved — flatten or expand those first), and a self-describing handoff into the browser rig
editor (returns a ready `?rig=` URL that loads the rig animated).
```

- [ ] **Step 8: Run the full gate**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
```

Expected: `RESULT: PASS (all pipeline checks green)`.

- [ ] **Step 9: Confirm the locked contracts are still intact**

```bash
pwsh -NoProfile -Command "node mcp/protocol.test.mjs; if (Test-Path package.json) { 'FAIL: root package.json exists' } else { 'ok: no root package.json' }"
```

Expected: protocol test passes (10 tools), then `ok: no root package.json`. Use pwsh here, as everywhere else in this plan — this is a Windows repo and the gate scripts are PowerShell.

- [ ] **Step 10: Commit**

```bash
git add tools/rig-editor/app.js tests/e2e/layered-transform.spec.mjs CHANGELOG.md README.md
git commit -m "feat(rig-editor): refuse transformed layers in the browser path; correct nesting docs"
```

Body ends with the `Co-Authored-By:` trailer.

- [ ] **Step 11: Report back**

Your reviewer sees only what you write here. Include, verbatim:

1. The commit SHA.
2. The **four failure messages you observed in Step 2**, before any implementation. A test that passed at Step 2 is a test with no teeth — flag it rather than quietly proceeding.
3. The exact e2e total (`N passed`) and the final line of `check-all.ps1`.
4. The result of the Step 9 contract check.
5. Anything you changed that this plan did not specify, and why.

---

## Acceptance (verify before reporting the stage complete)

- For any input **that has at least one top-level `<g>`**, a nested untransformed layered SVG produces the same parts and the same element count through both `parseLayered` and `loadLayeredSvg` — `<clipPath>`/`<defs>` contents excluded from that count in both. Proven by the cross-path e2e, not by two suites agreeing on paper.
  - **Known, deliberate, out-of-scope divergence:** with *no* top-level `<g>` at all, the browser falls back to treating the whole `<svg>` as one implicit layer (`app.js:223`) while node yields zero elements and `startFromLayeredSvg` throws "no drawable shapes found". That asymmetry is intentional and predates this work — the browser is a drop target for arbitrary files and degrades gracefully; the node function is an API that should reject an input it cannot name parts from. Do not "fix" it here.
- A transformed layered SVG fails in both paths, naming the offending **authored layer names**, with a corrective action.
- Flat inputs behave identically to before; every golden is byte-unchanged.
- MCP tool count is 10; no root `package.json`; no new dependency; `tools/rig-editor/` imports nothing outside `node:` and its siblings.
- `tools/check-all.ps1` → `RESULT: PASS` (P1–P7).
- `tools/check-e2e.ps1` → **24 passed**.
