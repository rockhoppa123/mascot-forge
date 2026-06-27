# Curated Preset Library + App-Signal States — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Widen the mascot's expressive range in two sequenced phases — (1) a small curated batch of new motion presets for the existing states, then (2) opt-in app-signal states (`loading`/`error`/`success`) that bind animation to real application events, deepening the data-binding wedge.

**Architecture:** All motion lives in `tools/rig-editor/presets.js` as schema-v2 templates keyed `PRESETS[family][state][name]`, resolved by `presetsFor`/`recipeFor` and shared by the browser editor and the MCP. Phase 1 adds four templates to existing state buckets — zero schema/runtime change. Phase 2 reuses those templates for new states via a `STATE_FAMILY` alias (no preset duplication), declares the new states per-rig, and surfaces them through the MCP and editor; the runtime (`createMascot`) already binds an arbitrary state vocabulary, so no engine change.

**Tech Stack:** Node ESM (no build), `node:assert/strict` self-checks wired into `tools/check-all.ps1` (P5 rig-editor, P6 mcp), Playwright e2e (`tools/check-e2e.ps1`, separate from the node gate).

**Branch:** `feature/preset-library-and-signal-states` off `main`. Phase 1 is independently mergeable; Phase 2 may land on the same branch or split after the brainstorm checkpoint.

**Acceptance (Phase 1):** `presetsFor` offers the four new presets for their slots, each emits a valid schema-v2 recipe, `check-all.ps1` → `RESULT: PASS`, and the four appear in the editor's preset pickers (auto, via `refreshPresetPickers`).
**Acceptance (Phase 2):** a rig declared with `["idle","active","alert","loading","error","success"]` emits valid animations for all six (signal states reusing alert/active motion), the editor renders a control per declared state, `check-all.ps1` + `check-e2e.ps1` green, and the gallery doc shows an end-to-end signal→state binding.

**Execution tracking:** mirror the house convention — record per-task status in `.superpowers/sdd/progress.md` (Task N: complete, commit range, gate result) as each task lands, matching the prior plans' ledgers.

## Global Constraints

- The **runtime artifact stays zero-dependency**; new deps only in `mcp/`. Pure ESM, runs under `node`.
- **Whole-part CSS-transform animation only** — no opacity/colour/filter channels, no mesh, no path-splitting. Every keyframe is a `transform`. (The emitter only emits `transform:` — `emit.js` `emitCss`.)
- Tests use **`node:assert/strict`, no framework**, mirror existing `*.test.mjs`, wired into `tools/check-all.ps1`.
- **Back-compat:** existing role-keyed presets, the golden round-trip (`exporter.test.mjs`), and the buildable-slice goldens MUST stay green. New presets/states are additive.
- Demos must open on **`file://`** (inline SVG/CSS, no `fetch`).
- Match the existing terse top-of-file comment style and the `ch(offset, {r,sx,sy,x,y})` channel helper already in `presets.js`.
- Every new template must satisfy `assertValidRecipe` (presets.test.mjs): `channels[0].offset===0`, last channel `offset===1`, ≥2 channels, every keyframe has `offset`+`transform`, and carries `ease/repeat/yoyo/channels/reducedChannel`.

---

## File Structure

**Phase 1 (executable now):**
- `tools/rig-editor/presets.js` (modify) — 4 new template consts + slot into `PRESETS`.
- `tools/rig-editor/presets.test.mjs` (modify) — update 2 exact-list assertions; add validity checks.
- `docs/gallery/README.md` (modify) — preset reference table ("what each does").

**Phase 2 (after a brainstorm checkpoint — see Phase 2 header):**
- `tools/rig-editor/presets.js` (modify) — `STATE_FAMILY` alias; resolve state in `presetsFor`/`recipeFor`.
- `tools/rig-editor/presets.test.mjs` (modify).
- `tools/rig-editor/model.js` (modify) — `states` already a param; add `STANDARD_STATES` export listing the opt-in vocabulary.
- `mcp/tools.mjs` + `mcp/server.mjs` (modify) — `startFromImage` accepts optional `states`; `set_part` presets accept `loading/error/success`.
- `tools/rig-editor/index.html` + `app.js` (modify) — render state buttons + preset pickers from `model.states()` instead of hardcoded idle/active/alert.
- `runtime/mascot-state.js` (no change) — already binds arbitrary states; used by the doc example.
- `docs/gallery/README.md` (modify) — signal→state binding example.

