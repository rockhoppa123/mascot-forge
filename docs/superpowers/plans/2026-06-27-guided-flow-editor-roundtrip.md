# Guided Reactivity Tiers + Full-Fidelity Editor Round-Trip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the guided MCP flow hand a complete, *animating* rig to the browser editor and back, openable from a returned URL; add Simple/Standard/Signals reactivity tiers; stop silhouettes being carved into anatomically-wrong parts; and let the editor author states.

**Architecture:** The rig travels MCP→editor as a **self-describing layered SVG** — `data-*` attributes (`data-role`, `data-bone`, `data-pivot`, `data-preset-<state>`, root `data-states`) on the existing group-per-part SVG. One emitter (`editorHandoff`) writes them; the shared `parseLayered`/`toModel` loader reads them and rebuilds the live model, so the editor animates immediately and re-export round-trips. Tiers map to the existing `states` param; a poor input grade steers the guided flow to a single whole-body part. The editor model gains `addState`/`removeState` (authoring tool only; MCP/runtime keep declare-at-start).

**Tech Stack:** Node ESM (no build), `node:assert/strict` self-checks wired into `tools/check-all.ps1` (P5 rig-editor, P6 mcp), Playwright e2e (`tools/check-e2e.ps1`, separate from the node gate). Zero-dependency runtime/editor; `mcp/` has npm deps (already installed).

**Branch:** `feature/guided-flow-roundtrip` off `main`. Three phases, each independently mergeable and gate-green.

## Global Constraints

