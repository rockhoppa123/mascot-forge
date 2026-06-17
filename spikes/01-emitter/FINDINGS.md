# Spike 01 — Emitter Shoot-out: Findings

**Date:** 2026-06-17
**Question settled:** Q1 — React+GSAP vs SVG+CSS vs both for v1 Output Targets.
**Method:** Built the *same* DevBrain mascot, with the *same* three states, *twice* — once
per emitter — from **one shared, hand-segmented SVG** (`src/mascot.svg`) and **one shared
rig contract** (`src/rigged.json`). Both reuse the human-accepted buildable-slice assets
(`docs/buildable-slice/devbrain-manual-part.svg` + `devbrain-rigged.json`) so the geometry
is identical and the comparison is fair. Run with `npm run dev`.

> Reconciliation note: the original spike prompt predated the project's switch to
> "Buildable Slice" language and assumed it would author a fresh SVG/rig and write the
> verdict as ADR-0006. Both were already taken: the SVG+CSS Output Target and an accepted
> SVG/rig exist in `docs/buildable-slice/`, and ADR-0006 is "research-first-buildable-slice".
> This spike therefore **reused** the accepted geometry, **added the missing React+GSAP
> target**, and writes the verdict as **ADR-0007**.

---

## What was verified live (preview MCP)

- Both targets render the identical 7-part rig (`part-body`, `part-eyes`, `part-moustache`,
  `part-antenna`, `part-leg-left`, `part-leg-right`) from the same SVG. Zero duplicate DOM
  ids (the GSAP copy is id-namespaced — see `src/svgPrep.ts`).
- **active**: GSAP legs swing **+13° → −18°**, left/right **exact mirror** (independent,
  out-of-phase). This is the headline proof — the PNG flipbook baseline cannot articulate
  parts.
- **alert interrupts active**: switching to alert kills the leg tweens (no transform) and
  pulses the antenna to **scale 1.16**.
- **reduced motion**: antenna holds a static **1.08** pose and does not animate.

---

## Per-emitter comparison

### DX — how fiddly was authoring the 3 states?
| | React + GSAP | SVG + CSS |
|---|---|---|
| Authoring model | Imperative timelines per state; full control | Declarative `@keyframes` + state selectors |
| What hurt | Lifecycle management: had to `ctx.revert()` on every state change, account for React StrictMode double-invoke, and discover that **GSAP animates SVG via the `transform` *attribute*** (baking the pivot into a matrix translation) — so CSS `transform-box: fill-box` / `transform-origin` do **not** govern it. | Almost nothing for loops; the pain is **interrupting** — CSS animations restart from their own `0%` on state swap, so an interrupt can visibly snap unless you cushion it with `transition`. |
| Net | More moving parts, but more power | Simplest possible for periodic motion |

### Code — line count + shipped runtime (gzipped)
| | React + GSAP | SVG + CSS |
|---|---|---|
| Source | `Mascot.tsx` **156 lines** (+58-line namespacing helper, only needed for the side-by-side harness) | `Mascot.tsx` **34 lines** wrapper + `mascot.css` **134 lines** |
| Runtime shipped (gzip) | GSAP **28.3 KB** + (if React) react **2.7 KB** + react-dom **42.3 KB** ≈ **73 KB**; vanilla-GSAP floor is **28.3 KB** | **0 KB JS** — CSS **1.2 KB** gzip + ~6 lines vanilla JS to toggle `data-state` |
| Shared geometry (both) | `mascot.svg` 493 KB raw / **46 KB gzip** — counts once, served once; this dominates *both* and is independent of the emitter choice |

### Capability — walk-cycle / interrupting alert
- **Walk cycle:** both clean. Independent out-of-phase leg rotation is trivial in each.
- **Interrupting alert:** **GSAP wins.** `ctx.revert()` kills running tweens and the alert
  timeline starts from the current value → smooth override. CSS swaps the active keyframe
  for the alert keyframe, which starts at *its* `0%` and can snap.

### Perf feel
- **SVG+CSS:** browser-native compositor, **zero main-thread JS** per frame. Best under CPU
  throttle and best when many mascots render at once.
- **React+GSAP:** one rAF ticker on the main thread; smooth for a single mascot, but cost
  scales with instance count × active tweens. Fine here; a consideration at scale.
- Both use GPU-friendly `transform` only — no layout thrash observed.

### Editability (for a downstream developer)
- **SVG+CSS:** most readable and portable. A developer reads the `@keyframes` directly and
  tweaks numbers; no framework knowledge or build step required.
- **React+GSAP:** more expressive but requires reading imperative timeline code and knowing
  GSAP. Better when motion is dynamic/parameterized.

---

## Verdict — **both**, SVG+CSS as the default

Ship **SVG+CSS as the default Output Target**, and offer **React+GSAP** as the opt-in for
richer cases. This empirically confirms the Output Target Routing already sketched in
`CONTEXT.md`.

**Default to SVG+CSS when** the mascot is portable/embeddable, the motion is looping or
state-keyed, bundle size matters, the host isn't necessarily React, or the output must be
human-reviewable and dependency-free. (Tiny, zero-runtime, declarative, trivially generated
and golden-tested.)

**Pick React+GSAP when** the mascot lives in a React app **and** needs:
- mid-tween **interrupts** / clean state overrides (e.g. telemetry flips idle→alert), or
- sequenced/choreographed or dynamically-parameterized motion, or
- runtime control the CSS keyframe model can't express cleanly.

The shared `rigged.json` drove both targets' timing and pivots without modification, which
is the load-bearing result: **one rig contract → two emitters** is viable.

---

## §8 report-back

- **Verdict + why:** both; SVG+CSS default (size/portability/editability), React+GSAP for
  interruptible/rich React mascots. Confirms Q1 empirically.
- **Bundle delta:** ~**73 KB gzip** runtime (React+GSAP) vs **~0 KB** (SVG+CSS), on top of
  the shared 46 KB-gzip SVG that both pay regardless.
- **Biggest surprise:** GSAP animates SVG through the `transform` **attribute** and computes
  its own pivot, so CSS `transform-box`/`transform-origin` are inert on the GSAP path. The
  two runtimes resolve the *same* pivot data slightly differently (GSAP legs swung a touch
  wider than CSS). This is the main fidelity risk for a pipeline that must emit *matching*
  motion to both targets.

### Proposed `rigged.json` schema changes (from actually using it)
1. **Make absolute pivot canonical.** The fixture stores both `origin` ("50% 0%") and
   `pivot` ({x,y}). CSS consumes `%`, GSAP bakes absolute — they can drift. Treat the
   absolute `pivot` as the source of truth and derive the `%` per part-bbox at *emit* time
   so both emitters rotate around the identical point.
2. **Replace CSS-string keyframes with a structured channel form.** `keyframes[].transform`
   is currently a CSS string (`"rotate(14deg)"`, `"scale(.985,1.035)"`). The CSS emitter
   uses it verbatim; a GSAP emitter must parse it. Store neutral channels instead, e.g.
   `{ offset, rotate, scaleX, scaleY, x, y }`, so both emitters consume without string
   parsing.
3. **Make loop semantics explicit.** CSS infers yoyo from `infinite` + symmetric keyframes;
   GSAP needs an explicit `yoyo`/`repeat`. Add `iteration`/`yoyo` fields so emitters don't
   have to guess.
