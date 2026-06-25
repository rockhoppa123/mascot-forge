# Expanded States, Subject-Aware Animation, First-Impression & Reach — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mascot-forge usable and impressive for an agnostic user — grade input up front, ship a
self-contained showcase, open + expand the animation/state system with subject-aware motion, and add a
browser drop-zone + gallery.

**Architecture:** Pure ESM modules under `tools/rig-editor/` are the single source of truth used by both
the browser editor and the MCP (`mcp/`). New motion is added as kind-keyed preset families; states
become open (the runtime already binds arbitrary states); input grading is a shared pure helper. Each
phase is independently shippable.

**Tech Stack:** Node ESM (no build), `node:assert` self-checks wired into `tools/check-all.ps1`,
Playwright e2e for the browser drop-zone, `@neplex/vectorizer` (already installed, mcp/ only).

## Global Constraints

- The **runtime artifact stays zero-dependency**; new deps only in `mcp/`. Pure ESM, runs under `node`.
- **No ML, no path-splitting, no mesh deformation** (whole-part CSS-transform animation only).
- Tests use **`node:assert/strict`, no framework**, mirror existing `*.test.mjs`, and are wired into
  `tools/check-all.ps1` (P5 for `tools/rig-editor/`, P6 for `mcp/`).
- **Back-compat:** existing role-keyed presets and the golden round-trip (`exporter.test.mjs`,
  buildable-slice) MUST stay green. New `kind` is an overlay, not a replacement.
- Demos must open on **`file://`** (inline SVG/CSS, no `fetch`).
- Match the existing terse top-of-file comment style.
- Default states stay `["idle","active","alert"]` unless a rig declares otherwise.

---

## File Structure

- `tools/rig-editor/grade.js` (new) — `gradeInput(model)` pure heuristic. (P1a)
- `tools/rig-editor/grade.test.mjs` (new).
- `tools/rig-editor/emit.js` (modify) — `emitShowcaseHtml` self-contained product demo. (P1b)
- `tools/rig-editor/presets.js` (modify) — kind-keyed preset families incl. `wheel→spin`. (P2a)
- `tools/rig-editor/model.js` (modify) — part `kind`; declared `states`. (P2a/2b)
- `tools/rig-editor/validator.js` (modify) — arbitrary states, warn-not-fail. (P2b)
- `mcp/tools.mjs` + `mcp/server.mjs` (modify) — `inputGrade` on start; `kind`/`states`. (P1a/2a/2b)
- `tools/rig-editor/drop.html` (new) + `mcp/tools.test.mjs`/Playwright — drop-zone. (P3a)
- `docs/gallery/README.md` (new) — example-input gallery + binding example. (P2c/3b)
- `tools/check-all.ps1` (modify) — wire new node suites.

---

# PHASE 1 — First impression

## Task 1: `gradeInput` pure heuristic

**Files:** Create `tools/rig-editor/grade.js`, `tools/rig-editor/grade.test.mjs`.

**Interfaces:**
- Produces: `export function gradeInput(model)` → `{ grade: "good"|"borderline"|"silhouette", reason, recommendation }`. Reads `model.rects()` (each `{x,y,w,h,fill}`).

- [ ] **Step 1: Write the failing test** (`grade.test.mjs`):

```javascript
import assert from "node:assert/strict";
import { createModel } from "./model.js";
import { gradeInput } from "./grade.js";

const mk = (rects) => createModel({ viewBox: "0 0 100 100", rects: rects.map((r, i) => ({ id: `r${i}`, ...r })) });

// monochrome (1 fill) -> silhouette
assert.equal(gradeInput(mk([{ x: 0, y: 0, w: 100, h: 100, fill: "#333" }])).grade, "silhouette");
// one element dominates (>0.8 area) even with 3 fills -> silhouette
assert.equal(gradeInput(mk([
  { x: 0, y: 0, w: 100, h: 95, fill: "#111" }, { x: 0, y: 95, w: 3, h: 5, fill: "#222" }, { x: 5, y: 95, w: 3, h: 5, fill: "#333" },
])).grade, "silhouette");
// 4+ balanced fills -> good
assert.equal(gradeInput(mk([
  { x: 0, y: 0, w: 25, h: 50, fill: "#a11" }, { x: 25, y: 0, w: 25, h: 50, fill: "#1a1" },
  { x: 50, y: 0, w: 25, h: 50, fill: "#11a" }, { x: 75, y: 0, w: 25, h: 50, fill: "#aa1" },
])).grade, "good");
// every verdict carries reason + recommendation strings
const g = gradeInput(mk([{ x: 0, y: 0, w: 10, h: 10, fill: "#000" }]));
assert.ok(g.reason && g.recommendation, "grade carries reason + recommendation");
console.log("grade.test.mjs: all assertions passed.");
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/grade.test.mjs` (module not found).