- Runtime artifact + browser editor stay **zero-dependency**; the editor stays offline-capable (any `?rig=` auto-load is optional; manual load still works). Pure ESM, no build step.
- **Additive:** the plain layered-SVG and segmented-SVG load paths keep working unchanged; `forge_*` tool returns may gain fields but remove none. The **10-tool MCP contract** (`mcp/protocol.test.mjs`) stays intact — no new tool.
- Whole-part **transform-only** motion; tests use **`node:assert/strict`, no framework**, mirroring existing `*.test.mjs`, wired into `tools/check-all.ps1`.
- **Back-compat:** goldens (`tools/rig-editor/exporter.test.mjs`), existing presets, and the buildable-slice checks MUST stay green. The MCP/runtime keep **declare-at-start** state vocab; only the **editor** model gains `addState`/`removeState`.
- After EVERY task the node gate must stay green: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`. Tasks touching the editor UI also run `pwsh -NoProfile -File tools/check-e2e.ps1`.
- Record per-task status (commit range + gate result) in `.superpowers/sdd/progress.md` as each task lands.

---

## File Structure

**Phase 1 — handoff fidelity + frictionless open:**
- `mcp/tools.mjs` (modify) — `editorHandoff` emits the self-describing rig; `forgeEmit`/`editorHandoff` return an `open` URL.
- `mcp/tools.test.mjs` (modify) — handoff attrs + round-trip assertions.
- `tools/rig-editor/layer-ingest.js` (modify) — `parseLayered`/`toModel` capture + apply `data-*` rig metadata.
- `tools/rig-editor/layer-ingest.test.mjs` (modify) — full-rig rebuild assertions.
- `tools/rig-editor/app.js` (modify) — `loadFile` detects a rig SVG; optional `?rig=` auto-load.
- `tools/serve.ps1` (create) + `mcp/package.json` (modify, npm script) — one-command static server.
- `tests/e2e/handoff-rig.spec.mjs` (create) — a handoff rig loads and animates.

**Phase 2 — tiers + grade-gating:**
- `tools/rig-editor/model.js` (modify) — `SIMPLE_STATES` export.
- `tools/rig-editor/model.test.mjs` (modify).
- `mcp/server.mjs` (modify) — `rigMascotPrompt` rewrite (tier question + silhouette→Simple).
- `mcp/server.test.mjs` (modify).
- `mcp/tools.mjs` (modify) — `forgePropose` advisory recommends whole-body Simple on a poor grade.
- `mcp/tools.test.mjs` (modify).

**Phase 3 — editor authors states:**
- `tools/rig-editor/model.js` (modify) — `addState`/`removeState`.
- `tools/rig-editor/model.test.mjs` (modify).
- `tools/rig-editor/app.js` + `tools/rig-editor/index.html` (modify) — add/remove-state controls.
- `tests/e2e/state-controls.spec.mjs` (modify) — add-state renders a new button + picker.

---

# PHASE 1 — Full-fidelity handoff + frictionless open

## Task 1: `editorHandoff` emits a self-describing rig SVG

**Files:**
- Modify: `mcp/tools.mjs` (`editorHandoff`, ~lines 249-264)
- Test: `mcp/tools.test.mjs`

**Interfaces:**
- Consumes: `model.parts()` → `{ [id]: { role, kind, bone, pivot:{x,y} } }`; `model.preset(state, id)`; `model.states()`; `model.rectsOf(id)`; `model.viewBox()`.
- Produces: `editorHandoff({ session, outDir })` → `{ svg, written, editor }` where `svg` carries root `data-states="a,b,c"` and each `<g>` has `data-role`, `data-bone` (if set), `data-pivot="x,y"` (if set), and `data-preset-<state>="name"` for each set preset.

- [ ] **Step 1: Write the failing test.** Append to `mcp/tools.test.mjs` (it already imports `startFromImage, assignRegion, setPart, editorHandoff`):

```javascript
// editorHandoff carries the FULL rig (roles/pivots/presets/states), not just geometry, so the editor animates
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6, states: ["idle", "active", "alert"] });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "hand-left", role: "limb" });
  setPart({ session: s.session, partId: "part-body", role: "core", presets: { idle: "breathe" } });
  setPart({ session: s.session, partId: "part-hand-left", role: "limb", presets: { active: "walk" } });
  const { svg } = editorHandoff({ session: s.session });
  assert.match(svg, /<svg[^>]*\bdata-states="idle,active,alert"/, "root carries the declared states");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-role="core"/, "body group carries its role");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-preset-idle="breathe"/, "body group carries its idle preset");
  assert.match(svg, /<g id="part-hand-left"[^>]*\bdata-preset-active="walk"/, "limb group carries its active preset");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-pivot="\d+(\.\d+)?,\d+(\.\d+)?"/, "body group carries its pivot");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node mcp/tools.test.mjs` (expect: no `data-states`/`data-role` in the emitted svg → assertion fails).

- [ ] **Step 3: Implement.** Replace `editorHandoff`'s body in `mcp/tools.mjs` (keep the signature + the `outDir`/return shape) so each group emits rig attrs:

```javascript
export function editorHandoff({ session, outDir } = {}) {
  const { model } = getSession(session);
  const states = model.states();
  const lines = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${model.viewBox()}" data-states="${states.join(",")}">`];
  for (const id of Object.keys(model.parts())) {
    const rs = model.rectsOf(id);
    if (!rs.length) continue;
    const meta = model.parts()[id];
    const attrs = [`id="${id}"`];
    if (meta.role) attrs.push(`data-role="${meta.role}"`);
    if (meta.bone) attrs.push(`data-bone="${meta.bone}"`);
    if (meta.pivot) attrs.push(`data-pivot="${meta.pivot.x},${meta.pivot.y}"`);
    for (const st of states) { const p = model.preset(st, id); if (p) attrs.push(`data-preset-${st}="${p}"`); }
    lines.push(`  <g ${attrs.join(" ")}>`);
    for (const r of rs) lines.push(r.markup ? `    ${r.markup}` : `    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.fill || "#888888"}"/>`);
    lines.push("  </g>");
  }
  lines.push("</svg>");
  const svg = lines.join("\n") + "\n";
  let written = null;
  if (outDir) { const dir = safePath(outDir); mkdirSync(dir, { recursive: true }); written = join(dir, "rig-handoff.svg"); writeFileSync(written, svg); }
  return { svg, written, editor: "tools/rig-editor/index.html" };
}
```

- [ ] **Step 4: Run, verify PASS** — `node mcp/tools.test.mjs && node mcp/protocol.test.mjs` (10-tool contract intact), then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): editorHandoff emits a self-describing rig (role/pivot/preset/states)"
```

## Task 2: loader rebuilds the full model from a self-describing SVG

**Files:**
- Modify: `tools/rig-editor/layer-ingest.js` (`parseLayered`, `toModel`)
- Test: `tools/rig-editor/layer-ingest.test.mjs`

**Interfaces:**
- Consumes: `editorHandoff`'s SVG format from Task 1.
- Produces: `parseLayered(svgText)` → `{ viewBox, elements, parts, states }` where `parts[id] = { role?, bone?, pivot?:{x,y}, presets?:{[state]:name} }` and `states` is the root `data-states` array (or `undefined`). `toModel(parsed)` builds a `createModel` with those `states` and applies role/bone/pivot/presets. Existing callers passing only `{viewBox, elements}` keep working (parts default `{}`, states `undefined`).

- [ ] **Step 1: Write the failing test.** Append to `tools/rig-editor/layer-ingest.test.mjs` (read its top for the `assert`/import style first):