---

# PHASE 1 — Curated preset batch (executable now)

Four new presets, each filling a named gap, all transform-only. Defined as consts beside the existing
shared templates (`SPIN`/`WAVE`/`TALK` pattern) and slotted into `PRESETS`:

| Preset | Slot | Gap it fills |
|---|---|---|
| `sway` | `core.idle` | gentle whole-body lean — for rigid/non-creature subjects where `breathe` looks wrong |
| `glance` | `accent.idle` | eyes dart L/R — more characterful "alive" idle than `blink` |
| `lean` | `core.active` (new bucket) | body tilts into motion — pairs with limb `walk` so the *whole* mascot moves |
| `jolt` | `accent.alert` | sharp upward startle — the only alert preset using `translateY` (vertical), distinct from shake/recoil/pulse |

The editor's preset pickers populate from `presetsFor(role, state)` (`app.js` `refreshPresetPickers`), so
these appear in the GUI automatically — no `app.js` change. Only `core.active` is a brand-new bucket.

## Task 1: add the four curated presets

**Files:** Modify `tools/rig-editor/presets.js`, `tools/rig-editor/presets.test.mjs`.

**Interfaces:**
- Produces: `presetsFor("core","idle")` → `["breathe","sway"]`; `presetsFor("core","active")` → `["lean"]`; `presetsFor("accent","idle")` includes `"glance"`; `presetsFor("accent","alert")` includes `"jolt"`. Each is a valid schema-v2 recipe via `recipeFor(role, state, name, partId)`.

- [ ] **Step 1: Write the failing tests.** In `tools/rig-editor/presets.test.mjs`, (a) update the two exact-list assertions, (b) append validity checks. Replace lines that read:

```javascript
assert.deepEqual(presetsFor("core", "idle"), ["breathe"]);
```
```javascript
assert.deepEqual(presetsFor("core", "active"), [], "a core preset is idle-only");
```
and (near the bottom) the back-compat pair:
```javascript
assert.deepEqual(presetsFor("core", "idle"), ["breathe"], "core/idle still exactly breathe");
assert.deepEqual(presetsFor("core", "active"), [], "core/active still empty");
```
with their new expected values:
```javascript
assert.deepEqual(presetsFor("core", "idle"), ["breathe", "sway"], "core/idle now offers sway too");
```
```javascript
assert.deepEqual(presetsFor("core", "active"), ["lean"], "core gains an active lean");
```
```javascript
assert.deepEqual(presetsFor("core", "idle"), ["breathe", "sway"], "core/idle = breathe + sway");
assert.deepEqual(presetsFor("core", "active"), ["lean"], "core/active = lean");
```
Then append a new block (uses the file's existing `assertValidRecipe`):
```javascript
// Phase-1 curated batch: four new transform-only presets, each a valid schema-v2 recipe.
for (const [role, state, name] of [["core", "idle", "sway"], ["accent", "idle", "glance"], ["core", "active", "lean"], ["accent", "alert", "jolt"]]) {
  assert.ok(presetsFor(role, state).includes(name), `${name} offered for ${role}/${state}`);
  assertValidRecipe(recipeFor(role, state, name, "part-x"), "part-x");
}
// jolt is the vertical alert (translateY); sway/lean are rotational
assert.ok(recipeFor("accent", "alert", "jolt", "p").keyframes.some((k) => /translateY/.test(k.transform)), "jolt moves on Y");
assert.ok(recipeFor("core", "idle", "sway", "p").keyframes.some((k) => /rotate/.test(k.transform)), "sway rotates");
```

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/presets.test.mjs` (expect: `sway`/`lean` lookups fail, deepEqual mismatch).

- [ ] **Step 3: Implement.** In `tools/rig-editor/presets.js`, add four consts beside `SPIN`/`WAVE`/`TALK` (use the existing `ch` helper):

```javascript
const SWAY = { // core idle alt: slow gentle whole-part lean — suits rigid subjects where breathe looks wrong
  durationMs: 3200, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "rotate(-2deg)" }, { offset: "50%", transform: "rotate(2deg)" }],
  channels: [ch(0, { r: -2 }), ch(0.5, { r: 2 }), ch(1, { r: -2 })],
  reduced: { transform: "rotate(0deg)" }, reducedChannel: ch(0, {}),
};
const GLANCE = { // accent idle alt: eyes dart left/right then settle — more characterful than a blink
  durationMs: 4000, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 30%, 100%", transform: "translateX(0)" }, { offset: "45%", transform: "translateX(-2px)" }, { offset: "70%", transform: "translateX(2px)" }],
  channels: [ch(0, {}), ch(0.3, {}), ch(0.45, { x: -2 }), ch(0.7, { x: 2 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const LEAN = { // core active: body tilts into motion — pairs with limb walk so the WHOLE mascot moves
  durationMs: 520, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "rotate(-3deg)" }, { offset: "50%", transform: "rotate(3deg)" }],
  channels: [ch(0, { r: -3 }), ch(0.5, { r: 3 }), ch(1, { r: -3 })],
  reduced: { transform: "rotate(2deg)" }, reducedChannel: ch(0, { r: 2 }),
};
const JOLT = { // accent alert: a sharp upward startle (the only alert preset using translateY)
  durationMs: 360, timing: "cubic-bezier(.2, .7, .3, 1)", iteration: "infinite", ease: "power2.out", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "translateY(0)" }, { offset: "35%", transform: "translateY(-6px)" }],
  channels: [ch(0, {}), ch(0.35, { y: -6 }), ch(1, {})],
  reduced: { transform: "translateY(-3px)" }, reducedChannel: ch(0, { y: -3 }),
};
```
Then slot them into `PRESETS`:
- In `PRESETS.core.idle`, add `sway: SWAY` after the `breathe` entry.
- In `PRESETS.core`, add a new sibling bucket after `idle`: `active: { lean: LEAN },`.
- In `PRESETS.accent.idle`, add `glance: GLANCE` (after `blink`).
- In `PRESETS.accent.alert`, add `jolt: JOLT` (after `recoil`).

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/presets.test.mjs && node tools/rig-editor/exporter.test.mjs` (golden round-trip stays green — no existing recipe changed), then the full gate `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS`. Before committing, grep for any other code that assumed `core` has no `active` bucket: `grep -rn 'core.*active' tools/rig-editor/*.test.mjs` — only the two assertions changed in Step 1 should reference it.

