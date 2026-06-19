# Phase 4 — State Orchestrator: Implementation Plan

**Status:** 📋 planned. Created 2026-06-18.
**Build-plan position:** step 5 of [`technical-proposal.md` §7](technical-proposal.md). Phases 3
(codegen + schema-lock v2), 1 (vectorize), and 2 (assisted segmentation) are complete; this is
the next phase. After this: step 6 (Polish & demo).

> **Ponytail framing.** The two Output Targets *already* expose a state surface — SVG+CSS reads
> `#mascot[data-state="…"]`, React+GSAP takes a state prop that drives the timelines. So Phase 4
> is **not** a new rendering engine; it is a thin, additive runtime layer that decides *which*
> Animation State is current and writes it onto that existing surface. The laziest thing that
> works is ~1 small dependency-free JS core + a React wrapper over it. No emitter changes, no
> npm at the repo root, no telemetry SDK.

---

## Goal

Make the mascot **react to live data**, not just loop (proposal §5). Provide a deterministic
**state machine** that maps named Animation States (`idle`, `active`, `alert`) to the animations
the emitters already produce, with transition rules (priority so `alert` interrupts `idle`;
hysteresis/debounce so it does not flicker), plus a thin, **injectable** data-binding hook
(`useMascotState(source)`) that reads a source (JSON poll, event feed, or DevBrain telemetry) and
drives the machine. Source is injectable so the mascot is reusable outside DevBrain.

This closes the runtime end of the pipeline: `rigged.json` → emitters (Phase 3) → **a bound,
data-reactive mascot (Phase 4)**.

---

## Evidence basis (documented)

- **[technical-proposal.md §5](technical-proposal.md)** — Phase 4 contract: small state machine
  (`idle`/`active`/`alert`, transition rules — debounce, priority); thin data-binding hook
  `useMascotState(source)` reading JSON poll / WebSocket / DevBrain telemetry, source injectable;
  performance posture (CSS for idle loops, GSAP only on events). **Output contract: a documented
  runtime API — `setState(name)`, `bind(source)`, and the React hook.**
- **[ADR-0008 — rigged.json schema v2](adr/0008-rigged-json-schema-v2-lock.md)** — `states`
  array (`idle`, `active`, `alert`) is the canonical state vocabulary the orchestrator targets.
- **Existing state surface (locked, read-only):**
  - SVG+CSS — `tools/emit-svg-css.ps1` emits CSS keyed on `#mascot[data-state="<state>"]`; the
    generated demo already toggles state via `data-set-state` buttons. The canonical surface to
    drive is **the `data-state` attribute on an inlined `#mascot` SVG**.
  - React+GSAP — `tools/emit-react-gsap/` drives timelines from a state value; the hook returns
    the current state for the component to consume.
- **[research-log Q3](research/research-log.md)** — GSAP-vs-CSS runtime cost on low-power
  clients is "now unblocked: both targets emit from one `rigged.json`, so a fair comparison is
  runnable." A live bound mascot is what makes that benchmark runnable (companion note below).

---

## Input / Output contract

**Input (runtime):**
- A mounted Output Target — an inlined SVG+CSS `#mascot`, or the React `<Mascot>` component.
- The `states` vocabulary, read from `rigged.json.states` (`["idle","active","alert"]`). Passed
  in — **no new emitter "states manifest" is generated** (YAGNI; the integrator already has it).
- An injectable **source** that yields behavioural signals over time.

**Output (the documented runtime API):**
- `createMascot({ root, states, rules? }) → { setState(name), bind(source), getState(), destroy() }`
  — framework-agnostic core (drives SVG+CSS by setting `root.dataset.state`).
- `useMascotState(source, opts?) → currentState` — the React hook (wraps the same core).
- Two tiny built-in source adapters: `pollJson(url, mapFn, intervalMs)` and
  `fromEvents(target, mapFn)`. WebSocket adapter is a **Future Expansion Note**, not v1.

**State-machine semantics (deterministic):**
- **Priority:** `alert` > `active` > `idle`. The highest-priority currently-asserted signal wins.
- **Upgrade is immediate** (a new higher-priority signal interrupts at once).
- **Downgrade has hysteresis:** a state holds for `minDwellMs` (default ≥ that state's animation
  duration) and until its signal clears, before falling back — prevents flicker on noisy feeds.
- **Resting state:** `idle`. Given the same timestamped signal sequence, the state timeline is
  identical run to run (testable).

---

## Approach

1. **Core (dep-free, vanilla ESM):** a ~small state machine + `setState` (writes `data-state`) +
   `bind(source)` that subscribes to the source and maps signals → states under the priority +
   hysteresis rules above.
2. **Adapters:** `pollJson` (fetch + map on an interval) and `fromEvents` (DOM/EventTarget + map).
   Both return an unsubscribe; `bind` owns the lifecycle.
3. **React wrapper:** `useMascotState` imports the core, runs it in an effect, returns the live
   state for `<Mascot>` to render. Lives in the existing React package (no new root dep).
4. **Demo proof:** a static page that inlines the generated SVG+CSS mascot, loads the core, and
   drives it from a **mock telemetry source** so a human watches `idle→active→alert→idle` fire
   automatically — the "reacts to live data" proof, no manual buttons.