```javascript
// a self-describing rig SVG (editorHandoff output) rebuilds a fully-animated model
{
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,loading">',
    '  <g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe">',
    '    <rect x="30" y="30" width="40" height="40" fill="#111"/>',
    '  </g>',
    '  <g id="part-arm" data-role="limb" data-bone="arm" data-preset-active="walk" data-preset-loading="spin">',
    '    <rect x="5" y="35" width="14" height="30" fill="#222"/>',
    '  </g>',
    '</svg>',
  ].join("\n");
  const parsed = parseLayered(svg);
  assert.deepEqual(parsed.states, ["idle", "active", "loading"], "root data-states parsed");
  assert.equal(parsed.parts["part-body"].role, "core");
  assert.deepEqual(parsed.parts["part-body"].pivot, { x: 50, y: 50 });
  assert.equal(parsed.parts["part-body"].presets.idle, "breathe");
  assert.equal(parsed.parts["part-arm"].presets.loading, "spin");
  const m = toModel(parsed);
  assert.deepEqual(m.states(), ["idle", "active", "loading"], "model built with the declared vocabulary");
  assert.equal(m.parts()["part-body"].role, "core", "role applied");
  assert.equal(m.preset("idle", "part-body"), "breathe", "preset applied");
  assert.equal(m.preset("loading", "part-arm"), "spin", "signal-state preset applied");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/layer-ingest.test.mjs` (expect: `parsed.states` undefined / `parts[*].role` undefined).

- [ ] **Step 3: Implement.** In `tools/rig-editor/layer-ingest.js`:

(a) In `parseLayered`, read the root `data-states` and per-group rig attrs. Replace the function body's setup + the group loop so it also builds a `parts` map. Add after `const viewBox = …`:

```javascript
  const statesAttr = svgOpen && attr(svgOpen[0], "data-states");
  const states = statesAttr ? statesAttr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const partsMeta = {};
```

Inside the `while ((g = GROUP_RE.exec(svgText)) !== null)` loop, after `const part = sanitizeId(name, used);`, capture the rig metadata from `gAttrs`:

```javascript
    const meta = partsMeta[part] || (partsMeta[part] = {});
    const role = attr(gAttrs, "data-role"); if (role) meta.role = role;
    const bone = attr(gAttrs, "data-bone"); if (bone) meta.bone = bone;
    const piv = attr(gAttrs, "data-pivot");
    if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const pm of gAttrs.matchAll(/\bdata-preset-([a-z]+)="([^"]*)"/g)) { (meta.presets || (meta.presets = {}))[pm[1]] = pm[2]; }
```

Change the final `return { viewBox, elements };` to `return { viewBox, elements, parts: partsMeta, states };`.

(b) Replace `toModel` so it honours states + applies metadata:

```javascript
export function toModel({ viewBox, elements, parts: meta = {}, states } = {}) {
  const parts = {};
  for (const el of elements) parts[el.part] = parts[el.part] || {};
  const model = createModel({ viewBox, rects: elements, parts, ...(states ? { states } : {}) });
  for (const [id, m] of Object.entries(meta)) {
    if (!(id in parts)) continue;
    if (m.role) model.setRole(id, m.role);
    if (m.bone) model.setBone(id, m.bone);
    if (m.pivot) model.setPivot(id, m.pivot);
    if (m.presets) for (const [st, name] of Object.entries(m.presets)) if (model.states().includes(st)) model.setPreset(st, id, name);
  }
  return model;
}
```

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/layer-ingest.test.mjs && node tools/rig-editor/exporter.test.mjs` (goldens unaffected — existing callers pass no `parts`/`states`), then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-editor/layer-ingest.js tools/rig-editor/layer-ingest.test.mjs
git commit -m "feat(editor): parseLayered/toModel rebuild a full rig from data-* attrs"
```

## Task 3: browser loader detects a rig SVG; `?rig=` auto-load; editor animates

**Files:**
- Modify: `tools/rig-editor/app.js` (`loadLayeredSvg` ~186-213, `loadFile` ~637, startup)
- Modify: `tools/rig-editor/index.html` (only if a new element is needed — none expected)
- Test: `tests/e2e/handoff-rig.spec.mjs` (create)

**Interfaces:**
- Consumes: a self-describing rig SVG (Task 1 format); `window.__rigEditor.loadLayeredSvg(text, name)`.
- Produces: loading a rig SVG rebuilds the animated model (roles/pivots/presets/states applied), so `#rigstatus` shows animated states (not `0/N`). On startup, `?rig=<project-relative-path>` fetches + loads that SVG.

