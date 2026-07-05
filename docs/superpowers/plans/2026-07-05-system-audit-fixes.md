# System Audit Fixes Implementation Plan

> **For agentic workers:** Subagents are spend-blocked for this engagement — execute **inline** via superpowers:executing-plans, task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the correctness, UX, and docs-drift defects found in `docs/superpowers/audits/2026-07-05-system-audit.md`, each as one gate-green TDD commit.

**Architecture:** Point fixes to existing pure modules (`mcp/tools.mjs`, `tools/rig-editor/*.js`, `runtime/mascot-state.js`) plus their `*.test.mjs`. No new modules, no new deps, no new abstractions. Every fix is additive or a corrected condition; goldens and the 10-tool MCP contract are preserved.

**Tech Stack:** Node ESM (no build), `node:assert/strict` (no framework), PowerShell gate scripts, Playwright e2e (dev-dep only).

## Global Constraints

_Every task's requirements implicitly include these — copied verbatim from the engagement brief._

- Runtime AND browser editor stay **ZERO-dependency, pure ESM, NO build step**. New deps only in `mcp/`.
- **Whole-part CSS-transform motion only** — no opacity/colour/filter channels.
- Tests use `node:assert/strict`, **no framework**, mirroring existing `*.test.mjs`.
- MCP tool count is a contract: **10 tools** (`mcp/protocol.test.mjs`). Do not add/remove tools.
- Golden round-trips (`tools/rig-editor/exporter.test.mjs`) and buildable-slice checks stay green.
- MCP/runtime keep **declare-at-start** state vocab; only the editor model may mutate states.
- Emitted demos must open on `file://` (inline SVG/CSS, no fetch).
- **Gate after EVERY task:** `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → must print `RESULT: PASS`. Re-run `pwsh -NoProfile -File tools/check-e2e.ps1` after any editor/`tools/` change.
- One logical change per commit; end each commit body with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Match existing terse comment/naming style. Change only what the finding calls for.

## Files touched (by task)

| Task | Finding | Primary file(s) | Test file(s) | e2e re-run? |
|---|---|---|---|---|
| 1 | C1 | `mcp/tools.mjs`, `tools/rig-editor/app.js` | `mcp/tools.test.mjs`, `tests/e2e/state-controls.spec.mjs` | yes |
| 2 | I1 | `mcp/tools.mjs` | `mcp/tools.test.mjs` | no |
| 3 | I2 | `mcp/tools.mjs`, `tools/rig-editor/app.js` | `mcp/tools.test.mjs` | yes |
| 4 | I3, D5 | `tools/rig-editor/layer-ingest.js` | `tools/rig-editor/layer-ingest.test.mjs` | no |
| 5 | I4, D2 | `tools/rig-editor/model.js`, `mcp/server.mjs`, `docs/gallery/README.md` | `tools/rig-editor/model.test.mjs` | no |
| 6 | U2 | `tools/rig-editor/grade.js` | `tools/rig-editor/grade.test.mjs` | no |
| 7 | M3 | `runtime/mascot-state.js` | `runtime/mascot-state.test.mjs` | no |
| 8 | M1 | `mcp/tools.mjs` | `mcp/tools.test.mjs` | no |
| 9 | M2 | `tools/rig-editor/model.js` | `tools/rig-editor/model.test.mjs` | no |
| 10 | U1 | `tools/rig-editor/exporter.js` | `tools/rig-editor/exporter.test.mjs` | yes |
| 11 | U4, U5 | `mcp/regions-preview.mjs`, `mcp/tools.mjs`, `tools/rig-editor/index.html` | `mcp/regions-preview.test.mjs` | no |
| 12 | U3, D1, D3, D4 | `README.md`, `docs/README.md` | — (docs) | no |

Recommended order = the table order: correctness first (1–3), then silent-degradation (4), then guidance/UX (5–6, 11), runtime hardening (7–9), the round-trip feature (10), docs last (12). Tasks are independent — the user may drop any without breaking the rest.

**Gate coverage (verified):** every test file this plan appends to is already executed by a gate, so no test can silently not-run. `check-all.ps1` P5 runs `model`/`layer-ingest`/`grade`/`exporter`; P6 runs `tools`/`regions-preview`; P4 runs `runtime/mascot-state`. `check-e2e.ps1` runs `tests/e2e/state-controls` (Task 1). No new test file is created, so no gate-list edit is needed.

---

### Task 1: Vocabulary-aware motion recommendations (C1 — Simple tier crash)

**Files:**
- Modify: `mcp/tools.mjs` (`planFor`, lines ~54-70)
- Modify: `tools/rig-editor/app.js` (`#kind` onchange, lines ~403-416)
- Test: `mcp/tools.test.mjs` (append), `tests/e2e/state-controls.spec.mjs` (append)

**Interfaces:**
- Consumes: `model.states()` (declared vocabulary), `presetsFor(role, state)` (already imported in both files).
- Produces: `planFor(model)` never recommends a state absent from `model.states()`; `forgeEmit`'s auto-fill therefore never calls `model.setPreset` with an undeclared state.

**Root cause:** `defaultPresetFor` returns a `[state, preset]` whose `state` may not be declared (a limb → `["active", …]`, accent → `["alert", …]`). On a Simple-tier rig (`states: ["idle"]`) `forgeEmit`'s auto-fill (`tools.mjs:286-288`) calls `model.setPreset("active", …)` → throws `setPreset: unknown state 'active'`. The editor's kind handler has the same defect.

