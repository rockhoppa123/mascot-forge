# Guided Reactivity Tiers + Full-Fidelity Editor Round-Trip — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm)

## Problem

Testing the guided `rig_mascot` flow surfaced five issues, three structural:

1. **The editor receives a corpse.** `editorHandoff` (`mcp/tools.mjs:249-263`) emits a **geometry-only** layered SVG — group-per-part with rects, but no roles, pivots, presets, or states. The editor loads it via `parseLayered`, and its `loadFile` (`tools/rig-editor/app.js:637`) only understands PNG / segmented-SVG / layered-SVG — **there is no path to import a rig's motion at all.** Result: the editor shows `0/7 animated · idle ✗ active ✗ alert ✗`. The motion the agent built in chat is thrown away crossing into the editor.
2. **Opening the result is manual.** No tool returns a ready URL; the editor needs an HTTP server (ES modules can't load over `file://`) but none is bundled, so a port is invented ad-hoc each run, and the handoff must be **file-uploaded** by hand.
3. **States are mishandled.** The guided prompt's signal-state step gets skipped by the model; the editor can only render *declared* states with no way to add them; and (per #1) the handoff drops the vocabulary anyway.
4. **Reactivity is overkill for many.** Every mascot is pushed through idle/active/alert even when the user just wants a single looping animation. There is no "simple animated mascot" path.
5. **Low-colour inputs are carved into anatomically-wrong parts and torn apart.** A white ghost with a black outline (`out/ghost/`) is effectively two colours; segmentation can't separate eyes from outline or one white region from another, so it produced `part-hand-left/right` that are actually the **outline** and a `part-eyes` that is **half the body** — then animated them independently, shearing the ghost apart. The grade flags this as silhouette/borderline, but the flow carved it anyway.

## Goal

A guided flow that (a) asks how reactive the mascot needs to be, (b) refuses to carve fake limbs from a silhouette, (c) hands a **complete, animating** rig to the editor and back, and (d) lets the editor author states/parts — with the result openable from a returned URL.

## Locked decisions (from brainstorm)

- **Reactivity = three tiers:** Simple / Standard / Signals.
- **Handoff fidelity = self-describing SVG:** the rig travels as `data-*` attributes on the layered SVG (one file, round-trips, extends the editor's existing `data-pivot`/`data-tint` parsing).
- **Editor authors states:** add/remove-state controls in the editor (relaxes declare-at-start *in the authoring tool only*; the runtime rig contract is unchanged — export still produces a fixed snapshot).

## Components

### 1. Reactivity tiers (guided flow + states mapping)

`rig_mascot` Step 0 asks the tier:
- **Simple** — `states: ["idle"]`. One looping idle motion, no state machine, no binding/JS. The emitted SVG just animates.
- **Standard** — `states: ["idle","active","alert"]` (the current default).
- **Signals** — `["idle","active","alert","loading","error","success"]`.

`forge_start_from_image` already accepts `states`; the tier maps to the array. Add a `SIMPLE_STATES = ["idle"]` export beside `STANDARD_STATES`/`SIGNAL_STATES` in `model.js`. `planFor`/`presetsFor` already handle an arbitrary declared vocabulary, so Simple "just works" (only idle options shown).

### 2. Grade-gated carving (the ghost fix)

In the guided prompt: after `forge_start_from_image`, report the grade in plain words FIRST (already scripted). **New rule:** on `silhouette` (and by default on `borderline`), do **not** carve limbs — steer to **Simple + whole-body**: one `part-body` (core) with a gentle `breathe`/`sway`, and tell the user a layered/multi-colour source is needed for separable parts. Reinforce in `forge_propose`'s `plan`/`advisory`: when grade is poor, the advisory recommends whole-body Simple rather than the proposed (likely wrong) parts. No segmentation-engine change — this is flow discipline + an advisory note.

### 3. Full-fidelity handoff (self-describing SVG)

`editorHandoff` embeds the rig on the layered SVG:
- root `<svg data-states="idle,active,alert,...">`,
- each `<g>` part: `data-role`, `data-bone`, `data-pivot="x,y"`, and `data-preset-<state>="name"` for each set preset.

The editor's load path parses these and rebuilds the live model with roles/pivots/presets/states, so the rig **animates immediately** and a re-export carries them back. Extend the editor loader (a `loadRiggedSvg` branch in `loadFile`, detected by presence of `data-role`/`data-preset-*`) and `parseLayered`/model construction to honour the attributes. The plain layered-SVG path (no rig attrs) keeps its current behaviour.

### 4. Editor authors states + parts

The editor gains **add/remove-state** controls: an "+ add state" affordance offering the standard trio + `loading`/`error`/`success` (the `SIGNAL_STATES`), and remove for non-`idle` states (`idle` is the mandatory resting state, `states[0]`). `renderStateControls()` already renders from `model.states()`; this adds mutation. The model needs an `addState`/`removeState` (today `states` is fixed at construction) — scoped to the editor model; the MCP/runtime keep declare-at-start. Export reflects the edited vocabulary.

### 5. Frictionless open

- `forge_emit` and `forge_open_editor` return an explicit, copy-pasteable open line: `open: http://localhost:<port>/<path>` for the demo and the editor-with-handoff, plus the file paths. The MCP returns the URL; it does **not** drive the browser.
- Ship a one-command server so the port is stable: `tools/serve.ps1` (and an npm script) wrapping `python -m http.server <port>` or a tiny node static server from the repo root. The editor already shows a "serve over HTTP" hint (`index.html:115`); align the documented port.
- `forge_open_editor` writes the handoff to a served path under the repo and returns the URL that loads it (with the editor reading a `?rig=<path>` param to auto-load, removing the file-upload step). The editor stays zero-dependency and offline-capable (the param is optional; manual load still works).

## Phasing (implementation plan order)

- **P1 — handoff fidelity + frictionless open** (components 3 + 5): kills the dead-editor and the manual-open clunk. Highest leverage; mostly `editorHandoff` + editor loader + a serve script + returned URLs.
- **P2 — tiers + grade-gating** (components 1 + 2): the `rig_mascot` rewrite + `SIMPLE_STATES` + advisory. Pure flow/prompt + a small model export.
- **P3 — editor authors states** (component 4): add/remove-state in the editor + model mutation + e2e.

Each phase is independently mergeable and gate-green.

## Tests

- `mcp/tools.test.mjs`: `editorHandoff` emits `data-role`/`data-pivot`/`data-preset-*`/`data-states`; a round-trip (handoff SVG → editor model rebuild → re-export) preserves presets + states; tier→states mapping (`SIMPLE_STATES`).
- `tools/rig-editor/*.test.mjs`: loader rebuilds a full model from a self-describing SVG (roles/pivots/presets/states); `addState`/`removeState` on the model (idle non-removable).
- `mcp/protocol.test.mjs`: tool count unchanged (**10** — no new tool; `forge_open_editor` already exists).
- Playwright (`tests/e2e/`): loading a handoff rig shows it **animating** (idle/active/alert ✓, not 0/N); add-state control renders a new state button + picker.
- `mcp/server.test.mjs`: `rig_mascot` scripts the tier question and the silhouette→Simple steer.

## Constraints

- Runtime artifact stays **zero-dependency**; the editor stays offline-capable (the `?rig=` param is optional). Pure ESM, no build.
- **Additive**: the plain layered-SVG and segmented-SVG load paths keep working; `forge_*` returns gain fields, none removed.
- Whole-part **transform-only** motion; `node:assert/strict`, no framework.
- Back-compat: goldens (`exporter.test`), the **10-tool MCP contract**, and existing presets/states stay green. The runtime/MCP keep declare-at-start; only the editor model gains mutation.

## Out of scope (YAGNI)

- A smarter **segmentation engine** that separates same-colour regions (the real cure for silhouettes) — large; the grade-gate + Simple steer is the pragmatic fix.
- A general **phase-offset** animation engine (already parked in the prior spec).
- Auto-launching the user's browser from the MCP (return the URL instead).

## Self-review

- **Placeholders:** none — every component names files + functions.
- **Consistency:** `data-*` self-describing SVG is the single handoff format used by both `editorHandoff` (write) and the editor loader (read); tiers map through the existing `states` param; grade-gate reuses the existing `gradeInput`/advisory.
- **Scope:** larger than one plan — explicitly phased P1/P2/P3, each independently mergeable.
- **Ambiguity:** "borderline" default is pinned (steer to Simple by default, but the user may override and carve anyway); `idle` is the one non-removable state; the MCP keeps declare-at-start while only the editor model gains add/remove.