- [ ] **Step 5: Commit** — `git add tools/rig-editor/presets.js tools/rig-editor/presets.test.mjs && git commit -m "feat: curated preset batch (sway, glance, lean, jolt)"`

## Task 2: preset reference in the gallery doc

**Files:** Modify `docs/gallery/README.md`.

**Interfaces:** none (documentation deliverable). Mirrors the propose-overlay key's "what each does" language so the two sources agree.

- [ ] **Step 1: Implement.** Add a "Motion presets" section to `docs/gallery/README.md`: a table of every preset grouped by role+state with a one-line "what it does", including the four new ones (`sway` — gentle idle lean; `glance` — eyes dart; `lean` — body tilts while active; `jolt` — upward startle on alert). Note that the editor's preset pickers and the `forge_propose` overlay key are generated from the same `presetsFor`, so this table is the human-readable mirror.

- [ ] **Step 2: Commit** — `git add docs/gallery/README.md && git commit -m "docs: motion-preset reference table"`

---

# PHASE 2 — Opt-in app-signal states (loading / error / success)

> **CHECKPOINT — run `superpowers:brainstorming` before Task 4.** Task 3 (preset aliasing) is independent
> and executable immediately. Tasks 4–6 span model + MCP + editor + docs and hinge on one design fork:
> **how a rig opts into extra states.** This plan's default is **(a) declare at start** (`startFromImage({ states })`),
> chosen because it keeps the rig's vocabulary immutable and matches `createModel({ states })` and
> `createMascot({ states })`. Confirm or replace this in the brainstorm before executing Tasks 4–6.

**Why this is the strategic phase:** the product wedge is "animation states bind to your app's live data."
Three states bound to telemetry prove the mechanism; `loading`/`error`/`success` are the universal
dashboard signals that make the binding *obviously* useful. The runtime already supports an arbitrary
state vocabulary (`createMascot({ states })`, `states[0]` = resting, priority = vocabulary order) — so no
engine change. The work is: reuse existing motion for the new states, let a rig declare them, surface them
in the two authoring paths, and document the binding.