- [ ] **Step 3: Implement** (`grade.js`):

```javascript
// grade.js — pre-flight input quality grade. Pure, dependency-free. A flat single-colour silhouette is
// the worst-case rigging input (can't auto-separate parts); a colour-distinct image rigs cleanly.
// Heuristic: distinct opaque fills + dominant-element area share. Shared by the MCP start + propose.
export function gradeInput(model) {
  const rects = model.rects();
  const fills = new Set(rects.map((r) => r.fill).filter(Boolean));
  const total = rects.reduce((a, r) => a + r.w * r.h, 0) || 1;
  const maxShare = rects.reduce((m, r) => Math.max(m, (r.w * r.h) / total), 0);
  if (fills.size <= 2 || maxShare > 0.8) {
    return {
      grade: "silhouette",
      reason: `flat ${fills.size}-colour shape; one region is ${(maxShare * 100).toFixed(0)}% of the art`,
      recommendation: "parts can't be auto-separated — use a layered or multi-colour source, or it will animate as one body",
    };
  }
  if (fills.size >= 4 && maxShare <= 0.8) {
    return { grade: "good", reason: `${fills.size} distinct colours, no single dominant region`, recommendation: "rig away — use the vtracer engine for smooth, small output" };
  }
  return { grade: "borderline", reason: `${fills.size} colours, largest region ${(maxShare * 100).toFixed(0)}%`, recommendation: "riggable but parts may be coarse; a more colour-distinct source rigs better" };
}
```

- [ ] **Step 4: Run, verify PASS.** Then add `"grade"` to the P5 `foreach` list in `tools/check-all.ps1`.

- [ ] **Step 5: Commit** — `git add tools/rig-editor/grade.js tools/rig-editor/grade.test.mjs tools/check-all.ps1 && git commit -m "feat: gradeInput pre-flight input-quality heuristic"`

## Task 2: surface `inputGrade` from start + reuse in propose

**Files:** Modify `mcp/tools.mjs` (`startFromImage`, `forgePropose`), `mcp/server.mjs` (tool description), `mcp/tools.test.mjs`.

**Interfaces:**
- Consumes: `gradeInput` (Task 1).
- Produces: `startFromImage(...)` return gains `inputGrade` (the `gradeInput` result). `forgePropose` reuses `gradeInput` for its `advisory` (single source of truth — replace the inline `fills.size<=2` check).

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```javascript
// input grade is surfaced at start, from the shared heuristic
{
  const mono = new PNG({ width: 30, height: 30 });
  for (let i = 0; i < mono.data.length; i += 4) { mono.data[i] = 50; mono.data[i + 1] = 50; mono.data[i + 2] = 50; mono.data[i + 3] = 255; }
  const sg = startFromImage({ base64: PNG.sync.write(mono).toString("base64"), colors: 4 });
  assert.equal(sg.inputGrade.grade, "silhouette", "monochrome start is graded silhouette");
  assert.ok(sg.inputGrade.recommendation, "grade carries a recommendation");
  const cg = startFromImage({ base64: blocksPngBase64(), colors: 4 });
  assert.ok(["good", "borderline"].includes(cg.inputGrade.grade), "multi-colour start is not a silhouette");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node mcp/tools.test.mjs`.

- [ ] **Step 3: Implement.** In `mcp/tools.mjs`: `import { gradeInput } from "../tools/rig-editor/grade.js";`. In `startFromImage`, before the `return`, compute `const inputGrade = gradeInput(model);` and add `inputGrade` to the returned object. In `forgePropose`, replace the inline `fills`/`advisory` computation with: `const grade = gradeInput(s.model); const advisory = grade.grade === "silhouette" ? grade.recommendation : null;`. In `mcp/server.mjs`, append to the `forge_start_from_image` description: `" Returns inputGrade {grade,reason,recommendation} — tell the user the grade BEFORE rigging; on 'silhouette', suggest a layered/multi-colour source."`

- [ ] **Step 4: Run, verify PASS** (`node mcp/tools.test.mjs`); run `node mcp/protocol.test.mjs` (unchanged tool count still 10).

- [ ] **Step 5: Commit** — `git add mcp/tools.mjs mcp/server.mjs mcp/tools.test.mjs && git commit -m "feat(mcp): surface inputGrade at start; propose reuses the shared grade"`

## Task 3: self-contained showcase HTML

**Files:** Modify `tools/rig-editor/emit.js`, `tools/rig-editor/emit.test.mjs`.