**Language decision (recommended):** the orchestrator runtime is necessarily **browser JS** (it
drives a web mascot) — PowerShell does not apply here. Keep it **dependency-free vanilla ESM** so
the SVG+CSS path stays npm-free at the repo root; the React hook lives inside the existing
`tools/emit-react-gsap/` package which already has React/GSAP. *No new runtime dependency.*

---

## Planned files (ponytail audit — 5 new, each earns its place)

| File | Purpose | Why it must exist |
|---|---|---|
| `runtime/mascot-state.js` | Dep-free orchestrator core: state machine + `setState`/`bind`/`getState`/`destroy` + `pollJson`/`fromEvents` adapters. | The one substantive deliverable; the documented runtime API. |
| `runtime/mascot-state.test.mjs` | `node:assert` self-check: feed a scripted signal timeline, assert the resulting state timeline (priority interrupt, dwell hysteresis, downgrade). | Non-trivial state-machine logic needs one runnable check. Zero npm (`node:assert`). |
| `docs/buildable-slice/orchestrator-demo.html` | Static, dep-free demo: inlines the generated SVG+CSS mascot, binds a mock telemetry source, auto-cycles states. | The visual "reacts to live data" proof. Separate from the locked generated demo. |
| `tools/emit-react-gsap/src/useMascotState.ts` | Thin React hook wrapping the core. | Required by the output contract ("the React hook"). Inside the existing npm package. |
| `tools/check-orchestrator.ps1` | Structural check: API surface present, demo wires core + generated SVG, states match `rigged.json`, runs the node test. | Matches the per-phase check convention; satisfies "structural check passes". |

**Deliberately skipped (YAGNI):** a WebSocket adapter (Future Note — add when DevBrain exposes
WS), a generated per-mascot orchestrator (the core is mascot-agnostic — parameterized by
`states`), a "states manifest" emission step (read `rigged.json.states`), a telemetry SDK, and a
benchmark harness (Q3 is a companion measurement, below — not Phase 4 scope).

---

## Implementation steps

1. Build `runtime/mascot-state.js`: priority + hysteresis state machine; `createMascot`,
   `setState`, `bind`, `getState`, `destroy`; `pollJson` + `fromEvents` adapters.
2. Write `runtime/mascot-state.test.mjs`: scripted timeline asserts (alert interrupts idle
   immediately; downgrade waits for `minDwellMs` + signal clear; deterministic re-run).
3. Build `docs/buildable-slice/orchestrator-demo.html`: inline the generated `#mascot` SVG, load
   the core, drive from a mock source; show the live state.
4. Add `tools/emit-react-gsap/src/useMascotState.ts` wrapping the core; wire it in the React demo
   (`demo/main.tsx`) as the bound path **without** changing the locked emitter output.
5. Write `tools/check-orchestrator.ps1` (separate file; does not weaken existing checks).
6. **Visually verify** the demo auto-cycles states; capture a side-by-side / sequence proof and
   share it — do not ask the human to check manually.

---

## Verification

- **Deterministic:** `node runtime/mascot-state.test.mjs` passes; re-run → identical state timeline.
- **Structural:** `tools/check-orchestrator.ps1` passes.
- **Existing checks unchanged:** `check-buildable-slice.ps1`, `check-flat-svg.ps1`,
  `check-segmented.ps1` still pass; `rigged.json`, `devbrain-manual-part.svg`, the emitters, the
  goldens, and the locked generated demo are **byte-unchanged**.
- **Live/visual:** the orchestrator demo, bound to a mock source, visibly transitions
  `idle→active→alert→idle` under the priority + hysteresis rules. Share the proof.
- Scan changed files for TODO/TBD/FIXME.

---

## Non-goals (explicit)

- **No emitter changes**, no edits to `rigged.json`, `devbrain-manual-part.svg`, the locked
  generated demo, any accepted golden, or any ADR.
- **No ML / SAM / VLM, no orchestration framework, no telemetry SDK, no npm at the repo root.**
- **No edits to the DevBrain repo** — Phase 4 ships the telemetry-adapter *shape*; wiring it into
  DevBrain is a separate integration (flagged, not done here).
- **No full dashboard/web app** — the confirm/demo surface is a static page.
- **No real low-power benchmark build** — Q3 is unblocked by this phase but measured separately.

---

## Open questions touched (from §9)

- **Q3 (GSAP-vs-CSS runtime cost on low-power clients)** — *unblocked, not resolved here.* A live
  bound mascot on both targets makes the fair comparison runnable; the actual micro-benchmark on
  real dashboard hardware is a companion measurement, recorded in the research log when run.
- **Q6 (where the human-confirm UI lives)** — Phase 2 settled on a static review artifact; Phase 4
  follows the same posture (static demo, no web app).

---

## Handoff summary

Phases 1–3 produce a `rigged.json` (schema v2) that drives both Output Targets around identical
canonical pivots, plus a generated `flat.svg` and a deterministic Phase-2 segmentation proposal.
Phase 4 is net-new **runtime** code: a dependency-free state-machine core (`setState`/`bind`) that
writes onto the emitters' existing `data-state` surface, a React hook over the same core, and a
static demo that drives it from a mock telemetry source — proving the mascot reacts to live data
without touching any locked artifact. The method matches the documented Phase-4 contract, so **no
new ADR** is required.