## Task 3: `STATE_FAMILY` alias — new states reuse existing motion (no duplication)

**Files:** Modify `tools/rig-editor/presets.js`, `tools/rig-editor/presets.test.mjs`.

**Interfaces:**
- Produces: `presetsFor`/`recipeFor` resolve a state through `STATE_FAMILY` before lookup, so a new state reuses an existing state's preset table. Mapping: `error→alert`, `loading→active`, `success→active`. Example: `recipeFor("accent","error","shake","p")` resolves to the `accent.alert.shake` template; `presetsFor("limb","loading")` returns the `limb.active` list (includes `spin`).

- [ ] **Step 1: Write the failing test** — append to `presets.test.mjs`:
```javascript
// app-signal states reuse an existing state's motion via STATE_FAMILY (error→alert, loading/success→active)
{
  assert.deepEqual(presetsFor("accent", "error"), presetsFor("accent", "alert"), "error reuses alert's accent presets");
  assert.deepEqual(presetsFor("limb", "loading"), presetsFor("limb", "active"), "loading reuses active's limb presets");
  assert.ok(presetsFor("limb", "loading").includes("spin"), "a wheel can spin while loading");
  assertValidRecipe(recipeFor("accent", "error", "shake", "part-x"), "part-x");
  assertValidRecipe(recipeFor("limb", "success", "jump", "part-x"), "part-x"); // jump is in limb.active
}
```
(`jump` is confirmed present in `limb.active` in `presets.js` — `spin, bounce, shake, nod, float, jump, wobble` — so `success`→`active` resolves it.)

- [ ] **Step 2: Run, verify FAIL** — `node tools/rig-editor/presets.test.mjs`.

- [ ] **Step 3: Implement.** In `presets.js`, add near `KIND_FAMILY`:
```javascript
// An app-signal state reuses an existing state's preset table — error reads like alert, loading/success
// like active. Keeps one motion library; new states add meaning, not duplicate templates.
const STATE_FAMILY = { error: "alert", loading: "active", success: "active" };
const resolveState = (state) => STATE_FAMILY[state] || state;
```
Then in `presetsFor`, change the state lookup to `byState[resolveState(state)]`; in `recipeFor`, change the template lookup to `PRESETS[role][resolveState(state)] && PRESETS[role][resolveState(state)][presetName]`. Keep `kindDefaultPreset`/`resolveFamily` unchanged.

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/presets.test.mjs && node tools/rig-editor/exporter.test.mjs` (existing idle/active/alert lookups are unaffected — `resolveState` is identity for them).

- [ ] **Step 5: Commit** — `git add tools/rig-editor/presets.js tools/rig-editor/presets.test.mjs && git commit -m "feat: STATE_FAMILY alias — app-signal states reuse existing motion"`

## Task 4: declare app-signal states on a rig (model + MCP)

**Files:** Modify `tools/rig-editor/model.js`, `tools/rig-editor/model.test.mjs`, `mcp/tools.mjs` (`startFromImage`, `setPart`), `mcp/server.mjs`. (Split point if the MCP surface proves large: 4a = model exports + `startFromImage({states})`; 4b = `set_part` multi-state presets + `rigStatus` per declared state.)

**Interfaces:**
- Produces: `export const STANDARD_STATES = ["idle","active","alert"]` and `export const SIGNAL_STATES = ["loading","error","success"]` from `model.js`. `startFromImage({ states })` accepts an optional state array (defaults to `STANDARD_STATES`) and builds the model with it. `set_part`'s `presets` object accepts optional `loading`/`error`/`success` keys in addition to `idle`/`active`/`alert`; a preset for an undeclared state is rejected with a clear error (already the behaviour of `model.setPreset`, which throws on an unknown state).

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs` (this targets the genuinely-new behaviour: the MCP accepting a declared signal state at start and a preset for it — both fail today). Read the file first for `startFromImage`/`setPart`/`forgeStatus` import style and the `blocksPngBase64()` fixture:
```javascript
// app-signal states: a session can be started with extra states and set_part fills a preset for them
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4, states: ["idle", "loading", "error"] });
  assert.deepEqual(s.states, ["idle", "loading", "error"], "start declares the signal-state vocabulary");
  const partId = s.parts[0].id;
  setPart({ session: s.session, partId, role: "limb", presets: { loading: "spin" } });
  const st = forgeStatus({ session: s.session });
  // the loading state now has coverage (rigStatus tracks per declared state)
  assert.ok(st.rigStatus.loading >= 1, "set_part applied a preset to the loading state");
}
```
(If `startFromImage`'s return doesn't currently expose `states`, that assertion is part of the red — add it in Step 3. Confirm the exact `rigStatus` shape against `forgeStatus` when reading the file; if `rigStatus` is keyed only by idle/active/alert today, extending it to declared states is part of this task.)