- [ ] **Step 1: Write the failing test.** Create `tests/e2e/handoff-rig.spec.mjs` (read `tests/e2e/state-controls.spec.mjs` first for the harness + `window.__rigEditor` pattern):

```javascript
import { test, expect } from "@playwright/test";

const URL = "/tools/rig-editor/index.html";

// a self-describing handoff rig loads with its motion intact and animates (not 0/N)
test("handoff rig loads animated", async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,alert">',
      '  <g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe"><rect x="30" y="30" width="40" height="40" fill="#26a69a"/></g>',
      '  <g id="part-arm" data-role="limb" data-preset-active="walk"><rect x="5" y="35" width="14" height="30" fill="#214078"/></g>',
      '</svg>',
    ].join("\n");
    window.__rigEditor.loadLayeredSvg(svg, "handoff");
  });
  // the body's idle preset survived the load -> the rig animates, not 0/N
  await expect(page.locator("#rigstatus")).toContainText("idle");
  const idleBreathe = await page.evaluate(() => window.__rigEditor.model.preset("idle", "part-body"));
  expect(idleBreathe).toBe("breathe");
});
```

- [ ] **Step 2: Run, verify FAIL** — `pwsh -NoProfile -File tools/check-e2e.ps1 handoff-rig` (expect FAIL: the browser `loadLayeredSvg` builds the model via DOMParser without applying `data-*`, so `preset("idle","part-body")` is null).

- [ ] **Step 3: Implement.** In `tools/rig-editor/app.js`, make the browser `loadLayeredSvg` capture the same rig metadata and pass it to `toModel`. Read the current `loadLayeredSvg` (lines 186-213) first. After it builds `elements` and before `model = toModel({ viewBox, elements });`, gather metadata from the parsed DOM and the root, then pass them through:

```javascript
  // self-describing handoff rig: carry role/bone/pivot/preset-* + root states into the model
  const rootStates = doc.documentElement.getAttribute("data-states");
  const states = rootStates ? rootStates.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const partsMeta = {};
  for (const g of doc.querySelectorAll("svg > g[id]")) {
    const id = sanitizeId(g.getAttribute("id"));
    const meta = partsMeta[id] || (partsMeta[id] = {});
    const role = g.getAttribute("data-role"); if (role) meta.role = role;
    const bone = g.getAttribute("data-bone"); if (bone) meta.bone = bone;
    const piv = g.getAttribute("data-pivot"); if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const a of g.getAttributeNames()) if (a.startsWith("data-preset-")) (meta.presets || (meta.presets = {}))[a.slice("data-preset-".length)] = g.getAttribute(a);
  }
  model = toModel({ viewBox, elements, parts: partsMeta, states });
```

Replace the existing `model = toModel({ viewBox, elements });` line with the block above. (`sanitizeId` is already imported at app.js:17.)

Then add `?rig=` auto-load at startup. Near the bottom of `app.js` (after `window.__rigEditor = …`), add:

```javascript
// auto-load a handoff rig passed by forge_open_editor: ?rig=<project-relative path>
const rigParam = new URLSearchParams(location.search).get("rig");
if (rigParam) fetch("/" + rigParam.replace(/^\/+/, "")).then((r) => r.ok ? r.text() : Promise.reject(new Error("rig not found"))).then((t) => loadLayeredSvg(t, rigParam.split("/").pop())).catch((e) => status("✗ " + e.message));
```

- [ ] **Step 4: Run, verify PASS** — `pwsh -NoProfile -File tools/check-e2e.ps1 && pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-editor/app.js tests/e2e/handoff-rig.spec.mjs
git commit -m "feat(editor): load a self-describing rig (animated) + ?rig= auto-load"
```

## Task 4: frictionless open — returned URL + one-command server

**Files:**
- Create: `tools/serve.ps1`
- Modify: `mcp/tools.mjs` (`forgeEmit`, `editorHandoff` returns)
- Modify: `mcp/server.mjs` (`forge_emit`/`forge_open_editor` tool descriptions)
- Test: `mcp/tools.test.mjs`