- [ ] **Step 1: Write the failing MCP test** — append to `mcp/tools.test.mjs` (after the existing signal-states block near line 291):

```js
// C1 regression: a Simple-tier rig (idle only) with a limb must EMIT, not crash. The limb has no
// idle preset, so it simply stays inert; the core still breathes. Auto-fill must not reach for 'active'.
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4, states: ["idle"] });
  assignRegion({ session: s.session, box: { x: 0.05, y: 0.05, w: 0.9, h: 0.30 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.05, y: 0.62, w: 0.9, h: 0.27 }, partId: "leg", role: "limb" });
  const out = forgeEmit({ session: s.session, assetName: "simple" });
  assert.equal(out.ok, true, `Simple-tier emit must not crash: ${JSON.stringify(out.error || out.validation)}`);
  // planFor must not recommend an undeclared state for the limb
  const legPlan = planFor(_sessions.get(s.session).model).find((p) => p.id === "part-leg");
  assert.ok(!legPlan.recommended || legPlan.recommended.state === "idle",
    `limb recommendation stays within declared states (got ${JSON.stringify(legPlan.recommended)})`);
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node --test tools.test.mjs` (or `node tools.test.mjs`)
Expected: FAIL — `setPreset: unknown state 'active'` thrown from `forgeEmit`.

- [ ] **Step 3: Fix `planFor`** — in `mcp/tools.mjs`, replace the body of the `.map` recommendation block (lines ~59-65):

```js
  return ids.map((id) => {
    const { role, kind } = model.parts()[id];
    const def = defaultPresetFor(id, role, kind);
    let recommended = def ? { state: def[0], preset: def[1] } : null;
    // C1: only recommend a DECLARED state. If the natural state isn't in the rig's vocabulary
    // (e.g. a limb's 'active' on a Simple idle-only rig), fall back to the first declared state
    // that offers this role a preset, else leave the part inert. Standard/Signals rigs declare the
    // natural state, so this never changes their recommendation (goldens unaffected).
    if (recommended && !states.includes(recommended.state)) {
      const alt = states.find((st) => presetsFor(role, st).length);
      recommended = alt ? { state: alt, preset: presetsFor(role, alt)[0] } : null;
    }
    if (recommended && recommended.preset === "walk") {
      if (walks % 2 === 1) recommended = { state: recommended.state, preset: "walk-mirror" };
      walks++;
    }
    const options = {};
    for (const s of states) options[s] = presetsFor(role, s);
    return { id, role, kind: kind || null, recommended, options };
  });
```

- [ ] **Step 4: Run the MCP test, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS.

- [ ] **Step 5: Write the failing editor e2e** — append to `tests/e2e/state-controls.spec.mjs`:

```js
// C1 (editor side): a Simple-tier rig + kind=wheel must not throw when the wheel's signature state
// ('active') isn't declared. The kind handler must skip a preset for an undeclared state.
test("Simple-tier rig: choosing kind=wheel does not crash when 'active' is undeclared", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await loadEditorWithStates(page, ["idle"]);           // idle-only vocabulary
  await page.click('#parts li[data-id="part-leg-left"]');
  await page.selectOption("#role", "limb");
  await page.selectOption("#kind", "wheel");            // signature preset is active:spin — undeclared here
  expect(errors, "no uncaught page error from the kind handler").toEqual([]);
});
```

- [ ] **Step 6: Run it, verify it fails**

Run: `pwsh -NoProfile -File tools/check-e2e.ps1 state-controls`
Expected: FAIL — an uncaught `setPreset: unknown state 'active'` page error.

- [ ] **Step 7: Fix the editor kind handler** — in `tools/rig-editor/app.js`, the `$("kind").onchange` block, change the guard (line ~412) to also require the state be declared:

```js
  if (def) {
    const [state, name] = def;
    const role = model.parts()[selected].role;
    // C1: only apply the kind's signature preset when its state is DECLARED and the picker isn't
    // already set — otherwise setPreset throws on an undeclared state (Simple-tier rig).
    if (model.states().includes(state) && presetsFor(role, state).includes(name) && !model.preset(state, selected)) {
      model.setPreset(state, selected, name);
    }
  }
```

- [ ] **Step 8: Run the e2e, verify it passes**

Run: `pwsh -NoProfile -File tools/check-e2e.ps1 state-controls`
Expected: PASS.