**Interfaces:**
- Produces: `export function emitShowcaseHtml(rig, animatedSvg, assetName, sourceDataUri)` → HTML string: inlined SVG (no `fetch`), original side-by-side, per-state buttons, a Play/Pause auto-cycle that advances `rig.states` on a timer, and a Download-SVG anchor (`data:image/svg+xml;base64,...`). `forgeEmit` calls it instead of `emitDemoHtml` (keep `emitDemoHtml` exported for back-compat).

- [ ] **Step 1: Write the failing test** — append to `tools/rig-editor/emit.test.mjs` (read it first for the existing `rig`/`animatedSvg` fixtures):

```javascript
{
  const html = emitShowcaseHtml(rig, animatedSvg, "demo", "data:image/png;base64,AAAA");
  assert.ok(!/fetch\(/.test(html), "showcase inlines everything — no fetch (file:// safe)");
  assert.ok(html.includes("data:image/png;base64,AAAA"), "shows the original image");
  assert.ok(/id="play"/.test(html), "has an auto-cycle play control");
  assert.ok(/download="/.test(html) && /data:image\/svg\+xml/.test(html), "has a download-SVG link");
  for (const s of rig.states) assert.ok(html.includes(`data-s="${s}"`), `has a ${s} button`);
}
```
(Add `emitShowcaseHtml` to the import in `emit.test.mjs`.)

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/emit.test.mjs`.

- [ ] **Step 3: Implement** `emitShowcaseHtml` in `emit.js` — inline the `animatedSvg` (strip XML prolog), render an `<img>` of `sourceDataUri`, state buttons (`data-s`), a `#play` toggle whose script does `setInterval` cycling `data-state` across the states, and a download anchor whose `href` is `data:image/svg+xml;base64,${btoa(animatedSvg)}` (use a Node-safe base64: `Buffer.from(animatedSvg).toString("base64")`). Wire `forgeEmit` (in `mcp/tools.mjs`) to emit the showcase as the demo file. Keep styles inline. Honor `prefers-reduced-motion`.

- [ ] **Step 4: Run, verify PASS.** Regenerate a demo (`node scripts/regen-cat.mjs scanline`) and confirm `output/*-demo.html` has no `fetch(`.

- [ ] **Step 5: Commit** — `git add tools/rig-editor/emit.js tools/rig-editor/emit.test.mjs mcp/tools.mjs && git commit -m "feat: self-contained showcase demo (play, download, side-by-side)"`

---

# PHASE 2 — Open + expanded, subject-aware animation (centerpiece)

## Task 4: part `kind` metadata

**Files:** Modify `tools/rig-editor/model.js`, `tools/rig-editor/model.test.mjs`, `mcp/tools.mjs` (`setPart`), `mcp/server.mjs`.

**Interfaces:**
- Produces: `model.parts()[id].kind` (string|null); `model.setKind(id, kind)`. `set_part` accepts an optional `kind`. Valid kinds: `wheel|flag|limb|eye|mouth|body|accent`.

- [ ] **Step 1: Write the failing test** — append to `model.test.mjs`:

```javascript
{
  const m = sample();
  assert.equal(m.parts()["part-a"].kind, null, "kind defaults to null");
  m.setKind("part-a", "wheel");
  assert.equal(m.parts()["part-a"].kind, "wheel", "setKind stores the kind");
  assert.throws(() => m.setKind("part-a", "bogus"), /kind/, "unknown kind rejected");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/model.test.mjs`.