**Interfaces:**
- Consumes: an `MF_SERVE_PORT` env var (optional; default `4178` to match the editor's in-page hint at `index.html:115`).
- Produces: `forgeEmit(...)` and `editorHandoff(...)` returns gain an `open` string. For emit with `outDir`: `open` is the demo URL `http://localhost:<port>/<relpath>/<asset>-mascot-demo.html`. For `editorHandoff` with `outDir`: `open` is `http://localhost:<port>/tools/rig-editor/index.html?rig=<relpath>/rig-handoff.svg`. Paths are relative to the repo root (`PROJECT_ROOT`).

- [ ] **Step 1: Write the failing test.** Append to `mcp/tools.test.mjs`:

```javascript
// emit + handoff return a copy-pasteable open URL (frictionless open)
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const e = forgeEmit({ session: s.session, assetName: "blip", outDir: "out/_test_open" });
  assert.match(e.open, /^http:\/\/localhost:\d+\/out\/_test_open\/blip-mascot-demo\.html$/, "emit returns a demo URL");
  const h = editorHandoff({ session: s.session, outDir: "out/_test_open" });
  assert.match(h.open, /^http:\/\/localhost:\d+\/tools\/rig-editor\/index\.html\?rig=out\/_test_open\/rig-handoff\.svg$/, "handoff returns an editor URL with ?rig=");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node mcp/tools.test.mjs` (expect: `e.open`/`h.open` undefined).

- [ ] **Step 3: Implement.**

(a) In `mcp/tools.mjs`, add a helper near `PROJECT_ROOT` (top of file):

```javascript
const SERVE_PORT = process.env.MF_SERVE_PORT || "4178";
// turn an absolute path under the repo into a localhost URL the bundled server serves
function servedUrl(absPath, suffix = "") {
  const rel = absPath.slice(PROJECT_ROOT.length + 1).replace(/\\/g, "/");
  return `http://localhost:${SERVE_PORT}/${rel}${suffix}`;
}
```

In `forgeEmit`, in the `outDir` branch, compute the demo path and add `open`:

```javascript
    const demoPath = join(dir, `${assetName}-mascot-demo.html`);
    return { ok: true, validation: v, ...advisory, written: files.map(([f]) => f), open: servedUrl(demoPath) };
```

In `editorHandoff`, when `written` is set, add `open`:

```javascript
  return { svg, written, editor: "tools/rig-editor/index.html", open: written ? servedUrl(join(safePath(outDir), "rig-handoff.svg")) : null };