- [ ] **Step 9: Full gate (node + e2e, editor changed) + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS
pwsh -NoProfile -File tools/check-e2e.ps1                            # 18/18 (state-controls +1)
git add mcp/tools.mjs tools/rig-editor/app.js mcp/tools.test.mjs tests/e2e/state-controls.spec.mjs
git commit -m "fix(mcp,editor): keep motion recommendations within declared states (Simple tier no longer crashes)"
```

---

### Task 2: Thread rig metadata through `startFromLayeredSvg` (I1)

**Files:**
- Modify: `mcp/tools.mjs` (`startFromLayeredSvg`, lines ~181-201)
- Test: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Consumes: `parseLayered(text)` → `{ viewBox, elements, parts, states }` (the `parts`/`states` fields already exist since commit e445567).
- Produces: `startFromLayeredSvg` builds the model with roles/kinds/pivots/presets/declared-states honoured.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```js
// I1: a self-describing layered SVG (data-role/pivot/preset-*/states) must round-trip through the
// MCP alt entry, not just the browser. Regression for the dropped parts/states in startFromLayeredSvg.
{
  const rig =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,alert,loading">' +
    '<g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe">' +
    '<rect x="30" y="30" width="40" height="40" fill="#26a69a"/></g></svg>';
  const s = startFromLayeredSvg({ svg: rig });
  const m = _sessions.get(s.session).model;
  assert.deepEqual(m.states(), ["idle", "active", "alert", "loading"], "declared states survive MCP ingest");
  assert.equal(m.parts()["part-body"].role, "core", "role survives MCP ingest");
  assert.equal(m.preset("idle", "part-body"), "breathe", "preset survives MCP ingest");
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — states are `["idle","active","alert"]`, role `passive`, preset `undefined`.

- [ ] **Step 3: Fix the destructure** — in `mcp/tools.mjs`, `startFromLayeredSvg`, change line ~184 and the `toModel` call at line ~193:

```js
  const { viewBox, elements, parts, states } = parseLayered(text);
```

```js
  const model = toModel({ viewBox, elements, parts, states });
```

(Leave the `noBox` rejection between them unchanged.)

- [ ] **Step 4: Run it, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS.

- [ ] **Step 5: Full gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "fix(mcp): carry roles/pivots/presets/states through forge_start_from_layered_svg"
```

---

### Task 3: Sanitize part ids at every input boundary (I2)

**Files:**
- Modify: `mcp/tools.mjs` (`normPartId`, lines ~78-80)
- Modify: `tools/rig-editor/app.js` (`#addpart`, `#split`, `#rename` handlers)
- Test: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Consumes: `sanitizeId(name, used?)` from `layer-ingest.js` — already imported by `app.js`; add the import to `tools.mjs`.
- Produces: no part id containing a space, quote, or uppercase reaches the model, so emitted `<g id>`/CSS selectors are always valid.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```js
// I2: an id with a space would produce '<g id="part-left arm">' and a broken '#part-left arm' CSS
// selector (a silent no-op animation). It must be sanitized to a single valid token at the boundary.
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4 });
  const r = assignRegion({ session: s.session, box: { x: 0, y: 0, w: 1, h: 1 }, partId: "Left Arm", role: "limb" });
  assert.ok(r.parts.some((p) => p.id === "part-left-arm"), "'Left Arm' sanitized to 'part-left-arm'");
  assert.ok(!r.parts.some((p) => /[ "A-Z]/.test(p.id)), "no id carries a space, quote, or uppercase");
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — the model holds `part-Left Arm`.

- [ ] **Step 3: Fix `normPartId`** — in `mcp/tools.mjs`, add to the imports from `layer-ingest.js` (line ~14) and replace `normPartId`:

```js
import { parseLayered, toModel, sanitizeId } from "../tools/rig-editor/layer-ingest.js";
```

```js
// sanitize + enforce a stable part- prefix so agent-chosen ids can't collide or break CSS/SVG ids.
// sanitizeId lowercases, replaces runs of non-alphanumerics with '-', and prefixes 'part-'.
function normPartId(id) {
  return id == null ? id : sanitizeId(id);
}
```

- [ ] **Step 4: Run the MCP test, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS. (The existing `head` → `part-head` assertion at line 44-46 still holds; `sanitizeId("head")` = `part-head`.)

- [ ] **Step 5: Fix the three editor inputs** — in `tools/rig-editor/app.js`:

`#addpart` (line ~437):
```js
$("addpart").onclick = () => {
  const id = sanitizeId($("newname").value.trim());
  if (!id) return;
  pushUndo();
  model.assign([], id);
  $("newname").value = "";
  renderParts(); selectPart(id);
};
```

`#split` (line ~525), replace the `const target = …` line:
```js
  const target = sanitizeId($("splitname").value.trim());
```

`#rename` (line ~419), replace the `const next = …` line and the equality guard:
```js
  const next = sanitizeId(prompt("Rename part id to:", selected) || "");
  if (!next || next === selected) return;
```

- [ ] **Step 6: Gate + e2e + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
pwsh -NoProfile -File tools/check-e2e.ps1
git add mcp/tools.mjs tools/rig-editor/app.js mcp/tools.test.mjs
git commit -m "fix(mcp,editor): sanitize part ids at input boundaries (no broken CSS/SVG ids)"
```

---

### Task 4: Guard nested groups + widen preset-state regex in the node parser (I3, D5)

**Files:**
- Modify: `tools/rig-editor/layer-ingest.js` (`parseLayered`, lines ~13, ~61; header note)
- Test: `tools/rig-editor/layer-ingest.test.mjs` (append)

**Interfaces:**
- Produces: `parseLayered` throws a clear error on a nested `<g>` (instead of silently losing the outer group's own geometry), and captures `data-preset-<state>` for state names containing digits/hyphens.

- [ ] **Step 1: Write the failing tests** — append to `tools/rig-editor/layer-ingest.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/layer-ingest.test.mjs`
Expected: FAIL — no throw for nested; `phase-2` preset absent.

- [ ] **Step 3: Fix `parseLayered`** — in `tools/rig-editor/layer-ingest.js`:

Widen the preset regex (line ~61):
```js
    for (const pm of gAttrs.matchAll(/\bdata-preset-([a-z0-9-]+?)="([^"]*)"/g)) { (meta.presets || (meta.presets = {}))[pm[1]] = pm[2]; }
```

Add the nested-group guard immediately after `const gAttrs = g[1], inner = g[2];` (inside the `while` loop, ~line 52):
```js
    if (/<g\b/.test(inner)) {
      throw new Error("nested <g> layers are not supported by the flat layered ingest — flatten the export, or rig it in the browser editor (which resolves nesting).");
    }
```

Update the header ceiling note (line ~8) to record the loss, per D5:
```js
// Known v1 limits: per-group/element transforms are not resolved, and NESTED <g> layers are rejected
// (the non-greedy tokenizer would drop the outer group's own geometry) — flatten exports first.
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node tools/rig-editor/layer-ingest.test.mjs`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add tools/rig-editor/layer-ingest.js tools/rig-editor/layer-ingest.test.mjs
git commit -m "fix(layer-ingest): reject nested <g> layers; capture digit/hyphen state presets"
```

---

### Task 5: Correct signal-state priority guidance (I4, D2)

**Files:**
- Modify: `tools/rig-editor/model.js` (`SIGNAL_STATES`, line ~15)
- Modify: `mcp/server.mjs` (the example array in `forge_start_from_image` + `set_part` descriptions)
- Modify: `docs/gallery/README.md` (the two example arrays + the priority sentence)
- Test: `tools/rig-editor/model.test.mjs` (append)

**Interfaces:**
- Produces: the recommended signal vocabulary orders `error` LAST (highest priority), matching the runtime rule (priority = index in `states`, `mascot-state.js:39`).

**Note:** `SIGNAL_STATES` is a suggestion list, not a golden. It is spread in `app.js:124` for the "+ add state" dropdown (order only affects menu order) and echoed in the two docs. No animation golden depends on its order. `STATE_FAMILY` mapping (`presets.js:108`) is unchanged.

- [ ] **Step 1: Write the failing test** — append to `tools/rig-editor/model.test.mjs`:

```js
// I4: runtime priority = index in states (mascot-state.js). The suggested signal vocabulary must put
// 'error' last so it OUTRANKS 'success'/'loading' — the opposite of the old [loading,error,success].
{
  assert.deepEqual(SIGNAL_STATES, ["loading", "success", "error"],
    "signal states ordered by ascending priority: error (highest) last");
}
```

Ensure `SIGNAL_STATES` is imported at the top of `model.test.mjs` (add to the existing import from `./model.js` if absent).

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/model.test.mjs`
Expected: FAIL — order is `["loading","error","success"]`.

- [ ] **Step 3: Reorder the constant** — in `tools/rig-editor/model.js` line ~15:

```js
export const SIGNAL_STATES = ["loading", "success", "error"]; // ascending priority; error (highest) last
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node tools/rig-editor/model.test.mjs`
Expected: PASS.

- [ ] **Step 5: Fix the doc/description occurrences of the old order** (exact string edits)

In `mcp/server.mjs`, the `forge_start_from_image` description example (line ~41-42): replace `["idle","active","alert","loading","error","success"]` with `["idle","active","alert","loading","success","error"]`. (The `set_part` description names the states as prose "loading/error/success"; leave it — it is not a priority ordering.)

In `docs/gallery/README.md`, replace both example arrays with the reordered vocabulary:
- line ~117: `forge_start_from_image({ base64, states: ["idle", "active", "alert", "loading", "success", "error"] })`
- line ~132: the `createMascot({ … states: ["idle", "active", "alert", "loading", "success", "error"] })` array.

Do **not** edit the priority sentence at line ~131 (`vocabulary order = PRIORITY (error outranks success outranks loading)`) or the `mapSignal` comments (lines ~137-141): with the reordered array, `error` (index 5) now genuinely outranks `success` (4) and `loading` (3), so those lines become *correct as written*. Verify after editing that the sentence sits above an array whose last element is `error`.

- [ ] **Step 6: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add tools/rig-editor/model.js mcp/server.mjs docs/gallery/README.md tools/rig-editor/model.test.mjs
git commit -m "fix: order signal states by priority (error highest) so guidance matches the runtime"
```

---

### Task 6: Tighten the silhouette grade (U2)

**Files:**
- Modify: `tools/rig-editor/grade.js` (line ~9)
- Test: `tools/rig-editor/grade.test.mjs` (append)

**Interfaces:**
- Produces: `gradeInput` returns `silhouette` only when `fills.size <= 2`. A colour-distinct image with one large-but-not-sole region grades `borderline`, with an accurate reason.

- [ ] **Step 1: Flip the stale assertion** — `grade.test.mjs:10-13` currently encodes the *buggy* behaviour (a 3-fill dominant image → `silhouette`). U2 says that is wrong, so replace that assertion with the corrected expectation:

```js
// U2: 3+ fills is never a silhouette, even with a dominant region — the parts CAN be separated by
// colour. A dominant-but-colourful image grades borderline (previously mis-graded silhouette).
assert.equal(gradeInput(mk([
  { x: 0, y: 0, w: 100, h: 95, fill: "#111" }, { x: 0, y: 95, w: 3, h: 5, fill: "#222" }, { x: 5, y: 95, w: 3, h: 5, fill: "#333" },
])).grade, "borderline");
```

(`mk` is the existing helper at `grade.test.mjs:6`. The monochrome→silhouette case at line 9 and the `good`/fragmented cases stay unchanged.)

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/grade.test.mjs`
Expected: FAIL — the code still returns `silhouette` for that input (`maxShare > 0.8`), but the test now expects `borderline`.

- [ ] **Step 3: Fix the condition** — in `tools/rig-editor/grade.js`, change line ~9 so a dominant region alone no longer forces silhouette:

```js
  if (fills.size <= 2) {
    return {
      grade: "silhouette",
      reason: `flat ${fills.size}-colour shape — one region, nothing to separate`,
      recommendation: "parts can't be auto-separated — use a layered or multi-colour source, or it will animate as one body",
    };
  }
```

The existing dominant-region case is already handled by the later `borderline` return (line ~33: `${fills.size} colours, largest region ${…}%`), which now catches `fills>=3 && maxShare>0.8`.

- [ ] **Step 4: Run it, verify it passes**

Run: `node tools/rig-editor/grade.test.mjs`
Expected: PASS — the flipped assertion now gets `borderline`, and the monochrome (line 9), `good` (lines 15-18, 29-32), and fragmented (lines 20-27) cases are unaffected (they don't rely on the dominant-region → silhouette rule).

- [ ] **Step 5: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add tools/rig-editor/grade.js tools/rig-editor/grade.test.mjs
git commit -m "fix(grade): silhouette requires <=2 fills; dominant-but-colourful input is borderline"
```

---

### Task 7: `pollJson` honours non-2xx responses (M3)

**Files:**
- Modify: `runtime/mascot-state.js` (`pollJson`, lines ~115-129)
- Test: `runtime/mascot-state.test.mjs` (append)

**Interfaces:**
- Produces: a non-`ok` HTTP response asserts nothing (falls to resting) explicitly, instead of relying on `res.json()` throwing.

- [ ] **Step 1: Write the failing test** — append to `runtime/mascot-state.test.mjs` (stub `globalThis.fetch`):

```js
// M3: a 500 with a JSON body must assert nothing (not map the error payload to a state). pollJson
// checks res.ok. A microtask flush lets the immediate tick() resolve.
{
  const calls = [];
  const savedFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 500, json: async () => ({ failing: true }) });
  const source = pollJson("/x", (d) => (d.failing ? "alert" : null), 100000);
  const stop = source((asserted) => calls.push(asserted));
  await new Promise((r) => setTimeout(r, 0)); // let the immediate tick settle
  stop();
  globalThis.fetch = savedFetch;
  assert.deepEqual(calls, [null], "a non-ok response asserts nothing (does not map the error body)");
}
```

Ensure `pollJson` is imported at the top of the test (add to the existing `./mascot-state.js` import).

- [ ] **Step 2: Run it, verify it fails**

Run: `node runtime/mascot-state.test.mjs`
Expected: FAIL — `calls` is `["alert"]` (the error body was mapped).

- [ ] **Step 3: Fix `pollJson`** — in `runtime/mascot-state.js`, add the `res.ok` guard inside `tick`:

```js
    async function tick() {
      try {
        const res = await fetch(url);
        if (!res.ok) { emit(null); return; } // a failed request asserts nothing -> resting under hysteresis
        emit(mapFn(await res.json()));
      } catch {
        emit(null); // a dead feed asserts nothing -> falls back to resting under hysteresis
      }
    }
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node runtime/mascot-state.test.mjs`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add runtime/mascot-state.js runtime/mascot-state.test.mjs
git commit -m "fix(runtime): pollJson treats non-2xx as nothing-asserted explicitly"
```

---

### Task 8: Word-boundary anatomy heuristics (M1)

**Files:**
- Modify: `mcp/tools.mjs` (`defaultPresetFor`, lines ~43-45)
- Test: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Produces: `defaultPresetFor` no longer matches `tail` inside `detail` or `eye` inside `eyebrow`.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs` (near the existing `defaultPresetFor` assertions ~line 250):

```js
// M1: anatomy heuristics must not fire on substrings — 'detail' is not a tail, 'eyebrow' not an eye.
assert.notDeepEqual(defaultPresetFor("part-detail", "limb"), ["active", "wag"], "'detail' is not a tail");
assert.notDeepEqual(defaultPresetFor("part-eyebrow", "accent"), ["idle", "blink"], "'eyebrow' is not an eye");
// real anatomy still matches
assert.deepEqual(defaultPresetFor("part-tail", "limb"), ["active", "wag"], "a real tail still wags");
assert.deepEqual(defaultPresetFor("part-left-eye", "accent"), ["idle", "blink"], "a real eye still blinks");
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — `part-detail` wags, `part-eyebrow` blinks.

- [ ] **Step 3: Fix the regexes** — in `mcp/tools.mjs`, `defaultPresetFor` (lines ~43-45), anchor each token to a word/segment boundary:

```js
  if (role === "limb" && /(^|-)tail(s)?(-|$)/i.test(id)) return ["active", "wag"];
  if (role === "accent" && /(^|-)(ear|antenn)/i.test(id)) return ["idle", "twitch"];
  if (role === "accent" && /(^|-)eye(s)?(-|$)/i.test(id)) return ["idle", "blink"];
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS. (Existing `part-tail`, `part-ears`, `part-eyes` assertions at lines 250-252 still hold.)

- [ ] **Step 5: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "fix(mcp): anchor anatomy preset heuristics to word boundaries"
```

---

### Task 9: Rename collision guard (M2)

**Files:**
- Modify: `tools/rig-editor/model.js` (`rename`, lines ~58-71)
- Modify: `tools/rig-editor/app.js` (`#rename` onclick, lines ~419-428) — catch the new throw so the editor shows a status message instead of an uncaught console error
- Test: `tools/rig-editor/model.test.mjs` (append)

**Interfaces:**
- Produces: `model.rename(oldId, newId)` throws if `newId` already exists, instead of silently clobbering its metadata and merging rects.

- [ ] **Step 1: Write the failing test** — append to `tools/rig-editor/model.test.mjs`:

```js
// M2: renaming onto an existing part id would clobber that part's metadata and merge its rects.
// Reject the collision so no metadata is silently lost.
{
  const m = createModel({
    viewBox: "0 0 10 10",
    rects: [{ id: "r0", x: 0, y: 0, w: 5, h: 5, fill: "#a", part: "part-a" }, { id: "r1", x: 5, y: 5, w: 3, h: 3, fill: "#b", part: "part-b" }],
    parts: { "part-a": { role: "core" }, "part-b": { role: "limb" } },
  });
  assert.throws(() => m.rename("part-a", "part-b"), /exists|collision/i, "rename onto an existing id is rejected");
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/model.test.mjs`
Expected: FAIL — no throw; `part-b`'s `limb` role is overwritten with `part-a`'s `core`.

- [ ] **Step 3: Fix `rename`** — in `tools/rig-editor/model.js`, add the guard after the `oldId === newId` early return (line ~59):

```js
  function rename(oldId, newId) {
    if (oldId === newId) return;
    if (!partMap[oldId]) throw new Error(`rename: unknown part '${oldId}'.`);
    if (partMap[newId]) throw new Error(`rename: target id '${newId}' already exists (would clobber it).`);
    const meta = partMap[oldId];
```

- [ ] **Step 4: Run it, verify it passes**

Run: `node tools/rig-editor/model.test.mjs`
Expected: PASS.

- [ ] **Step 5: Guard the editor handler** — in `tools/rig-editor/app.js` `#rename` onclick, wrap only the `model.rename` call so the new throw surfaces as a status line instead of an uncaught console error. This is a minimal, single-line target that composes with Task 3 regardless of order (both leave the `pushUndo();` + `model.rename(selected, next);` lines intact). Replace:

```js
  pushUndo();
  model.rename(selected, next);
  const was = selected; selected = next;
```

with:

```js
  pushUndo();
  try { model.rename(selected, next); }
  catch (e) { undoStack.pop(); status("✗ " + (e && e.message ? e.message : e)); return; }
  const was = selected; selected = next;
```

(Popping the undo entry on failure keeps the stack honest, since `pushUndo` already ran.)

- [ ] **Step 6: Gate + e2e + commit** (rename is reachable from the editor; e2e sanity)

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
pwsh -NoProfile -File tools/check-e2e.ps1 rig-editor
git add tools/rig-editor/model.js tools/rig-editor/app.js tools/rig-editor/model.test.mjs
git commit -m "fix(model,editor): reject rename onto an existing part id (no silent clobber)"
```

---

### Task 10: Self-describing editor export so rigs round-trip (U1)

**Files:**
- Modify: `tools/rig-editor/exporter.js` (`exportRig` resolves `kind`; `serializeSvg` emits `data-role`/`data-kind`/`data-pivot`/`data-preset-*` + root `data-states`)
- Test: `tools/rig-editor/exporter.test.mjs` (append)

**Interfaces:**
- Consumes: `model.selections()` (already read by `exportRig` at line ~51), `partMeta[id].kind`.
- Produces: `out.manualSvg` carries a self-describing rig (`data-role`/`data-kind`/`data-pivot="x,y"`/`data-preset-<state>` per group + root `data-states`) that the editor's `loadLayeredSvg` reader already understands — so a re-opened export animates instead of loading inert. Existing attrs (`data-bone`/`data-origin`/`data-pivot-x`/`-y`) are kept (additive).

**Golden safety:** `exporter.test.mjs` asserts attribute *presence* via subset regex (`id=…[^>]*class="part"[^>]*data-origin=…`), not an exact attribute set, and `[^>]*` tolerates inserted attrs — verify the golden stays green in Step 5. The committed `devbrain-manual-part.svg` fixture is read (not regenerated) by `emit.test.mjs`, so it is unaffected.

- [ ] **Step 1: Write the failing test** — append to `tools/rig-editor/exporter.test.mjs` (reuse the `m`/`out` already built at the top of the file):

```js
// U1: the export is self-describing — role/kind/pivot/preset/states travel as data-* so the editor's
// layered loader can rebuild an ANIMATED model from a re-opened export (save-and-resume round-trip).
{
  assert.match(out.manualSvg, /<svg[^>]*\bdata-states="idle,active,alert"/, "root carries declared states");
  assert.match(out.manualSvg, /id="part-body"[^>]*\bdata-role="core"/, "body group carries its role");
  assert.match(out.manualSvg, /id="part-body"[^>]*\bdata-preset-idle="breathe"/, "body group carries its idle preset");
  assert.match(out.manualSvg, /id="part-leg-left"[^>]*\bdata-preset-active="walk"/, "limb group carries its active preset");
  // round-trip: the layered parser rebuilds the same presets from the export alone
  const { parts } = parseLayered(out.manualSvg);
  assert.equal(parts["part-body"].role, "core", "re-parsed role");
  assert.equal(parts["part-body"].presets.idle, "breathe", "re-parsed idle preset");
}
```

Add `import { parseLayered } from "./layer-ingest.js";` to the test's imports.

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/exporter.test.mjs`
Expected: FAIL — `data-states`/`data-role`/`data-preset-*` absent from `manualSvg`.

- [ ] **Step 3: Resolve `kind` in `exportRig`** — in `tools/rig-editor/exporter.js`, line ~35, add `kind` to the resolved record and pass `selections` into `serializeSvg`:

```js
    resolved[id] = { id, bone, origin, pivot, role: meta.role || "passive", kind: meta.kind || null };
```

Change the `serializeSvg` call (line ~81) to include selections:
```js
  const manualSvg = serializeSvg({ assetName, viewBox, states, orderedIds, resolved, rects, selections, opts });
```

Note `selections` is already computed at line ~51 (`const selections = model.selections();`, in the "4. animations" block), which is **before** the `serializeSvg` call at line ~81 — it is in scope, no hoist needed.

- [ ] **Step 4: Emit the attrs in `serializeSvg`** — update the signature and the two emit points:

Signature (line ~92):
```js
function serializeSvg({ assetName, viewBox, states, orderedIds, resolved, rects, selections, opts }) {
```

Root `<svg>` — add `data-states` to the opening tag (line ~100-105), appending to the attribute list:
```js
  lines.push(
    `<svg id="mascot" data-state="${states[0]}" data-states="${states.join(",")}" data-render-method="${renderMethod}" ` +
      `data-source-bounds="${sourceBounds}" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
      `shape-rendering="crispEdges" role="img" aria-labelledby="title desc">`
  );