- [ ] **Step 2: Run, verify FAIL** — `node mcp/tools.test.mjs` (expect: `startFromImage` ignores `states` / `set_part` drops the `loading` key → assertion fails). Also append the `model.test.mjs` contract guard below and confirm it passes (it locks behaviour `createModel` already has):
```javascript
{ // model already supports a custom vocabulary — guard it so Phase 2 can rely on it
  const m = createModel({ viewBox: "0 0 10 10", rects: [{ id: "r0", x: 0, y: 0, w: 10, h: 10, fill: "#000", part: "part-a" }], parts: { "part-a": { role: "core" } }, states: ["idle", "loading", "error"] });
  assert.deepEqual(m.states(), ["idle", "loading", "error"]);
  m.setPreset("loading", "part-a", "spin");
  assert.equal(m.preset("loading", "part-a"), "spin");
  assert.throws(() => m.setPreset("success", "part-a", "jump"), /state/, "an undeclared state is rejected");
}
```

- [ ] **Step 3: Implement.** In `model.js`: add the two exported const arrays; leave `createModel`'s `states` param as-is. In `mcp/tools.mjs` `startFromImage`, accept `states` and pass it to `createModel` (default `STANDARD_STATES`); store on the session so `setPart`/`forgeStatus`/`forgeEmit` see it. In `mcp/tools.mjs` `setPart`, when applying `presets`, iterate all provided state keys (not a fixed idle/active/alert list). In `mcp/server.mjs`: extend `set_part`'s `presets` zod object with `loading`, `error`, `success` (each `z.string().nullable().optional()`); add an optional `states: z.array(z.string()).optional()` to `forge_start_from_image`; note in both descriptions that signal states reuse alert/active motion and must be declared at start.

- [ ] **Step 4: Run, verify PASS** — `node tools/rig-editor/model.test.mjs && node mcp/tools.test.mjs && node mcp/protocol.test.mjs` (tool count unchanged at 10).

- [ ] **Step 5: Commit** — `git add tools/rig-editor/model.js tools/rig-editor/model.test.mjs mcp/tools.mjs mcp/server.mjs && git commit -m "feat: declare app-signal states at start; set_part presets accept loading/error/success"`

## Task 5: editor surfaces declared states dynamically

**Files:** Modify `tools/rig-editor/index.html`, `tools/rig-editor/app.js`; add/extend a Playwright e2e under the existing harness. (Cohesive single task — the markup change and its `app.js` render loop must land together or the editor breaks; the e2e is its acceptance gate, not a separable task.)

**Interfaces:**
- Produces: the preview state buttons (`#states`) and the per-state preset pickers (`#partedit fieldset`) are generated from `model.states()` instead of the hardcoded `idle`/`active`/`alert` trio, so a rig declaring `loading`/`error`/`success` shows those controls.

- [ ] **Step 1: Write the failing test** — add a Playwright spec under the existing e2e dir (read an existing spec first for the `test`/`expect` import + how it serves the editor and loads a rig). Concrete assertions:
```javascript
// a rig declaring a signal state renders its control + picker
test("editor surfaces declared signal states", async ({ page }) => {
  await loadEditorWithStates(page, ["idle", "active", "alert", "loading"]); // helper: load a rig whose model.states() includes loading
  await expect(page.locator('#states-row button', { hasText: "loading" })).toHaveCount(1);
  await expect(page.locator('#preset-pickers #preset-loading')).toHaveCount(1);
  // and the existing trio still renders (regression guard for the de-hardcode)
  for (const s of ["idle", "active", "alert"]) await expect(page.locator(`#states-row button`, { hasText: s })).toHaveCount(1);
});
```

- [ ] **Step 2: Run, verify FAIL** — `pwsh -NoProfile -File tools/check-e2e.ps1` (selectors `#states-row`/`#preset-pickers` don't exist yet).