```

(b) Create `tools/serve.ps1`:

```powershell
# serve.ps1 — static HTTP server from the repo root so the editor (ES modules) and emitted demos load
# over http (file:// blocks modules/fetch). Port defaults to 4178; override with -Port. Ctrl+C to stop.
param([int]$Port = 4178)
$root = Split-Path $PSScriptRoot -Parent
Write-Host "serving $root at http://localhost:$Port/  (Ctrl+C to stop)"
python -m http.server $Port --directory $root
```

(c) In `mcp/server.mjs`, extend the `forge_emit` and `forge_open_editor` tool descriptions to mention the returned `open` URL and that `tools/serve.ps1` (default port 4178) must be running to open it. (Find them via the `registerTool("forge_emit"` / `registerTool("forge_open_editor"` / editorHandoff wiring; append one sentence to each `description` string. No schema change.)

- [ ] **Step 4: Run, verify PASS** — `node mcp/tools.test.mjs && node mcp/server.test.mjs && node mcp/protocol.test.mjs`, then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`. Clean up the test output dir: `Remove-Item -Recurse -Force out/_test_open`.

- [ ] **Step 5: Commit**

```bash
git add mcp/tools.mjs mcp/server.mjs mcp/tools.test.mjs tools/serve.ps1
git commit -m "feat(mcp): return an open URL for demo + editor; add tools/serve.ps1"
```

**PHASE 1 GATE:** `tools/check-all.ps1` → PASS and `tools/check-e2e.ps1` green. Phase 1 is independently mergeable.

---

# PHASE 2 — Reactivity tiers + grade-gated carving

## Task 5: `SIMPLE_STATES` export + Simple tier vocabulary

**Files:**
- Modify: `tools/rig-editor/model.js` (the state-vocab exports, ~lines 11-17)
- Test: `tools/rig-editor/model.test.mjs`

**Interfaces:**
- Consumes: existing `STANDARD_STATES`, `SIGNAL_STATES`.
- Produces: `export const SIMPLE_STATES = ["idle"]` from `model.js`. `createModel({ states: SIMPLE_STATES })` yields a one-state model.

- [ ] **Step 1: Write the failing test.** Append to `tools/rig-editor/model.test.mjs`:

```javascript
{ // Simple tier: a single resting state, no state machine
  const m = createModel({ viewBox: "0 0 10 10", rects: [{ id: "r0", x: 0, y: 0, w: 10, h: 10, fill: "#000", part: "part-a" }], parts: { "part-a": { role: "core" } }, states: SIMPLE_STATES });
  assert.deepEqual(m.states(), ["idle"], "Simple tier declares only idle");
  assert.deepEqual(SIMPLE_STATES, ["idle"]);
}
```

Add `SIMPLE_STATES` to the `model.js` import at the top of `model.test.mjs` (read the import line and extend it).

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/model.test.mjs` (expect: `SIMPLE_STATES` is not exported → import is `undefined`).

- [ ] **Step 3: Implement.** In `tools/rig-editor/model.js`, beside `STANDARD_STATES`/`SIGNAL_STATES`:

```javascript
export const SIMPLE_STATES = ["idle"]; // Simple tier: one looping animation, no state machine
```

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/model.test.mjs`, then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-editor/model.js tools/rig-editor/model.test.mjs
git commit -m "feat(editor): SIMPLE_STATES export for the Simple reactivity tier"
```

## Task 6: `rig_mascot` tier question + silhouette→Simple steer; propose advisory

**Files:**
- Modify: `mcp/server.mjs` (`rigMascotPrompt`)
- Modify: `mcp/tools.mjs` (`forgePropose` advisory on a poor grade)
- Test: `mcp/server.test.mjs`, `mcp/tools.test.mjs`

**Interfaces:**
- Consumes: `gradeInput(model).grade` ∈ `{good, borderline, silhouette}` (already returned by `forgePropose` as part of the advisory path); `forge_start_from_image`'s `states` param; the tier→states mapping (Simple→`["idle"]`, Standard→`["idle","active","alert"]`, Signals→+`loading,error,success`).
- Produces: `rigMascotPrompt(...)` text scripts a tier question and a silhouette→Simple steer; `forgePropose(...)` returns `advisory` with a whole-body Simple recommendation when grade is `silhouette` (so the agent doesn't carve fake parts).

- [ ] **Step 1: Write the failing tests.**

(a) Append to `mcp/server.test.mjs` (it imports `rigMascotPrompt`):

```javascript
const tt = rigMascotPrompt({ image: "pip.png" }).messages[0].content.text;
assert.match(tt, /Simple|Standard|Signals/, "prompt offers reactivity tiers");
assert.match(tt, /silhouette/i, "prompt steers silhouettes to whole-body");
```

(b) Append to `mcp/tools.test.mjs` (asserts the silhouette advisory recommends a single whole-body part). The existing monochrome fixture trips the silhouette grade:

```javascript
{ // a silhouette is steered to whole-body Simple, not carved into fake parts
  const W = 40, mono = new (await import("pngjs")).PNG({ width: W, height: W });
  for (let i = 0; i < mono.data.length; i += 4) { mono.data[i] = 60; mono.data[i + 1] = 60; mono.data[i + 2] = 60; mono.data[i + 3] = 255; }
  const sm = startFromImage({ base64: (await import("pngjs")).PNG.sync.write(mono).toString("base64"), colors: 4 });
  const prop = forgePropose({ session: sm.session });
  assert.match(prop.advisory || "", /whole-body|one part|Simple/i, "silhouette advisory recommends whole-body Simple");
}
```

(Note: `PNG` is already imported at the top of `tools.test.mjs` — use that import directly rather than the dynamic import above if simpler; the dynamic form avoids assuming. Prefer the existing top-level `PNG` import: `new PNG({width:W,height:W})` and `PNG.sync.write(mono)`.)

- [ ] **Step 2: Run, verify FAIL** — `node mcp/server.test.mjs` and `node mcp/tools.test.mjs` (expect: prompt lacks tier text; advisory lacks the whole-body recommendation).

- [ ] **Step 3: Implement.**

(a) In `mcp/tools.mjs` `forgePropose`, strengthen the advisory on a silhouette grade. Current line: `const advisory = grade.grade === "silhouette" ? grade.recommendation : null;` — change to append a whole-body Simple steer:

```javascript
  const advisory = grade.grade === "silhouette"
    ? `${grade.recommendation} For now, rig it as ONE whole-body part (Simple tier: a single 'idle' with breathe/sway) rather than carving fake limbs from a single-colour shape.`
    : null;
```

(b) In `mcp/server.mjs` `rigMascotPrompt`, rewrite **Step 0** to ask the tier (replacing the signal-states-only question), and add the silhouette steer to the grade step. Change the Step 0 text to:

```
"0. FIRST ask me how reactive this mascot should be — pick a TIER:\n" +
"   • Simple — one looping animation, no app states, no JS (states: [\"idle\"]).\n" +
"   • Standard — reacts idle/active/alert to your data (states: [\"idle\",\"active\",\"alert\"]).\n" +
"   • Signals — Standard plus loading/error/success (the universal dashboard signals).\n" +
"   Pass the matching `states` to forge_start_from_image. The vocabulary is fixed at start.\n" +
```

And extend the grade step (Step 1) with the silhouette rule:

```
" If it grades 'silhouette' (or borderline), do NOT carve limbs — rig it as ONE whole-body part on the Simple tier (a gentle breathe/sway) and tell me a layered/multi-colour source is needed for separable parts.\n" +
```

- [ ] **Step 4: Run, verify PASS** — `node mcp/server.test.mjs && node mcp/tools.test.mjs && node mcp/protocol.test.mjs`, then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add mcp/server.mjs mcp/tools.mjs mcp/server.test.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): rig_mascot reactivity tiers + silhouette->whole-body steer"
```

**PHASE 2 GATE:** `tools/check-all.ps1` → PASS. Independently mergeable.

---

# PHASE 3 — Editor authors states

## Task 7: model `addState` / `removeState`

**Files:**
- Modify: `tools/rig-editor/model.js` (the `createModel` closure — `states`, `selections`, returned API ~line 128/145)
- Test: `tools/rig-editor/model.test.mjs`

**Interfaces:**
- Consumes: the model's internal `states` array + `selections` map.
- Produces: `model.addState(name)` appends a state (no-op if present) and initialises `selections[name] = {}`; `model.removeState(name)` removes it and its selections; `idle` (`states[0]`) cannot be removed (throws). Both are exposed on the returned object alongside `states()`.

- [ ] **Step 1: Write the failing test.** Append to `tools/rig-editor/model.test.mjs`:

```javascript
{ // editor authoring: states can be added/removed (idle is mandatory)
  const m = createModel({ viewBox: "0 0 10 10", rects: [{ id: "r0", x: 0, y: 0, w: 10, h: 10, fill: "#000", part: "part-a" }], parts: { "part-a": { role: "limb" } }, states: ["idle", "active", "alert"] });
  m.addState("loading");
  assert.deepEqual(m.states(), ["idle", "active", "alert", "loading"], "addState appends");
  m.setPreset("loading", "part-a", "spin");
  assert.equal(m.preset("loading", "part-a"), "spin", "preset works on the new state");
  m.removeState("loading");
  assert.ok(!m.states().includes("loading"), "removeState drops it");
  assert.throws(() => m.removeState("idle"), /idle|resting/, "idle cannot be removed");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/model.test.mjs` (expect: `m.addState is not a function`).

- [ ] **Step 3: Implement.** In `tools/rig-editor/model.js`, inside `createModel` (where `states` and `selections` are in scope), add two closures and expose them. Add before the `return { … }`:

```javascript
  function addState(name) { if (!states.includes(name)) { states.push(name); selections[name] = selections[name] || {}; } }
  function removeState(name) {
    if (name === states[0]) throw new Error(`cannot remove the resting state '${states[0]}'`);
    const i = states.indexOf(name); if (i >= 0) states.splice(i, 1);
    delete selections[name];
  }
```

Add `addState, removeState,` to the returned object (beside `states: () => states.slice(),`).

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/model.test.mjs && node tools/rig-editor/exporter.test.mjs`, then `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-editor/model.js tools/rig-editor/model.test.mjs
git commit -m "feat(editor): model addState/removeState (idle non-removable)"
```

## Task 8: editor add/remove-state controls

**Files:**
- Modify: `tools/rig-editor/index.html` (the `#states-row` area / a new `#addstate` control)
- Modify: `tools/rig-editor/app.js` (`renderStateControls`)
- Test: `tests/e2e/state-controls.spec.mjs` (extend)

**Interfaces:**
- Consumes: `model.addState`/`removeState` (Task 7); `SIGNAL_STATES`/`STANDARD_STATES`; `renderStateControls()` (renders from `model.states()`).
- Produces: an "+ add state" control offering the undeclared standard/signal states; selecting one calls `model.addState`, re-renders, and shows its button + preset picker. A remove affordance on non-`idle` state buttons.

- [ ] **Step 1: Write the failing test.** Append to `tests/e2e/state-controls.spec.mjs`:

```javascript
test("editor can add a signal state", async ({ page }) => {
  await loadEditorWithStates(page, ["idle", "active", "alert"]); // existing helper
  await expect(page.locator("#states-row button", { hasText: "loading" })).toHaveCount(0);
  await page.selectOption("#addstate", "loading");
  await expect(page.locator("#states-row button", { hasText: "loading" })).toHaveCount(1);
  await expect(page.locator("#preset-pickers #preset-loading")).toHaveCount(1);
});
```

- [ ] **Step 2: Run, verify FAIL** — `pwsh -NoProfile -File tools/check-e2e.ps1 state-controls` (expect FAIL: `#addstate` does not exist).

- [ ] **Step 3: Implement.**

(a) In `tools/rig-editor/index.html`, add an add-state control inside the `#states` row, after `#states-row`:

```html
        <select id="addstate" title="add an app-signal state"><option value="">+ add state</option></select>
```

(b) In `tools/rig-editor/app.js`, import the vocab lists (extend the existing `model.js` import to include `STANDARD_STATES, SIGNAL_STATES`). In `renderStateControls()`, after rendering buttons/pickers, populate `#addstate` with the undeclared states and wire add/remove:

```javascript
  const addable = [...STANDARD_STATES, ...SIGNAL_STATES].filter((s) => !model.states().includes(s));
  const addSel = $("addstate");
  addSel.replaceChildren(new Option("+ add state", ""));
  for (const s of addable) addSel.appendChild(new Option(s, s));
  addSel.onchange = (e) => { const s = e.target.value; if (s) { pushUndo(); model.addState(s); renderStateControls(); regenCss(); } };
```

And make each non-`idle` state button removable — in the button-creation loop, add a small remove handler (e.g. shift-click or a `×` affordance). Minimal version: append a `×` button per non-idle state:

```javascript
  for (const s of model.states()) {
    const b = document.createElement("button");
    b.dataset.state = s; b.textContent = s;
    row.appendChild(b);
    if (s !== model.states()[0]) {
      const x = document.createElement("button");
      x.className = "rmstate"; x.dataset.rmstate = s; x.textContent = "×"; x.title = `remove ${s}`;
      row.appendChild(x);
    }
  }
```

Wire removal via the existing `#states` delegated click handler (app.js:558) — add at its top:

```javascript
  const rm = e.target.closest("button[data-rmstate]");
  if (rm) { pushUndo(); model.removeState(rm.dataset.rmstate); renderStateControls(); regenCss(); return; }
```

- [ ] **Step 4: Run, verify PASS** — `pwsh -NoProfile -File tools/check-e2e.ps1 && pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1`.

- [ ] **Step 5: Commit**

```bash
git add tools/rig-editor/index.html tools/rig-editor/app.js tests/e2e/state-controls.spec.mjs
git commit -m "feat(editor): add/remove app-signal states in the editor"
```

**PHASE 3 GATE:** `tools/check-all.ps1` → PASS and `tools/check-e2e.ps1` green.

---

## Self-Review

**Spec coverage:** Issue #1 dead-editor → Tasks 1-3 (handoff carries motion, loader rebuilds it, browser animates). Issue #2 manual-open → Task 4 (returned URL + serve script + `?rig=` from Task 3). Issue #3 states → Tasks 5-6 (tiers reach signal states) + 7-8 (editor authors them) + Task 2 (handoff carries states). Issue #4 overkill → Task 5 (Simple tier) + Task 6 (tier question). Issue #5 ghost → Task 6 (silhouette→whole-body steer + advisory). ✓

**Placeholder scan:** every code step carries complete code; the one prose step (Task 4c, server.mjs descriptions) names the exact tool registrations to find and the one sentence to add. No TBD/TODO.

**Type consistency:** `toModel({viewBox, elements, parts, states})` — the `parts` metadata shape `{role,bone,pivot,presets}` is produced by `parseLayered` (Task 2) and the browser path (Task 3) and consumed by `toModel` identically. `data-preset-<state>` attr name is written by Task 1 and read by Tasks 2 + 3. `SIMPLE_STATES`/`STANDARD_STATES`/`SIGNAL_STATES` defined in model.js, consumed by Tasks 6 + 8. `addState`/`removeState` defined in Task 7, used in Task 8. `servedUrl`/`SERVE_PORT` defined and used within Task 4.

**Open risks:**
- Task 3 de-hardcodes nothing but changes the browser load path — the existing layered/segmented load e2e are the regression guard (run the full `check-e2e` in Step 4).
- Task 6's silhouette advisory text is asserted loosely (`/whole-body|one part|Simple/i`) so wording can evolve without breaking the test.
- The editor model gaining `addState`/`removeState` (Task 7) does not touch the MCP/runtime — declare-at-start stays true there (verified by `protocol.test` + `model.test` existing assertions staying green).
