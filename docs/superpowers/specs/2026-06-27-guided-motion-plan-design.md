# Guided Motion Plan + Limb De-sync — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm)

## Problem

Two faults surfaced testing the merged signal-state work via the `rig_mascot` guided MCP flow:

1. **Two limbs animate in sync.** `forgeEmit` auto-fills every limb with the same `DEFAULT_PRESET.limb = ["active","walk"]` (`mcp/tools.mjs:30,246-250`). A rig with two legs gets both legs on the same preset, same phase — a pogo hop, not a walk. There is no mirror/offset logic for a 2nd limb, whether the preset is auto-filled or chosen by the agent.
2. **The guided flow hides motion choices.** `forge_propose` returns `{parts, rigStatus, preview, advisory}` — no motion options. `rig_mascot` (`mcp/server.mjs:223-245`) tells Claude to "set a preset per state" with no menu shown to the user, and never declares app-signal states, so the new `loading/error/success` feature is unreachable from the guided path. The user is never offered the alternatives (`sway` vs `breathe`, `glance` vs `blink`, etc.) that exist in the library.

## Goal

The `rig_mascot` flow presents a readable **motion plan** (recommended motion + alternatives per part, per declared state), lets the user **continue or change** before emit, can declare **signal states**, and never animates two limbs in sync. The MCP is request/response, so the "plan → continue/change" loop is Claude mediating in chat; the tools' job is to **return** the options so Claude can present them accurately (it cannot enumerate `presetsFor` from chat).

## Components

### 1. `planFor(model)` — shared recommendation engine (new, `mcp/tools.mjs`)

For each rect-bearing part, returns:

```js
{ id, role, kind,
  recommended: { state, preset },           // the default motion (mirror-aware, see below)
  options: { [state]: [presetName, ...] } }  // every DECLARED state -> presetsFor(role, state)
```

- `options[state] = presetsFor(role, state)` for every state in `model.states()` — the single source of truth, so the menu always matches the library (incl. signal states via `STATE_FAMILY`).
- `recommended` uses `defaultPresetFor(id, role, kind)` but **limb-index-aware**: walking limbs alternate. The 1st limb that resolves to `walk` keeps `walk`; the 2nd gets `walk-mirror`; the 3rd `walk`; etc. (Only the generic `walk` default is mirrored — a kind/id-specific default like `wag`/`spin` is left as-is; if a non-walk preset would repeat across siblings, note it but do not invent a new mirror.)
- One engine feeds both the plan display (component 2) and auto-fill (component 3), so they can never disagree.

`planFor` is pure over the model (no session/fs) — node-testable directly.

### 2. `forge_propose` extended (`mcp/tools.mjs`, `mcp/server.mjs`)

`forgePropose`'s return gains `plan: planFor(s.model)` alongside the existing `{parts, rigStatus, preview, advisory}`. Additive — no field removed or renamed, no schema break. The `forge_propose` tool description notes it now returns a per-part motion plan with options. **No new tool — the 10-tool contract is intact.**

### 3. `forgeEmit` auto-fill de-sync (`mcp/tools.mjs`)

The auto-fill loop (`tools.mjs:246-250`) consumes the same mirror-aware recommendation as `planFor` (extract a shared `recommendDefaults(model)` helper, or have the loop walk `planFor(model)`'s `recommended` entries). So even a non-guided `forge_emit` stops syncing two legs. This is the actual bug fix for fault #1; the plan display (component 2) just makes it visible and overridable.

### 4. `rig_mascot` prompt rewrite (`mcp/server.mjs`)

New script:
- **Step 0 — signal states:** ask whether to declare app-signal states (`loading`/`error`/`success`); if yes, pass `states: ["idle","active","alert", ...]` to `forge_start_from_image`. Note the vocabulary is fixed at start (immutable per rig).
- **Step 1 — grade:** unchanged (plain-words grade; stop on `silhouette`).
- **Step 2 — present the plan:** call `forge_propose`; show the overlay AND present `plan` as a table — each part, role, recommended motion per state, and the alternative options. Flag mirrored legs explicitly ("legs: walk / walk-mirror — mirrored so they don't move in lockstep").
- **Step 3 — checkpoint (no emit until approved):** offer
  - **continue** — accept the plan as shown,
  - **change motion** — swap a part's preset to one of its listed alternatives,
  - **change parts** — re-carve via `assign_region` or rename/role via `forge_apply_tweaks`, then re-call `forge_propose` to refresh the plan + overlay,
  - **declare states** — if signal states were skipped at Step 0, note they must be set at start and offer to restart `forge_start_from_image` with them.
- **Step 4 — apply + emit:** set the chosen presets with `set_part`, run `forge_status` to confirm coverage, `forge_emit`. Give file paths and note `forge_open_editor` for a **live motion** preview (the static overlay shows parts, not motion).

### 5. Tests

- `mcp/tools.test.mjs`:
  - `planFor` returns `recommended` + `options` per part; `options` keyed by every declared state (incl. a signal state when declared).
  - **Two limbs → `walk` + `walk-mirror`** (the fault-#1 regression guard), asserted on both `planFor` and the emitted rig from `forge_emit` (no two limbs share the same in-phase preset).
  - `forge_propose` return includes `plan`.
- `mcp/protocol.test.mjs`: tool count unchanged (**10**); full chain green.
- `mcp/server.test.mjs`: `rig_mascot` prompt text includes the signal-state step, the plan presentation, and the checkpoint actions.

## Constraints

- Runtime artifact stays **zero-dependency**; changes are in `mcp/` + the zero-dep `presets.js`/`tools.mjs` consumers. Pure ESM.
- `forge_propose` change is **additive** — existing callers (`tools.test`, any agent) keep working.
- Whole-part **transform-only** motion; `node:assert/strict`, no framework.
- Back-compat: goldens (`exporter.test`), the **10-tool MCP contract** (`protocol.test`), and existing presets stay green.

## Out of scope (YAGNI)

- A **general phase-offset engine** (animation-delay on any shared preset) — rejected; it would churn `emit.js` + the CSS schema + every golden for marginal gain. Targeted `walk-mirror` covers the observed defect.
- A **true in-MCP motion preview** — that is `forge_open_editor` / the browser editor's job; the MCP returns a static parts overlay only.

## Self-review

- **Placeholders:** none — every component names its file + function.
- **Consistency:** `planFor` is the single recommendation source for both display and auto-fill; the mirror rule is stated once and reused.
- **Scope:** one plan's worth — three code changes (`planFor`, `propose` return, `emit` auto-fill) + one prompt rewrite + tests. No decomposition needed.
- **Ambiguity:** "mirror-aware" is pinned to the generic `walk` default only; kind/id-specific defaults are left as-is, with a note rather than an invented mirror.
