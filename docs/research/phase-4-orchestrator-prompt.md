# Phase 4 (State Orchestrator) — fresh-agent implementation prompt

> Copy everything below the line into a fresh Claude Code session at
> `C:\Users\student1\Dev\mascot-forge`. Companion design doc:
> [`docs/phase-4-orchestrator-implementation-plan.md`](../phase-4-orchestrator-implementation-plan.md).

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the entire task. Every design choice must be the laziest thing that actually works: deterministic vanilla JS over any framework, write onto the emitters' EXISTING state surface over a new rendering layer, a static demo over a web app, the fewest files possible. Question whether each new file/abstraction needs to exist at all (YAGNI).

You are implementing Phase 4 (State Orchestrator) of mascot-forge in C:\Users\student1\Dev\mascot-forge. Only make changes directly requested. Do not add extra files, abstractions, dependencies, or features beyond this phase.

## Context (carry forward — Phases 1–3 shipped, Phase 2 just shipped)
- Pipeline: PNG →[P1 vectorize ✅]→ flat.svg →[P2 segment ✅]→ named parts + pivots →[P3 codegen ✅]→ emitters →[**P4 orchestrator ← YOU**]→ data-reactive mascot.
- P3 DONE + LOCKED: devbrain-rigged.json (schema v2, ADR-0008) drives BOTH emitters. `states` array = `["idle","active","alert"]` — the canonical Animation State vocabulary you target.
- Existing state surface you bind to (DO NOT change it):
  - SVG+CSS — `tools/emit-svg-css.ps1` emits CSS keyed on `#mascot[data-state="<state>"]`. The surface to drive is the `data-state` attribute on an inlined `#mascot` SVG.
  - React+GSAP — `tools/emit-react-gsap/` drives timelines from a state value.
- LOCKED ground truth, MUST NOT be overwritten/altered: devbrain-rigged.json, devbrain-manual-part.svg, both emitters (emit-svg-css.ps1, emit-react-gsap/), the accepted reduced-motion goldens, the locked generated demo (devbrain-svg-css.generated-demo.html), every ADR.

## 0. Read first (do not skip)
- docs/phase-4-orchestrator-implementation-plan.md — the full design (file map, semantics, ponytail audit). This prompt is the operational summary; the plan is the detail.
- docs/technical-proposal.md §5 (Phase 4 contract) and §4 (emitter output contract).
- docs/adr/0008-rigged-json-schema-v2-lock.md — the `states` vocabulary you target.
- docs/research/research-log.md Q3 (GSAP-vs-CSS benchmark — UNBLOCKED by this phase, not resolved here).
- README.md and CONTEXT.md — preserve project language (Animation State, Output Target, Buildable Slice, Clean Mascot Source, rigged.json).
- tools/emit-svg-css.ps1 (the `#mascot[data-state]` surface) and tools/emit-react-gsap/demo/main.tsx (the React state surface) — READ-ONLY, to bind correctly.

## 1. Goal
Make the mascot REACT TO LIVE DATA, not just loop (proposal §5). Deliver a deterministic state machine over `idle`/`active`/`alert` and a thin, injectable data-binding hook that drives it — writing onto the emitters' EXISTING `data-state` / state-prop surface. NO new rendering engine, NO framework, NO ML/telemetry SDK.

## 2. Deliverable (ponytail: the smallest thing that works)
- `runtime/mascot-state.js` — dependency-free vanilla ESM core. Documented runtime API: `createMascot({ root, states, rules? }) → { setState(name), bind(source), getState(), destroy() }`. Drives SVG+CSS by setting `root.dataset.state`. Two tiny source adapters: `pollJson(url, mapFn, intervalMs)` and `fromEvents(target, mapFn)`. (WebSocket adapter = Future Expansion Note, NOT v1.)
- State-machine semantics (deterministic): priority `alert > active > idle`; upgrade immediate; downgrade has hysteresis (`minDwellMs` default ≥ the state's animation duration) and waits for the signal to clear; resting state `idle`. Same timestamped signal sequence → identical state timeline.
- `tools/emit-react-gsap/src/useMascotState.ts` — thin React hook wrapping the same core (returns current state). Wire it into the React demo WITHOUT changing the locked emitter output.
- `docs/buildable-slice/orchestrator-demo.html` — static, dep-free: inline the generated SVG+CSS mascot, load the core, drive it from a MOCK telemetry source so it auto-cycles states (no manual buttons). This is the "reacts to live data" proof.
- States come from `rigged.json.states` — pass them in. Do NOT add a "states manifest" emission step to the emitter.

## 3. Verify
- Deterministic: `node runtime/mascot-state.test.mjs` passes; re-run → identical state timeline.
- Structural check: new `tools/check-orchestrator.ps1` passes (API surface present, demo wires the core + generated SVG, states match rigged.json, runs the node test).
- Existing checks still pass: check-buildable-slice.ps1, check-flat-svg.ps1, check-segmented.ps1.
- Locked artifacts byte-UNCHANGED: rigged.json, manual-part.svg, both emitters, the goldens, the locked generated demo, every ADR.
- Visual proof: the demo, bound to the mock source, visibly transitions idle→active→alert→idle under the priority + hysteresis rules. Share it — do not ask the human to check manually.
- Scan changed files for TODO/TBD/FIXME.

## 4. Constraints / non-goals
- NO ML/SAM/VLM, NO orchestration framework, NO telemetry SDK, NO npm at the repo root. Deterministic vanilla JS only.
- NO emitter changes, NO edits to rigged.json / manual-part.svg / the locked generated demo / any golden / any ADR.
- NO edits to the DevBrain repo — ship the telemetry-adapter SHAPE only; wiring into DevBrain is a separate integration (flag it, don't do it).
- NO full dashboard/web app — the demo is a static page.
- The React hook is the ONLY code allowed inside the npm-bearing `tools/emit-react-gsap/` package; the core + demo + check stay dependency-free.

## 5. Acceptance criteria
- [ ] dependency-free `runtime/mascot-state.js` exposes `setState`/`bind`/`getState`/`destroy` + `pollJson`/`fromEvents`, driving the existing `data-state` surface.
- [ ] deterministic state machine: priority interrupt + downgrade hysteresis, proven by `runtime/mascot-state.test.mjs`.
- [ ] React hook `useMascotState(source)` wraps the same core; React demo bound without emitter changes.
- [ ] static `orchestrator-demo.html` auto-cycles states from a mock source (shared visual proof).
- [ ] `tools/check-orchestrator.ps1` passes; existing checks pass; all locked artifacts unchanged.

## 6. Stop and ask before
- adding ANY dependency or npm at the repo root, or any runtime framework.
- overwriting/altering rigged.json, the Manual Part SVG, either emitter, the locked generated demo, any golden, or any ADR.
- editing the DevBrain repo, or building anything beyond a static demo (no web app).
- if the emitters' existing `data-state` surface turns out insufficient to drive a state cleanly — stop and report; do NOT modify the locked emitters to work around it.

## 7. Checkpoints
- After reading the plan + docs + the state surface: output a 3–5 line ponytail plan (the laziest viable approach), then proceed.
- After each step output: ✅ [what was completed].
- Write a new ADR ONLY if you change the documented Phase-4 method (the plan matches it, so none is expected).

## 8. Report back
Orchestrator design (core state machine → setState writes data-state → bind(source) → adapters → React hook); the state timeline the test asserts (priority interrupt + hysteresis); determinism + the live visual proof; confirm all locked artifacts byte-unchanged; note Q3 (GSAP-vs-CSS benchmark) as now-runnable; recommend step 6 (Polish & demo) or flag any orchestration friction.
