# Phase 3 (re-planned) — Drop-zone: verify the product claim + reach subject-aware motion

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (or
> executing-plans). TDD per task. Steps use checkbox (`- [ ]`) tracking.
>
> **Status:** Re-plan of Task 9 from `2026-06-25-expanded-states-and-reach.md`, written after Phases
> 1–2 shipped to `main` (merge `aacacdf`). Optimised with /plan-optimizer (trajectory 58→78→88→89).

## The reframing (read this first)

The original Task 9 ("build a browser drop-zone + Playwright e2e + a `drop.html` + an example
gallery") was written before Phases 1–2 landed. **Most of it already exists on `main`:**

| Original Task 9 ask | Reality on `main` |
|---|---|
| browser drop-zone | **exists** — `#dropzone` + drag/drop handlers in `app.js` → `loadFile` |
| decode PNG → vectorize → segment → preview → export | **exists** — `loadFile`/`loadPng` reuse the node-tested pure pipeline (`vectorizeRaster`, `segment`, `exportRig`) |
| Playwright e2e harness | **exists** — `tests/` (dep-isolated), `playwright.config.mjs` serves repo root on :4179, 11 passing tests |
| example-input gallery (3b) | **done** — `docs/gallery/README.md` (Phase-2 Task 8) |
| a standalone `drop.html` | **redundant** — the editor IS the "editor mode" the spec permitted |

So Phase 3 is **not** "build a drop-zone." It is two narrow, honest jobs:

1. **PROVE** the one untested product claim. The headline promise — *a non-dev drops a PNG and gets
   an animated SVG, no terminal* — has **zero** test coverage: every existing e2e drives
   `#loadexample`, never the file/drop path. One Playwright test closes that gap.
2. **REACH** Phase-2's subject-aware motion from the browser. Part `kind` is MCP-only today; the
   editor has no `kind` selector, so a dropped mascot's wheel can't auto-`spin`. (The `spin` preset
   itself is already pickable from the preset dropdown for limb parts — `presetsFor` drives it — so
   this is a small surfacing job, not new motion.)

**Dropped from the original Task 9:** the standalone `drop.html` (duplicates existing wiring); the
gallery (already shipped).

## Global Constraints (unchanged from the spec)

- Runtime artifact stays **zero-dependency**; the browser editor adds no deps. Playwright stays in
  `tests/` (its own `package.json`, out of the repo root so the project stays dep-free).
- **No ML, no path-splitting, no mesh deformation** — whole-part CSS transforms only.
- **Back-compat:** the 11 existing e2e tests AND the node gate (`tools/check-all.ps1`, P1–P6) stay
  green. `kind` in the editor is an overlay on the existing part-edit flow, not a rewrite.
- Demos/exports stay **file://-safe** (no `fetch`).
- Match the existing terse comment style; mirror the existing `*.spec.mjs` Playwright patterns.

---

## Task 1 — e2e: drop a PNG → rig previews → export downloads an SVG (the product claim)

**Files:** `tests/e2e/drop-rig.spec.mjs` (new); `tests/e2e/fixtures/blocks.png` (new) +
`tests/e2e/fixtures/make-blocks.mjs` (new, the zero-dep generator that produced it).

**Interfaces consumed (already on main):** `#file` input and `#dropzone` both call `loadFile`;
`loadPng` → `vectorizeRaster` → `segment` → `loadText`; `#exportanim` downloads `*-mascot.svg`;
`#parts li`, `#status`, `#preset-active` are existing selectors.

**Key decision — `setInputFiles`, not synthetic drag-drop.** `#file` and `#dropzone` call the *same*
`loadFile`, so `page.setInputFiles('#file', fixture)` exercises the identical PNG→rig path with none
of Playwright's `DataTransfer`-synthesis flakiness. Cover the dropzone's own `drop` listener in a
*separate, second* test (fire a `drop` event with a constructed `DataTransfer`) so its flakiness can
never block the core product-claim assertion.

- [ ] **Step 1 — the fixture, reproducibly (zero-dep).** Write `make-blocks.mjs`: a Node script using
  only `node:zlib` + `node:fs` to emit a valid 32×32 PNG of 4 distinct solid colour quadrants (so it
  grades `good`/`borderline` and segments into ≥2 parts). Run it to produce `blocks.png`; commit both
  the script (so the fixture is regenerable) and the binary. *No `pngjs` — `tests/` must not depend on
  `mcp/node_modules`.*
- [ ] **Step 2 — write the failing spec** (`drop-rig.spec.mjs`), mirroring `rig-editor.spec.mjs`:
  - `page.on("pageerror", …)` → collect uncaught errors.
  - `goto("/tools/rig-editor/index.html")`; `setInputFiles("#file", fixtures/blocks.png)`.
  - `await expect(page.locator("#parts li")).toHaveCount(n)` with `n ≥ 2` (proves vectorize+segment
    actually ran — not a silent canvas no-op).
  - `await expect(page.locator("#status")).toContainText("Vectorised")`.
  - export: `Promise.all([waitForEvent("download"), click("#exportanim")])`; assert
    `suggestedFilename()` matches `/mascot\.svg$/`.
  - assert `errors` is empty.
- [ ] **Step 3 — run red** (`cd tests && npx playwright test drop-rig`) — fails before the fixture/spec
  exist or if the path is broken.
- [ ] **Step 4 — run green.** Fix any real wiring gap the test exposes (the point of the task is to
  find one if it's there).
- [ ] **Step 5 — commit** — `feat(test): e2e proves the drop-a-PNG → animated-SVG product path`.

**Risk:** `createImageBitmap` + canvas `getImageData` must work in headless Chromium — they do in
Playwright's bundled Chromium, but no existing test decodes an image. The concrete `#parts` count
assertion makes a silent canvas failure fail loudly rather than passing on an empty rig.

---

## Task 2 — surface `kind` in the editor (reach wheel→spin from the drop path)

**Files:** `tools/rig-editor/index.html` (+ `tools/rig-editor/app.js`); extend
`tests/e2e/drop-rig.spec.mjs`.

**Interfaces:** consumes `KINDS` + `model.setKind` (already on main, Phase-2 Task 4); reuses
`presetsFor`/`recipeFor`. Produces a `#kind` `<select>` in the part-edit panel.

- [ ] **Step 1 — write the failing e2e assertion** (append to `drop-rig.spec.mjs`): after the drop,
  select a limb part, `selectOption("#kind", "wheel")`, assert `#preset-active` now holds a `spin`
  preset and `#exportanim` still downloads an SVG. Run red.
- [ ] **Step 2 — UI.** Add `<select id="kind">` (option `(none)` + the 7 `KINDS`) to the part-edit
  panel in `index.html`; in `app.js`, on change: snapshot (undo), `model.setKind(selected, value)` (or
  clear to none), re-render. Import `KINDS` from `model.js`.
- [ ] **Step 3 — kind-aware default (convenience, single source of truth).** When a kind is set and
  the part has no preset in the kind's home state, auto-select it (`wheel→active/spin`,
  `flag→alert/wave`, `mouth→active/talk`) by reading from `presetsFor` — do **not** hard-code a second
  mapping table; if a shared `kindDefault()` helper is cleaner, lift one into `presets.js` and have
  both the editor and `mcp/tools.mjs` `defaultPresetFor` call it. The user can still override via the
  preset dropdowns.
- [ ] **Step 4 — run green** (`npx playwright test drop-rig`) + the existing suite
  (`npx playwright test`) stays green.
- [ ] **Step 5 — commit** — `feat(editor): kind selector surfaces subject-aware motion (wheel→spin)`.

**Scope guard (ship-the-smaller-thing):** the preset dropdowns *already* list kind-family presets via
`presetsFor`, so a non-dev can pick `spin` manually today. Task 2 adds only the selector + the
auto-default convenience. If Step 3's wiring balloons, ship Step 2 alone (kind persisted into the
rig + manual preset pick) and defer auto-default to a follow-up — do not let a convenience grow into a
refactor of preset selection.

