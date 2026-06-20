# Q3 — GSAP-vs-CSS runtime cost benchmark: Implementation Plan

**Status:** 📋 planned. Created 2026-06-18.
**Tracks:** open question **Q3** in [`research/research-log.md`](research/research-log.md) (🔴 → measure) and the
"main-thread jank on weak clients" risk in [`technical-proposal.md` §8](technical-proposal.md). This is a
**measurement spike**, not a pipeline phase — v1 is feature-complete (Phases 1–4 + Phase 6 shipped). It
adds **no new pipeline capability**; it attaches numbers to a decision already made on judgement (ADR-0007).

> **Ponytail framing.** Q3 is empirical, not buildable-around. Both Output Targets already render the
> *same* DevBrain mascot from the *same* `rigged.json` around the *same* pivots — that is the whole reason
> Q3 is "now unblocked." So there is nothing to build except *instrumentation*: one ~30-line frame-time
> sampler that the browser's own APIs (`requestAnimationFrame`, `PerformanceObserver`) make trivial, run
> against the demos that already exist, under Chrome's built-in CPU throttle. No benchmark framework, no
> new dependency, no Lighthouse/Playwright harness, no CI. The deliverable is a results table and a
> one-line verdict, not a tool.

---

## Goal

Quantify the **runtime cost** of the two Output Targets — **SVG+CSS** (default) and **React+GSAP** (opt-in) —
rendering the identical DevBrain mascot across the three Animation States (`idle`, `active`, `alert`) on a
**low-power client**, and decide whether ADR-0007's "SVG+CSS default, GSAP opt-in" verdict **holds with
numbers behind it** or needs revising.

Concretely, answer three questions:
1. On a weak client, is the **idle steady state** (the 99%-of-the-time case) materially cheaper on SVG+CSS
   than React+GSAP? (This is what justifies CSS as the default.)
2. What is the **cost of the GSAP opt-in** — the extra main-thread budget a React mascot spends for
   interruptible/rich event animation?
3. Does either target **drop frames / block the main thread** badly enough on a low-power client to be
   unusable for a background dashboard element?

---

## What is under test (reuse — do not rebuild)

| Target | Artifact under test | Nature of its animation |
|---|---|---|
| **SVG+CSS** | `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` | Pure CSS keyframe loops, `data-state` switches the active animation. Zero JS per frame. |
| **React+GSAP** | the Vite demo in `tools/emit-react-gsap/` (`demo/main.tsx` → `generated/Mascot.tsx`) | GSAP timelines on the main thread; `ctx.revert()` for clean state interrupts. |

Both are already live, both bind state the same way, both rotate around identical pivots (schema v2 /
ADR-0008). The benchmark treats each as a **black box rendering the same mascot** — it changes neither.

> **Build the React target for production, not dev.** Benchmark `vite build` + `vite preview` (or the
> emitted static bundle), **never** the HMR dev server — dev-mode React + Vite overhead would unfairly
> inflate the GSAP target's cost. The SVG+CSS demo is already static.

---

## Metrics (browser built-ins only — no dependency)

| Metric | Source | Why |
|---|---|---|
| Median + 95th-percentile **frame time (ms)** | `requestAnimationFrame` delta sampling | Direct measure of smoothness; 95p exposes jank the median hides. |
| **Long tasks** (count + total ms) | `PerformanceObserver({ type: "longtask" })` | Main-thread blocking ≥50 ms — the thing that freezes a dashboard. |
| **Scripting time / CPU%** per state | one Chrome DevTools **Performance trace** (manual, ground truth) | Confirms the rAF numbers and attributes cost to scripting vs layout/paint. |
| **JS heap (MB)** | `performance.memory` (Chrome-only, rough) | Sanity check that GSAP timelines aren't leaking across interrupts. |

A ~30-line `bench.js` samples frame time + long tasks + heap over a fixed window (e.g. 10 s per state) and
prints `{ target, state, throttle, p50, p95, longTasks, longTaskMs, heapMB }` as one JSON line. Paste it in
the console or load it via `?bench=1` — either is fine; do not build a runner UI.

---

## Low-power simulation (the cheap proxy + the calibration knob)

- **Primary, reproducible, free:** Chrome DevTools **CPU throttling** at **4×** and **6×** slowdown. This is
  the desk proxy and produces the full results matrix without any hardware.
- **Ground-truth knob (do not skip the *flag*):** one run on a **real low-power browser** — a Raspberry Pi,
  or the actual DevBrain dashboard host. Hardware never matches the proxy on paper: calibrate by matching
  the proxy's `idle` p50 frame time to the real device's `idle` p50 **once**, pick the throttle multiplier
  that lines up, and note it. After that the proxy is trustworthy for the rest of the matrix.
