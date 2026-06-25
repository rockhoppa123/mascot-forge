# Expanded States, Subject-Aware Animation, First-Impression & Reach — Design Spec

**Date:** 2026-06-25
**Status:** Approved (design); pending implementation plan
**Scope:** Three phased subsystems that make mascot-forge usable and impressive for an agnostic user:
(1) fix the first impression, (2) open + expand the animation/state system (the data-binding wedge),
(3) broaden reach. One spec, phased so each ships independently.

---

## 1. Context

mascot-forge turns flat art into an owned, data-reactive animated SVG via an agent-driven MCP. After
the guided-route work (Phases 1–5, on `main`), live testing exposed three things that read as "the tool
is bad" but aren't the rig engine failing:

- **Worst-case input.** A flat single-colour silhouette (Cat.png) can't be auto-separated and looks
  blocky; the user finds out *after* investing. The silhouette advisory exists but fires late.
- **Thin, creature-centric motion.** Only 3 fixed states (idle/active/alert) and a small preset set
  (breathe/walk/blink/pulse/recoil/twitch/wag). The land-rover proves it: its "wheels" **rock ±10°**
  (the leg-walk swing renamed) instead of **spinning** — there is no `spin`, and presets aren't
  subject-aware. The data-binding wedge is under-exploited.
- **Viewing friction.** The hero `mcp-live-demo.html` is blank on `file://` (it `fetch()`es the SVG —
  blocked for local files); the standalone emitted demo works because it inlines its SVG.

Current motion lives in `tools/rig-editor/presets.js` (role × state → recipe templates); states are
`DEFAULT_STATES = ["idle","active","alert"]` in `tools/rig-editor/model.js`; the validator
(`tools/rig-editor/validator.js`) requires every state to have ≥1 animation; the runtime
(`runtime/mascot-state.js`) already binds **arbitrary** states to a data source.

---

## 2. Goals & non-goals

**Goals**
- A new user knows *before rigging* whether their input will work, and sees a polished result with no
  server.
- Motion that fits the subject (a wheel spins, a flag waves), from a richer library.
- States are open: a user declares their own states and binds app signals to them.
- Each phase is independently shippable and testable.

**Non-goals**
- No change to the zero-dep *runtime* artifact (integration deps stay in `mcp/`).
- No ML. No skeletal/mesh deformation. No path-splitting (rejected — tears the whole-part model).
- Phase 2 does not build a full app-integration framework — the runtime already binds states; we
  supply the vocabulary, the subject-aware motion, and documented binding patterns.

**Success criteria**
- Phase 1: `forge_start_from_image` returns a graded input verdict; the emitted showcase opens on
  `file://` and shows the mascot, the original, state controls, an auto-play, and a download button.
- Phase 2: a wheel part emits a continuous `spin`; a rig can declare a custom state (e.g. `error`) with
  a `shake`, and it validates and animates; the land-rover re-rigs without the wheels-rock.
- Phase 3: a PNG dropped in a browser page rigs and previews without a terminal; a gallery documents
  good inputs.

---

## 3. Phase 1 (Tier 1) — First impression

### 1a. Pre-flight input grade
- `forge_start_from_image` (and the underlying `startFromImage`) returns `inputGrade`:
  `{ grade: "good" | "borderline" | "silhouette", reason, recommendation }`.
- Deterministic heuristic from the vectorised model: distinct opaque fill count + dominant-element area
  share. `silhouette` when ≤2 distinct fills or one element > 0.8 of opaque area; `good` when ≥4
  distinct fills and no single element dominates; else `borderline`.
- The MCP tool description instructs the agent to surface the grade to the user *before* assigning
  regions. Reuses/[supersedes] the `forgePropose` silhouette advisory (keep one source of truth — move
  the heuristic into a shared `gradeInput(model)` helper used by both).

### 1b. Polished self-contained showcase
- Upgrade `tools/rig-editor/emit.js` `emitDemoHtml` (or a new `emitShowcaseHtml`) to a product-grade,
  **fully inlined** page (no `fetch`, no external CSS): large stage, original image side-by-side,
  per-state buttons, an **auto-cycle "play"** toggle that walks the states on a timer (simulating a
  live feed), and a **Download SVG** button (a data-URL anchor of the inlined SVG). Keep
  `prefers-reduced-motion` support. Must open correctly on `file://`.