- [ ] **Step 3: Implement.** In `index.html`, remove the three hardcoded `<button data-state>` and the three hardcoded `<label>…<select id="preset-*">` and replace with empty containers (`#states-row`, `#preset-pickers`). In `app.js`, after a model loads, render one state button per `model.states()` and one labelled picker per state (id `preset-<state>`), wiring the same handlers the static markup used. Keep `idle` first/active by default (it is `states()[0]`).

- [ ] **Step 4: Run, verify PASS** — `pwsh -NoProfile -File tools/check-e2e.ps1 && pwsh -NoProfile -File tools/check-all.ps1`.

- [ ] **Step 5: Commit** — `git add tools/rig-editor/index.html tools/rig-editor/app.js tests/ && git commit -m "feat(editor): render state controls from the rig's declared states"`

## Task 6: signal→state binding example + doc

**Files:** Modify `docs/gallery/README.md`.

**Interfaces:** none (documentation). Uses the unchanged `runtime/mascot-state.js` `createMascot`.

- [ ] **Step 1: Implement.** Add an "App-signal states" section: a runnable `createMascot({ states: ["idle","active","alert","loading","error","success"], root })` snippet with a `mapFn` mapping real signals to states (`deploy_started→loading`, `ci_failed→error`, `deploy_ok→success`), noting vocabulary order = priority and `states[0]` = resting. Show the matching rig setup (`startFromImage({ states })` + `set_part` presets for the signal states) so the doc is end-to-end.

- [ ] **Step 2: Commit** — `git add docs/gallery/README.md && git commit -m "docs: signal→state binding (loading/error/success) end-to-end"`

---

## Self-Review

**Spec coverage:** Curated presets → Tasks 1–2. State-reuse aliasing → Task 3. State declaration (model+MCP) → Task 4. Editor surfacing → Task 5. Runtime binding doc → Task 6. The two findings that motivated this (more range without diluting quality; states that deepen the data-binding wedge) are both addressed, sequenced presets-first. ✓

**Placeholder scan:** Tasks 1, 3, 4 carry complete code. Task 2/6 are documentation deliverables with explicit content. Task 5 is concrete but UI/e2e-scoped (de-hardcode + render from `model.states()`), with a read-first note for the e2e harness. Task 3's fixture carries a self-check note to confirm `jump` exists for `limb` before using it. No TBD/placeholder steps.

**Type consistency:** `presetsFor(roleOrKind, state)` / `recipeFor(roleOrKind, state, name, partId)` used consistently; `resolveState(state)` added in Task 3 and relied on implicitly by Tasks 4–5 (declared states resolve to real templates). `STANDARD_STATES`/`SIGNAL_STATES` defined in Task 4 and consumed by the MCP + doc. `model.states()` is the single source for Task 5's UI.

**Open risks:**
- Task 1 changes two **exact-list** assertions (`presetsFor("core","idle")`, `presetsFor("core","active")`) — intentional; the new core.active bucket is the only structural change. Caught by Step 4's gate.
- Task 3's `resolveState` must be **identity** for idle/active/alert or it breaks every existing rig — the golden round-trip (`exporter.test.mjs`) is the gate.
- Task 5 de-hardcodes the editor's state controls — the **biggest regression risk** is the existing 3-state e2e and the static-markup handlers. Mitigation: the new spec asserts idle/active/alert still render (regression guard in Step 1), and `check-e2e.ps1` runs the full pre-existing suite in Step 4.
- Phase 2 Tasks 4–6 depend on the **state-declaration design fork** — the brainstorm checkpoint at the Phase 2 header must lock "declare at start" (or a replacement) before they execute. Task 3 has no such dependency and can ship with Phase 1.

**Scope note (writing-plans Scope Check):** Phase 2 spans model/MCP/editor/runtime-doc. It is kept in this
document per the "presets now, states as a planned next" decision, but Tasks 4–6 are gated behind the
brainstorm checkpoint and could be split into their own plan if the state-declaration design proves larger
than "an optional `states` array at start."