- If no real device is reachable in this session, run the **full DevTools-throttle matrix** and **flag the
  one-device calibration run as a follow-up for Andrew** — do not fabricate a hardware number.

---

## Run matrix

`{ SVG+CSS, React+GSAP } × { idle, active, alert } × { no-throttle, 4×, 6× }` — 18 cells. Same viewport
(`900×620`, the review frame), same per-state dwell window, `prefers-reduced-motion: no-preference`
(benchmark the *moving* animation, not the reduced-motion fallback). Record each cell as one row.

---

## Planned files (ponytail audit — 1 script + 1 findings doc, mirrors `spikes/01-emitter/`)

| File | Action | Why it must exist |
|---|---|---|
| `spikes/02-runtime-cost/bench.js` | **new** | The ~30-line frame-time + long-task sampler. Browser built-ins only; injected into both existing demos. |
| `spikes/02-runtime-cost/FINDINGS.md` | **new** | The 18-row results table + the verdict + the calibration note. The actual deliverable. |
| `docs/research/research-log.md` | **edit** | Flip Q3 🔴 → 🟢 with the numeric verdict and a link to FINDINGS. |
| `docs/adr/0007-*.md` **or** a new ADR-0010 | **edit/new — only if the verdict CHANGES the default** | If numbers confirm ADR-0007, append a one-line "validated empirically" note. If they overturn it, write ADR-0010 superseding the default. Expected: confirm. |

**Deliberately skipped (YAGNI):**
- **No benchmark framework / dependency** — Lighthouse CI, Playwright tracing, tachometer, benchmark.js are
  all heavier than a rAF loop for an 18-cell hand-run.
- **No CI / GitHub Actions** — a runtime benchmark on weak hardware is a manual, observed measurement, not a
  gate. Wire CI only if it later runs on a fixed device.
- **No emitter / rig / Output Target changes** — the targets are the thing measured, not the thing changed.
- **No new demo pages** — instrument the two that already exist.

---

## Implementation steps

1. **`spikes/02-runtime-cost/bench.js`** — rAF delta sampler + `PerformanceObserver` long-task counter +
   `performance.memory` read; collects over a fixed window per state and prints one JSON line per cell.
2. **Build the React+GSAP target for production** (`vite build` + `vite preview`); serve the SVG+CSS demo
   over the existing static server. Both reachable over http (fetch / module imports need it).
3. **Run the 18-cell matrix** under no-throttle / 4× / 6× CPU throttle, pasting/loading `bench.js` and
   stepping each state through its dwell window. Capture one Performance trace per target at 4× as the
   ground-truth cross-check.
4. **(If a low-power device is reachable)** run `idle` on it, calibrate the throttle multiplier to match,
   note it. Otherwise flag the calibration run as a follow-up.
5. **`FINDINGS.md`** — results table (18 rows), the Performance-trace cross-check, the verdict answering the
   three goal questions, and the calibration note.
6. **research-log Q3** → 🟢 with the verdict + FINDINGS link. **ADR** only if the default changes.

---

## Verification

- `bench.js` produces a stable, repeatable JSON line per cell (run each cell ≥3× and report the median of
  medians — a single noisy run is not a measurement).
- The 18-row table is complete; no cell left "TODO".
- The verdict explicitly answers the three goal questions and states whether ADR-0007 stands.
- Locked artifacts byte-unchanged: `rigged.json`, the Manual Part SVG, both emitters, the generated
  SVG/CSS, the locked generated demo, every golden, every existing ADR (`git status`).
- Scan new/changed files for TODO/TBD/FIXME.

---

## Non-goals (explicit)

- **No new pipeline capability** — this is measurement only.
- **No emitter, rig, or Output Target edits.** No new dependency, no benchmark framework, no CI.
- **No fabricated hardware numbers** — the real-device run is calibration; if absent, flag it, don't invent.
- **No edits to locked artifacts or the DevBrain repo.**

---

## Expected outcome

ADR-0007 is most likely **confirmed**: CSS idle loops run off the main thread (compositor) and should cost
near-zero scripting time, while GSAP samples timelines on the main thread every frame — so SVG+CSS as the
steady-state default, GSAP as the opt-in for interruptible React mascots, is the expected verdict, now with
numbers. If the 4×/6× matrix shows GSAP dropping frames on `idle`, that strengthens the default further; if
it shows GSAP comfortably under budget even throttled, the opt-in cost is documented as cheap. Either way Q3
moves 🔴 → 🟢 and v1's last open question is closed.