```

Per-part `<g>` — replace the group-open push (lines ~112-115) so it also emits role/kind/pivot/presets:
```js
    const partPresets = states
      .map((s) => (selections[s] && selections[s][id] ? ` data-preset-${s}="${selections[s][id]}"` : ""))
      .join("");
    lines.push(
      `    <g id="${id}" class="part" data-bone="${r.bone}" data-origin="${r.origin}" ` +
        `data-pivot-x="${round(r.pivot.x)}" data-pivot-y="${round(r.pivot.y)}" ` +
        `data-role="${r.role}"${r.kind ? ` data-kind="${r.kind}"` : ""} ` +
        `data-pivot="${round(r.pivot.x)},${round(r.pivot.y)}"${partPresets}>`
    );
```

(`data-pivot="x,y"` is the comma form the layered loader reads; `data-pivot-x/-y` stay for back-compat.)

- [ ] **Step 5: Run the golden + new test, verify both pass**

Run: `node tools/rig-editor/exporter.test.mjs`
Expected: PASS — the golden round-trip (rect counts, part metadata subset regex) AND the new round-trip assertions.

- [ ] **Step 6: Gate + e2e + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
pwsh -NoProfile -File tools/check-e2e.ps1
git add tools/rig-editor/exporter.js tools/rig-editor/exporter.test.mjs
git commit -m "feat(editor): self-describing export (role/kind/pivot/preset/states) so rigs round-trip"
```

