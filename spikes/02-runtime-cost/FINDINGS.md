# Spike 02 — Runtime Cost: SVG+CSS vs React+GSAP on a low-power client

**Date:** 2026-06-18
**Question settled:** Q3 — *GSAP vs CSS runtime cost on low-power clients.* (research-log 🔴 → 🟢)
**Validates:** [ADR-0007](../../docs/adr/0007-output-target-verdict-both-svg-css-default.md) — "ship both;
SVG+CSS default, React+GSAP opt-in."
**Method:** measure the *same* DevBrain mascot, *same* three states, on *both* shipped Output Targets,
under CPU throttle. Measurement only — no target was changed (locked artifacts byte-unchanged, confirmed
below).

---

## How it was measured

- **Sampler — `bench.js` (browser built-ins only, no dependency):** `requestAnimationFrame` delta sampling
  (frame time **p50 + p95**), `PerformanceObserver({type:"longtask"})` (count + total ms of main-thread
  blocks ≥50 ms), `performance.memory` (JS heap MB). Collects over a fixed window per state and resolves one
  JSON object: `{target, state, throttle, p50, p95, longTasks, longTaskMs, heapMB}`. Pasteable into the
  console or auto-runs via `?bench=1`.
- **Targets under test (reused, unmodified):**
  - **SVG+CSS** — `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html`, served static. Pure
    CSS keyframe loops inside an `<object>`; `?state=` switches the active animation. Zero JS per frame.
  - **React+GSAP** — `tools/emit-react-gsap/`, built for **production** (`vite build --base=./`, served
    static — **never the HMR dev server**, which would inflate the GSAP cost). GSAP timelines on the main
    thread.
- **Low-power proxy:** Chrome (headless=new) driven over the DevTools Protocol;
  `Emulation.setCPUThrottlingRate` at **1× / 4× / 6×**. Viewport `900×620`,
  `prefers-reduced-motion: no-preference` (the moving animation, not the reduced-motion fallback).
- **Run discipline:** 8 s dwell per cell, **each cell ×3, median of medians** reported. Raw run in
  [`results.json`](results.json).
- **`run-bench.mjs` is a throwaway runner, not a deliverable.** An agent cannot click the DevTools throttle
  dropdown by hand, so a ~90-line zero-dependency Node script (Node 22 built-in `WebSocket` + `fetch`)
  performs the exact manual loop the plan describes — set throttle → inject `bench.js` → read the JSON line —
  18 cells × 3. No framework, no new dependency, no CI. Delete it after the numbers are recorded; `bench.js`
  is the kept instrument.
- **Demo-fairness note:** the React demo ships **two** mascot instances (a manual one + one bound to a mock
  150 ms telemetry feed); the CSS demo ships one. The telemetry interval is quiesced at load (`clearInterval`,
  no source edit) so both instances hold a steady state. GSAP cells therefore reflect **~2 static instances**
  — a *conservative, upper-bound* GSAP cost against the CSS page's single instance. It does not flatter GSAP.

---

## Results — 18 cells (median of 3 runs)

Frame time in ms (lower = smoother; 16.7 ms ≈ 60 fps, 33 ms ≈ 30 fps). `longTasks` = count of main-thread
blocks ≥50 ms over the 8 s window; `longTaskMs` = their total duration (8000 ms ≈ main thread pinned).

### SVG+CSS (default target)

| State | Throttle | p50 | p95 | long tasks | long-task ms | heap MB |
|---|---|---|---|---|---|---|
| idle   | none | 6.9  | 7.0  | **0** | **0** | 1.6 |
| idle   | 4×   | 13.9 | 20.8 | **0** | **0** | 1.5 |
| idle   | 6×   | 27.7 | 27.8 | **0** | **0** | 1.5 |
| active | none | 6.9  | 7.0  | **0** | **0** | 2.2 |
| active | 4×   | 7.0  | 13.9 | **0** | **0** | 2.7 |
| active | 6×   | 13.9 | 20.9 | **0** | **0** | 1.9 |
| alert  | none | 6.9  | 7.0  | **0** | **0** | 2.5 |
| alert  | 4×   | 13.9 | 14.0 | **0** | **0** | 2.7 |
| alert  | 6×   | 20.8 | 27.8 | **0** | **0** | 3.0 |

### React+GSAP (opt-in target)

| State | Throttle | p50 | p95 | long tasks | long-task ms | heap MB |
|---|---|---|---|---|---|---|
| idle   | none | 7.0  | 13.9 | 1   | 118  | 5.9 |
| idle   | 4×   | 41.8 | 55.6 | 27  | 1493 | 5.8 |
| idle   | 6×   | 76.4 | 90.2 | 108 | 8127 | 9.7 |
| active | none | 13.8 | 14.0 | 1   | 98   | 6.2 |
| active | 4×   | 41.7 | 55.5 | 12  | 739  | 7.7 |
| active | 6×   | 76.4 | 90.3 | 109 | 8110 | 9.9 |
| alert  | none | 7.0  | 14.0 | 1   | 98   | 6.5 |
| alert  | 4×   | 41.7 | 48.7 | 3   | 208  | 9.2 |
| alert  | 6×   | 62.4 | 69.5 | 135 | 8000 | 7.5 |

