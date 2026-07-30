# Q3 — GSAP-vs-CSS runtime cost benchmark — fresh-agent implementation prompt

> Copy everything below the line into a fresh Claude Code session at
> `C:\Users\dev\Dev\mascot-forge`. Companion design doc:
> [`docs/q3-gsap-vs-css-benchmark-implementation-plan.md`](../plans/q3-gsap-vs-css-benchmark-implementation-plan.md).

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the entire task. This is a measurement spike, not a feature: the engine is feature-complete (Phases 1–4 + Phase 6 all shipped). The temptation to build a benchmark *framework* is the main risk. Both Output Targets already render the same mascot from the same rig — so there is nothing to build except ~30 lines of instrumentation over the demos that already exist. No benchmark framework, no new dependency (no Lighthouse/Playwright/tachometer/benchmark.js), no CI, no new demo page. The deliverable is a results table and a one-line verdict, NOT a tool.

You are running the **Q3 runtime-cost benchmark** for mascot-forge in C:\Users\dev\Dev\mascot-forge. Q3 is the last open question in `docs/research/research-log.md` (🔴): *"GSAP vs CSS runtime cost on low-power clients."* Only make changes directly requested. Do NOT add pipeline capability, emitter/rig/Output-Target changes, dependencies, or features.

## Context (carry forward — v1 is complete)
- Pipeline all shipped: PNG →[P1 vectorize]→ flat.svg →[P2 segment]→ named parts + pivots →[P3 codegen]→ emitters →[P4 orchestrator]→ data-reactive mascot. Phase 6 (polish/demo) closed the build plan.
- Q3 is "now unblocked" because BOTH Output Targets emit from one `rigged.json` around identical pivots (schema v2 / ADR-0008), so a fair comparison is finally runnable.
- The two targets under test (REUSE — do not rebuild, do not edit):
  - **SVG+CSS** (default): `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` — pure CSS keyframe loops, `data-state` switches the animation, zero JS per frame.
  - **React+GSAP** (opt-in): the Vite project in `tools/emit-react-gsap/` (`demo/main.tsx` → `generated/Mascot.tsx`) — GSAP timelines on the main thread, `ctx.revert()` for clean interrupts.
- LOCKED, MUST NOT be overwritten/altered: devbrain-rigged.json, devbrain-manual-part.svg, both emitters (emit-svg-css.ps1, emit-react-gsap/), the accepted reduced-motion goldens, the locked generated demo, the generated SVG/CSS, every ADR. The Clean Mascot Source PNG is read-only/external — never touch it. You are MEASURING these targets, not changing them.