---

### Task 11: Region-label clamp + unify default colour count (U4, U5)

**Files:**
- Modify: `mcp/regions-preview.mjs` (line ~22)
- Modify: `mcp/tools.mjs` (`startFromImage` default `colors`, line ~148)
- Test: `mcp/regions-preview.test.mjs` (append)

**Interfaces:**
- Produces: region labels never render above the SVG top edge; the MCP first-pass colour count matches the editor + docs (6).

**Note:** the editor (`index.html:26`) already defaults `colours` to `6`; only the MCP `startFromImage` default (`8`) is out of line, so this task changes only the MCP side.

- [ ] **Step 1: Write the failing test** — append to `mcp/regions-preview.test.mjs`:

```js
// U4: a part flush against the top edge must not render its label at a negative y (clipped outside the SVG).
{
  const html = emitRegionsPreview("data:,x", "0 0 100 100", [{ id: "part-top", role: "core", bbox: { x: 0, y: 0, w: 20, h: 10 } }]);
  const m = html.match(/<text x="[^"]*" y="([^"]*)"/);
  assert.ok(m && parseFloat(m[1]) >= 0, `label y is clamped to >= 0 (got ${m && m[1]})`);
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node regions-preview.test.mjs`
Expected: FAIL — label `y = -1`.

- [ ] **Step 3: Clamp the label** — in `mcp/regions-preview.mjs`, line ~22, replace the `<text … y=` term:

```js
      `<text x="${b.x + 1}" y="${Math.max(b.y - 1, 4)}" font-size="4" fill="${c}">${p.id}</text>`;
```

- [ ] **Step 4: Run it, verify it passes**

Run: `cd mcp && node regions-preview.test.mjs`
Expected: PASS.

- [ ] **Step 5: Unify the colour default** — in `mcp/tools.mjs` `startFromImage` signature (line ~148), change `colors = 8` → `colors = 6` to match the editor (`index.html` already `6`) and the docs. (No test — it is a default; every `*.test.mjs` caller passes `colors` explicitly, so the gate proves nothing regressed.)

- [ ] **Step 6: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add mcp/regions-preview.mjs mcp/tools.mjs mcp/regions-preview.test.mjs
git commit -m "fix: clamp region labels above the top edge; unify default colour count to 6"
```

---

### Task 12: README + docs refresh (U3, D1, D3, D4)

**Files:**
- Modify: `README.md` (MCP loop section ~185-206; repo-layout tree ~131-157; ADR count ~154)
- Modify: `docs/README.md` (ADR range line ~13)

**No code, no test** — a documentation-only commit. The gate still runs to confirm nothing else drifted.

- [ ] **Step 1: Fix the MCP loop description** (`README.md` ~185): replace "the agent runs this loop (six tools)" with the actual 10-tool guided flow. Use this list:

```
**3. Hand the agent an image and ask it to rig it.** The guided path (the `rig_mascot` prompt scripts it):