- [ ] **Step 3: Implement.** In `model.js`: add `export const KINDS = ["wheel","flag","limb","eye","mouth","body","accent"];`; add `kind: meta.kind && KINDS.includes(meta.kind) ? meta.kind : null` to `normPart`; add `setKind(partId, kind){ if(!KINDS.includes(kind)) throw new Error(\`setKind: unknown kind '${kind}'.\`); ensurePart(partId).kind = kind; }` and expose it. Snapshot/restore already deep-copies partMap, so `kind` is covered. In `mcp/tools.mjs` `setPart`, accept `kind` and call `model.setKind(partId, kind)` when provided; add `kind` to the returned part. In `mcp/server.mjs`, add `kind: z.enum(["wheel","flag","limb","eye","mouth","body","accent"]).optional()` to `set_part`'s inputSchema + a description note.

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/model.test.mjs && node mcp/tools.test.mjs`.

- [ ] **Step 5: Commit** — `git add tools/rig-editor/model.js tools/rig-editor/model.test.mjs mcp/tools.mjs mcp/server.mjs && git commit -m "feat: part kind metadata (wheel/flag/limb/eye/mouth/body/accent)"`

## Task 5: subject-aware preset families (incl. wheel→spin)

**Files:** Modify `tools/rig-editor/presets.js`, `tools/rig-editor/presets.test.mjs`.

**Interfaces:**
- Produces: new presets reachable via `recipeFor(roleOrKind, state, name, partId)`; `presetsFor(roleOrKind, state)` lists them. New: `spin` (continuous 360°), `wave`, `talk`, `bounce`, `shake`, `nod`, `float`, `jump`, `wobble`. Existing role-keyed presets unchanged. A `kindToRole`/family lookup lets a kind resolve its presets; when a kind has no specific family, fall back to the role.

- [ ] **Step 1: Write the failing test** — append to `presets.test.mjs`:

```javascript
// wheel spins continuously (360deg, linear, repeat) — the land-rover fix
{
  const spin = recipeFor("wheel", "active", "spin", "part-wheel");
  assertValidRecipe(spin, "part-wheel");
  assert.ok(spin.keyframes.some((k) => /rotate\(360deg\)/.test(k.transform)), "spin reaches 360deg");
}
// new generic presets exist and stamp valid recipes
for (const [role, state, name] of [["accent", "alert", "shake"], ["accent", "active", "bounce"], ["accent", "alert", "nod"]]) {
  assert.ok(presetsFor(role, state).includes(name), `${name} offered for ${role}/${state}`);
  assertValidRecipe(recipeFor(role, state, name, "part-x"), "part-x");
}
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/presets.test.mjs`.

- [ ] **Step 3: Implement.** Add a `spin` template (active) reaching `rotate(360deg)` with `timing:"linear"`, `iteration:"infinite"`, channels `0→rotate0, 1→rotate360`, `reduced:{}`. Add `wave`/`talk`/`bounce`/`shake`/`nod`/`float`/`jump`/`wobble` templates (each a valid schema-v2 recipe). Expose them so `presetsFor`/`recipeFor` find them for the appropriate roles/kinds: extend `PRESETS` with a kind layer OR register them under the roles that map to those kinds (`wheel→limb` family, `flag→accent`, `mouth→accent`), and have `recipeFor`/`presetsFor` resolve a kind to its family. Keep all existing templates intact.

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/presets.test.mjs && node tools/rig-editor/exporter.test.mjs` (golden round-trip must stay green).

- [ ] **Step 5: Commit** — `git add tools/rig-editor/presets.js tools/rig-editor/presets.test.mjs && git commit -m "feat: subject-aware preset families (wheel->spin, wave, bounce, shake, ...)"`

## Task 6: open state vocabulary + warn-not-fail validator

**Files:** Modify `tools/rig-editor/model.js` (declared states already a param), `tools/rig-editor/validator.js`, `tools/rig-editor/validator.test.mjs`.

**Interfaces:**
- Produces: `validate(riggedJson)` returns `{ ok, errors, warnings }`. A rig is `ok` if it has ≥1 animation across all states; a declared state with no animation is a **warning**, not an error. Arbitrary state names are allowed.

- [ ] **Step 1: Write the failing test** — read `validator.test.mjs` first, then append:

```javascript
// arbitrary states allowed; an empty declared state warns but does not fail
{
  const rig = { version: 2, source: {}, states: ["idle", "error"], bones: [{ name: "root", x: 0, y: 0 }],
    parts: [{ id: "part-body", bone: "root", origin: "50% 50%", pivot: { x: 1, y: 1 } }],
    animations: { idle: [{ part: "part-body", name: "part-body__breathe", durationMs: 1, timing: "ease", iteration: "infinite", keyframes: [{ offset: "0%", transform: "scale(1)" }] }], error: [] },
    accents: { impact: [] } };
  const v = validate(rig);
  assert.equal(v.ok, true, "a rig with >=1 animation and a custom state validates");
  assert.ok(v.warnings.some((w) => /error/.test(w)), "the empty 'error' state is a warning");
}
```
(Match the exact rigged.json shape the existing validator expects — read `validator.js` and adjust the fixture so only the state-coverage rule is exercised.)

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/validator.test.mjs`.

- [ ] **Step 3: Implement.** In `validator.js`: keep all structural checks as errors; change the per-state "must have ≥1 animation" rule from an error to a **warning**, and add a single error only if the rig has **zero** animations across all states. Return `warnings: []` alongside `errors`. Update `mcp/tools.mjs` `forgeEmit`: still block on `!v.ok`, but include `v.warnings` (and the plain-English `explainValidation` already covers messaging) in the response.

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/validator.test.mjs && node tools/rig-editor/exporter.test.mjs && pwsh -NoProfile -File tools/check-all.ps1` (goldens cover all three states, so they stay valid).