---

## Task 3 — make the proof runnable and discoverable (it is not in the node gate)

**Files:** `tests/README.md` (new); optional `tools/check-e2e.ps1` (thin wrapper).

The node gate (`check-all.ps1`, P1–P6) is deliberately node-only and dependency-free (the repo root
has no `package.json`, enforced by `check-buildable-slice`). The e2e correctly lives apart in
`tests/`. The gap is discoverability, not coverage.

- [ ] **Step 1** — `tests/README.md`: the one-liner to run the proof
  (`cd tests && npm install && npx playwright test`), that it serves the repo root on :4179, and which
  test covers the drop-zone product claim. State explicitly that Playwright is **intentionally not**
  wired into `check-all.ps1` (it would drag a browser + dep into the zero-dep gate).
- [ ] **Step 2 (optional)** — `tools/check-e2e.ps1`: a 3-line wrapper that runs the e2e, so the
  command is as discoverable as the node gate. Reference it from the gate's closing output text (a
  print line, not a dependency).
- [ ] **Step 3 — commit** — `docs(test): document how to run the browser e2e proof`.

---

## Acceptance — Phase 3 is done when

- `cd tests && npx playwright test` is green, **including** the new drop→rig→export test — the product
  claim is verified, not merely asserted.
- A dropped PNG with a part marked `kind:"wheel"` exports an SVG whose CSS contains `rotate(360deg)`
  (subject-aware motion reachable end-to-end without a terminal).
- The node gate (`tools/check-all.ps1`) stays `RESULT: PASS`; the 11 pre-existing e2e tests stay green.
- No standalone `drop.html`; no new runtime dependency; no second kind→preset mapping table.

## Out of scope / deferred

- A consumer-grade "one-click, no-editor" landing funnel — the editor mode satisfies the spec's
  acceptance; a simplified funnel is a separate product decision, not a test/reach gap.
- Wiring Playwright into the main gate — kept out to preserve the zero-dep node gate.

## Self-review

- **Spec coverage:** 3a drop-zone → exists; Phase-3 work is verify (Task 1) + reach (Task 2) +
  discoverability (Task 3). 3b gallery → already shipped (Task 8). ✓
- **Constraint check:** no runtime dep added; Playwright isolated in `tests/`; back-compat gated by the
  node gate + the 11 existing e2e; file:// safety untouched. ✓
- **Open risk:** Task 1's headless canvas decode (mitigated by the concrete parts-count assertion);
  Task 2's scope creep (bounded by the ship-the-smaller-thing guard).