1. `forge_start_from_image` — vectorises, grades the input, proposes coarse parts; returns a `session`.
   Pass `states` to pick a reactivity tier (Simple `["idle"]` / Standard / Signals).
2. `assign_region` — carve each part you SEE (a 0..1 box + role); `set_part` — role/kind/pivot/preset per state.
3. `forge_propose` — a regions overlay + a per-part motion plan to confirm at a checkpoint.
4. `forge_apply_tweaks` / `forge_review` — inline rename/role fixes and a human approve/redo/editor checkpoint.
5. `forge_status` then `forge_emit` — validate + write a self-contained animated SVG (+ demo) you own.

`forge_start_from_layered_svg` and `forge_open_editor` complete the ten tools: a layered-SVG alt entry,
and a self-describing handoff into the browser rig editor (returns a ready `?rig=` URL).
```

- [ ] **Step 2: Fix the repo-layout tree** (`README.md` ~131-157): add the three missing surfaces to the tree:

```
├── mcp/                     ← the agent-rigging MCP server (its own deps; 10 guided tools)
├── tools/rig-editor/        ← the zero-dependency browser rig editor (ESM, no build)
├── tests/                   ← Playwright e2e for the editor + demos (dev-dep only)
```

- [ ] **Step 3: Fix ADR counts** — `README.md` line ~154 (`adr/` … `(0001–0009)`) → `(0001–0011)`; `docs/README.md` line ~13 (`(0001–0010)`) → `(0001–0011)`.

- [ ] **Step 4: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add README.md docs/README.md
git commit -m "docs: refresh MCP 10-tool loop, repo-layout tree, and ADR counts"
```