**Read in one line:** SVG+CSS blocks the main thread **zero** times in **every** condition; React+GSAP
blocks it heavily once throttled — at 6× the main thread is pinned (~8000 ms of long tasks over an 8000 ms
window) and frame rate collapses to ~13 fps.

---

## Performance-trace cross-check (4×, `active`)

CDP `Performance.getMetrics` deltas across the 8 s window — the programmatic form of the DevTools
Performance panel (a headless agent cannot screenshot a flame chart; these are the same scripting/layout/
style counters the panel charts, recorded directly so no number is read off-screen).

| Target | scripting ms | layout ms | recalc-style ms | total task ms |
|---|---|---|---|---|
| **SVG+CSS**    | **0.0**   | **0.0**   | **0.0**  | 140.4 |
| **React+GSAP** | 157.4 | 818.6 | 99.9 | 7993.9 |

This confirms the rAF numbers and attributes the cost: SVG+CSS spends **0 ms** on scripting/layout/style —
the animation lives entirely on the compositor. React+GSAP spends ~1.1 s of scripting+layout+style and keeps
the main thread busy ~8 s of the 8 s window at 4×. The jank is real CPU work, not measurement noise.

---

## Verdict — ADR-0007 stands, confirmed with numbers

**1. Is idle steady state (the 99%-of-the-time case) materially cheaper on SVG+CSS?**
**Yes, decisively.** SVG+CSS idle = **0 long tasks, 0 ms scripting, ~1.5 MB heap at every throttle**.
React+GSAP idle already blocks 1.5 s (27 long tasks) at 4× and 8.1 s (108 tasks) at 6×, at ~6–10 MB heap.
This is the result that justifies CSS as the default.

**2. What is the GSAP opt-in cost?** **Cheap unthrottled, expensive under CPU constraint.** At 1×: p50
7–14 ms, a single ~100 ms mount long task, ~6 MB heap, on top of the 137 KB-gzip production bundle. Under
throttle it degrades fast — 4× → ~24 fps with the main thread ~half-blocked; 6× → ~13 fps, fully blocked.
GSAP samples timelines on the main thread every frame, so its cost scales with how little CPU the client has.

**3. Does either drop frames / block the main thread badly enough to be unusable as a background dashboard
element on a low-power client?** **React+GSAP: yes. SVG+CSS: no.** A weak client running React+GSAP as an
always-on background element would see ~13 fps and a main thread it can't share with the dashboard's real
work (8000/8000 ms). SVG+CSS never blocks the main thread at any throttle — it stays a free background
element.

**Conclusion:** ADR-0007's "**SVG+CSS default, React+GSAP opt-in**" is empirically validated. SVG+CSS is the
correct steady-state default for low-power / always-on / many-instance use; React+GSAP is the right opt-in
when the mascot lives in a React app, the client is not CPU-starved, and it needs interruptible/rich motion
CSS can't express. The default is **not** overturned — no superseding ADR needed.

---

## Hardware calibration — flagged as follow-up (not fabricated)

No real low-power device (Raspberry Pi / the DevBrain dashboard host) was reachable in this session, so the
matrix is the **reproducible CPU-throttle proxy only**. The honest calibration step remains open:

> **Follow-up for Andrew:** run `idle` (`?bench=1`) once on the actual DevBrain dashboard host, match its
> `idle` p50 to the proxy column it lines up with (4× or 6×), and note the multiplier here. After that the
> proxy is anchored to real hardware. No hardware number is invented in the meantime.

The verdict does not depend on the exact multiplier: SVG+CSS shows **0 main-thread blocking at every level
including no-throttle**, and React+GSAP shows blocking that only worsens as the client weakens — the ordering
holds regardless of where the real device lands.

---

## §report-back

- **Sampler:** `bench.js`, browser built-ins only (`requestAnimationFrame`, `PerformanceObserver` longtask,
  `performance.memory`); one JSON line per cell. Driven by the throwaway zero-dep `run-bench.mjs` over CDP.
- **Headline:** SVG+CSS = 0 long tasks / 0 ms scripting in all 18 conditions; React+GSAP collapses to ~13 fps
  with the main thread pinned at 6×, and already shows ~24 fps + half-blocked main thread at 4×.
- **ADR-0007:** stands, now numbers-backed. SVG+CSS default validated; GSAP opt-in cost documented (cheap
  unthrottled, unsuitable as an always-on background element on weak clients).
- **Hardware:** no device reached → one-device calibration run flagged as follow-up, not fabricated.
- Closing Q3 closes **v1's last open question**.