- [ ] **Step 5: Commit** — `git add tools/rig-editor/validator.js tools/rig-editor/validator.test.mjs mcp/tools.mjs && git commit -m "feat: open state vocabulary; empty declared states warn, not fail"`

## Task 7: kind-aware default presets + land-rover re-rig check

**Files:** Modify `mcp/tools.mjs` (`defaultPresetFor`), `mcp/tools.test.mjs`; add a check that a wheel kind auto-fills `spin`.

**Interfaces:**
- Produces: `defaultPresetFor(id, role, kind)` — when `kind==="wheel"` returns `["active","spin"]`, `flag→["alert","wave"]`, `mouth→["active","talk"]`, else the existing id/role logic.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```javascript
assert.deepEqual(defaultPresetFor("part-wheel-front", "limb", "wheel"), ["active", "spin"], "wheel kind spins");
assert.deepEqual(defaultPresetFor("part-flag", "accent", "flag"), ["alert", "wave"], "flag waves");
assert.deepEqual(defaultPresetFor("part-tail", "limb", null), ["active", "wag"], "id-based fallback still works");
```

- [ ] **Step 2: Run, verify FAIL** — `node mcp/tools.test.mjs`.

- [ ] **Step 3: Implement.** Give `defaultPresetFor` a third `kind` param checked first (`wheel→spin`, `flag→wave`, `mouth→talk`), then the existing id/role rules. Update its call site in `forgeEmit` auto-fill to pass `model.parts()[id].kind`.

- [ ] **Step 4: Run, verify PASS** — `node mcp/tools.test.mjs`. Then re-rig the land-rover with a wheel kind and confirm the emitted CSS contains a `rotate(360deg)` spin (manual: assign a wheel part `kind:"wheel"`, emit, grep the demo for `360deg`).

- [ ] **Step 5: Commit** — `git add mcp/tools.mjs mcp/tools.test.mjs && git commit -m "feat(mcp): kind-aware default presets (wheel->spin) fixes the land-rover"`

## Task 8: binding example + gallery doc (P2c/3b)

**Files:** Create `docs/gallery/README.md`.

- [ ] **Step 1:** Write `docs/gallery/README.md` with (a) good-input vs silhouette examples + the grade explanation, (b) a runnable `createMascot` binding snippet mapping app signals to declared states (`ci_failed → error → shake`), referencing `runtime/mascot-state.js`. No code change; documentation deliverable.
- [ ] **Step 2: Commit** — `git add docs/gallery/README.md && git commit -m "docs: input gallery + signal-binding example"`

---

# PHASE 3 — Reach (scoped — depends on Phases 1–2)

## Task 9: browser drop-zone
- Add `tools/rig-editor/drop.html` (+ small glue in `app.js` or a new module): a dropped PNG is decoded
  to RGBA, run through the existing browser `vectorize` → `segment` → `model` → preview, then exported
  via the existing editor export. Reuse the in-browser pipeline; do not rebuild the editor.
- **Test:** a Playwright e2e (`tests/e2e/`) that loads `drop.html`, drops a small PNG fixture, and
  asserts a rig preview renders + export downloads an SVG.
- **Acceptance:** a non-dev can drag a PNG and get an animated SVG without a terminal.

---

## Self-Review

**Spec coverage:** P1a grade → Tasks 1–2. P1b showcase → Task 3. P2a kind+presets → Tasks 4–5. P2b open
states+validator → Task 6. kind default mapping (land-rover fix) → Task 7. P2c binding + P3b gallery →
Task 8. P3a drop-zone → Task 9. ✓

**Placeholder scan:** Tasks 1–4, 6–7 carry complete code; Tasks 5, 8, 9 are spec-detailed (Task 5's
preset templates follow the existing `presets.js` schema-v2 shape exactly — the implementer copies that
shape; Task 9 is browser/Playwright and scoped by dependency). No TBD/placeholder steps.

**Type consistency:** `gradeInput(model)→{grade,reason,recommendation}` consistent across Tasks 1–2.
`setKind`/`kind` consistent Tasks 4–5–7. `defaultPresetFor(id,role,kind)` consistent Tasks 7.
`validate(...)→{ok,errors,warnings}` consistent Task 6 and its `forgeEmit` consumer.

**Open risks:** Task 5 preset restructure must not break `recipeFor` for existing role-keyed rigs
(golden round-trip is the gate); Task 6 validator relaxation must keep the buildable-slice goldens valid
(they cover all 3 states). Both are caught by `check-all.ps1` in their Step 4.