---

## Self-Review

**Spec coverage vs the audit:**
- Critical: C1 → Task 1. ✅
- Important: I1 → T2, I2 → T3, I3 → T4, I4 → T5. ✅
- UX: U1 → T10, U2 → T6, U3 → T12, U4/U5 → T11. ✅
- Minor: M1 → T8, M2 → T9, M3 → T7. ✅
- Docs: D1/D3/D4 → T12, D2 → T5, D5 → T4. ✅
- **Deliberately excluded** (not defects / out of "change only what the finding calls for"): M4 (documented behaviour note — folded into no task; add a one-line header comment only if the user wants it), A1/A2/A3 (refactors), D6 + hero images (owner capture), G-series test gaps are satisfied by the new tests in Tasks 1-11 except G6 (emit reduced-motion assertions) and G7 (removeState export) — left out as low-value; flag if wanted.

**Placeholder scan:** every code step shows the exact replacement text and the exact command + expected result. No TBD/TODO. ✅

**Type/name consistency:** `sanitizeId` (T3) is the existing export from `layer-ingest.js`; `parseLayered` returns `{viewBox, elements, parts, states}` (used identically in T2/T4/T10); `SIGNAL_STATES` order `["loading","success","error"]` is consistent across T5's code + test + docs; `selections`/`resolved.kind` in T10 match `exportRig`'s existing locals. ✅

**Risk notes for the executor:**
- T10 is the only golden-adjacent change — Step 5 explicitly re-runs the exporter golden. The golden regex (`exporter.test.mjs:85`) matches an attribute *subset* with `[^>]*` between anchors, and the new `data-role`/`data-kind`/`data-preset-*` attrs are appended *after* the existing `id → class → origin → pivot-x → pivot-y` order, so the match is preserved. `selections` is in scope before the call (no hoist).
- T5 changes a suggestion constant, not a golden; `model.test.mjs:148` (addState doesn't mutate the shared default) and the e2e "editor can add a signal state" (selects `loading`, still present) are unaffected by reordering.
- T3's `sanitizeId` lowercases and prefixes; the existing `head → part-head` and `part-*` assertions still hold (`sanitizeId` is idempotent on already-valid ids). No pre-existing test passes a mixed-case/space id that would now change.
- Tasks are independent and individually revertable; if any gate fails, that task's commit is dropped without touching the others.