---

## 4. Phase 2 (Tier 2) — Open + expanded, subject-aware (centerpiece)

### 2a. Subject-aware preset families
- Add an optional part `kind` (`wheel | flag | limb | eye | mouth | body | accent`) to the model part
  metadata (`model.js` `normPart`) and to `set_part` (mcp). Default `kind` inferred from role + id
  (extends today's `defaultPresetFor`).
- Restructure `presets.js` so presets are addressable by **(kind|role, state, name)**. New motion:
  - `wheel → spin` — **continuous 360° rotation** (`rotate(360deg)`, `linear`, `transform-origin`
    centre), the headline fix.
  - `flag → wave`, `mouth → talk`, plus generic additions usable by any part: `bounce`, `shake`,
    `nod`, `float`, `jump`, `wobble`.
- `recipeFor` gains kind-awareness; existing role-keyed presets remain for back-compat (the goldens
  must still validate).

### 2b. Open state vocabulary
- Forge tools accept an optional `states` list (defaulting to `["idle","active","alert"]`); the model
  carries the rig's declared states. `set_part` presets validate against the rig's declared states, not
  a hardcoded three.
- **Validator change:** require ≥1 animation in the rig overall, and **warn** (not fail) on any declared
  state with no animation. The plain-English `forge_emit` message is reused for the warning. The
  existing goldens (which cover all three default states) stay valid.

### 2c. Signal binding (docs + thin example)
- A documented pattern + a runnable example showing `createMascot` mapping app signals → declared states
  (e.g. `ci_failed → error → shake`). No new runtime code unless a tiny helper proves necessary; the
  runtime already binds arbitrary states.

---

## 5. Phase 3 (Tier 3) — Reach

### 3a. Browser drop-zone
- A page (e.g. `tools/rig-editor/drop.html` or an editor mode) where a dropped PNG is decoded, run
  through the browser vectorize → segment → model, previewed, and exported — reusing the existing
  in-browser pipeline. No terminal, no MCP required for the basic path.

### 3b. Example-input gallery
- A docs page (`docs/gallery/` or README section) showing inputs that rig well (colour-distinct,
  layered) vs. the silhouette worst case, with the good-input guidance.

---

## 6. Architecture & file touchpoints

- `tools/rig-editor/presets.js` — preset families by kind (Phase 2a). Largest change; keep templates
  pure and node-testable.
- `tools/rig-editor/model.js` — `kind` on parts; declared `states` (Phase 2a/2b).
- `tools/rig-editor/validator.js` — arbitrary states + warn-not-fail (Phase 2b).
- `tools/rig-editor/emit.js` — showcase HTML (Phase 1b).
- `tools/rig-editor/grade.js` (new) — shared `gradeInput(model)` (Phase 1a).
- `mcp/tools.mjs` + `mcp/server.mjs` — `inputGrade` on start, `kind`/`states` on `set_part`/start
  (Phases 1a, 2a/2b).
- `tools/rig-editor/drop.html` (new) + glue (Phase 3a); `docs/gallery/` (Phase 3b).
- Tests: a node self-check per new/changed module, wired into `tools/check-all.ps1` (P5/P6); Playwright
  for the drop-zone (Phase 3a).

---

## 7. Testing approach
- Node `node:assert` self-checks (no framework), mirroring existing `*.test.mjs`; wired into
  `check-all.ps1`. Keep the 10-case `segment-quality` battery and the golden round-trip green.
- Phase 2: assert `wheel→spin` is a continuous 360° recipe; a custom state validates; the goldens still
  pass. Phase 1: assert `gradeInput` verdicts on synthetic monochrome vs multi-colour models; the
  showcase HTML has no `fetch(` and contains the download anchor + play control.

---

## 8. Risks / open points (resolve in planning)
- **Preset.js restructure vs. goldens** — role-keyed presets must keep working; add kind as an overlay,
  don't break `recipeFor` for existing rigs. Prove with the golden round-trip.
- **Validator relaxation** — ensure the buildable-slice/golden invariants still hold (they cover all
  three states, so they stay valid); the change only stops hard-failing custom/partial state sets.
- **Drop-zone scope (Phase 3a)** — keep it to the existing in-browser pipeline; don't rebuild the editor.