## 0. Read first (do not skip)
- docs/q3-gsap-vs-css-benchmark-implementation-plan.md — the full design (metrics, run matrix, file map, ponytail audit). This prompt is the operational summary; the plan is the detail.
- docs/research/research-log.md — Q3 row (the question + why it's unblocked).
- docs/technical-proposal.md §8 — the "main-thread jank on weak clients" risk this benchmark settles.
- docs/adr/0007-output-target-verdict-both-svg-css-default.md — the verdict being validated ("both; SVG+CSS default, React+GSAP opt-in").
- spikes/01-emitter/FINDINGS.md — the house style for a spike write-up; mirror it.

## 1. Goal
Quantify the runtime cost of SVG+CSS vs React+GSAP rendering the identical DevBrain mascot across `idle/active/alert` on a low-power client, and decide whether ADR-0007's "SVG+CSS default, GSAP opt-in" holds with numbers. Answer three questions: (1) is the **idle** steady state materially cheaper on SVG+CSS? (2) what is the **GSAP opt-in cost**? (3) does either target **drop frames / block the main thread** badly enough to be unusable as a background dashboard element?

## 2. Deliverables (ponytail: 1 script + 1 findings doc + 1 edit)
- **spikes/02-runtime-cost/bench.js (new)** — a ~30-line sampler using BROWSER BUILT-INS ONLY: `requestAnimationFrame` delta sampling (p50 + p95 frame time), `PerformanceObserver({type:"longtask"})` (count + total ms), `performance.memory` (heap MB). Collects over a fixed window (~10 s) per state and prints ONE JSON line per cell: `{target, state, throttle, p50, p95, longTasks, longTaskMs, heapMB}`. Injected via console paste or `?bench=1`. No runner UI, no dependency.
- **spikes/02-runtime-cost/FINDINGS.md (new)** — the 18-row results table + a Chrome Performance-trace cross-check + the verdict answering the three goal questions + the hardware-calibration note. Mirror spikes/01-emitter/FINDINGS.md.
- **docs/research/research-log.md (edit)** — flip Q3 🔴 → 🟢 with the numeric verdict and a link to FINDINGS.
- **ADR — ONLY if the verdict CHANGES the default.** If numbers confirm ADR-0007 (expected), append a one-line "validated empirically <date>, see FINDINGS" note to ADR-0007. If they overturn it, STOP AND ASK before writing a superseding ADR-0010.

## 3. Method (follow the plan)
- **Build the React+GSAP target for PRODUCTION** — `vite build` + `vite preview` (or the emitted static bundle). NEVER benchmark the HMR dev server; dev-mode overhead would unfairly inflate the GSAP cost. The SVG+CSS demo is already static. Serve both over http.
- **Low-power simulation:** primary = Chrome DevTools **CPU throttling** at **4×** and **6×** (the reproducible desk proxy — produces the full matrix with no hardware). Ground-truth knob = ONE run on a real low-power browser (Raspberry Pi / the DevBrain dashboard host): match the proxy's `idle` p50 to the device's once, pick the throttle multiplier that lines up, note it. **If no device is reachable, run the full throttle matrix and FLAG the calibration run as a follow-up for Andrew — do NOT fabricate a hardware number.**
- **Run matrix:** `{SVG+CSS, React+GSAP} × {idle, active, alert} × {no-throttle, 4×, 6×}` = 18 cells. Viewport `900×620`, `prefers-reduced-motion: no-preference` (benchmark the moving animation, not the reduced-motion fallback), equal per-state dwell. Run each cell ≥3× and report the median of medians — a single noisy run is not a measurement.

## 4. Verify
- bench.js gives stable, repeatable JSON per cell; the 18-row table is complete (no cell left "TODO").
- The verdict explicitly answers the three goal questions and states whether ADR-0007 stands.
- Locked artifacts byte-UNCHANGED: rigged.json, manual-part.svg, both emitters, the generated SVG/CSS, the locked generated demo, every golden, every existing ADR (confirm via `git status`).
- Visual/measurement proof: share the results table and one Performance-trace screenshot per target at 4× — do not ask the human to read the numbers off-screen.
- Scan new/changed files for TODO/TBD/FIXME.

## 5. Constraints / non-goals
- NO new pipeline capability — measurement only.
- NO emitter, rig, or Output Target edits. NO new dependency, NO benchmark framework, NO CI, NO new demo page.
- NO npm at the repo root (the React project keeps its own package.json under tools/emit-react-gsap/ — that is fine; do not add one at the root).
- NO fabricated hardware numbers. NO edits to locked artifacts or the DevBrain repo.

## 6. Acceptance criteria
- [ ] spikes/02-runtime-cost/bench.js measures p50/p95 frame time + long tasks + heap with browser built-ins only.
- [ ] spikes/02-runtime-cost/FINDINGS.md has the complete 18-cell table, a Performance-trace cross-check, and a verdict answering the three questions.
- [ ] research-log Q3 flipped 🔴 → 🟢 with the numeric verdict + FINDINGS link.
- [ ] ADR-0007 confirmed (one-line empirical note) OR — only if overturned — ADR-0010 written after asking.
- [ ] all locked artifacts byte-unchanged; no TODO/TBD/FIXME in changed files.

## 7. Stop and ask before
- adding ANY dependency, a benchmark framework, npm at the repo root, or CI config.
- editing any emitter, rigged.json, the Manual Part SVG, the generated SVG/CSS, the locked generated demo, any golden, or any existing ADR.
- writing a superseding ADR-0010 (i.e. if the numbers overturn the SVG+CSS-default verdict).
- building anything beyond the sampler script + the findings doc.

## 8. Checkpoints
- After reading the plan + research-log + ADR-0007: output a 3–5 line ponytail plan (the laziest viable way to get 18 trustworthy cells), then proceed.
- After each deliverable: ✅ [what was completed].

## 9. Report back
The bench.js approach (which built-ins, the JSON shape); the full 18-cell results table; the Performance-trace cross-check screenshots; the verdict on the three goal questions and whether ADR-0007 stands; whether a real low-power device was used or the calibration run is flagged as follow-up; confirm all locked artifacts byte-unchanged; note that closing Q3 closes v1's last open question.
