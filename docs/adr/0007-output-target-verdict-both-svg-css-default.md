# ADR-0007 — Output Target verdict: ship both, SVG+CSS as the default

- **Status:** Accepted
- **Date:** 2026-06-17
- **Resolves:** Q1 in `docs/research/research-log.md`
- **Evidence:** `spikes/01-emitter/FINDINGS.md` (built both targets from one shared rig)
- **Validated empirically 2026-06-18** — 18-cell CPU-throttle runtime benchmark (Q3): SVG+CSS shows 0 main-thread long tasks / 0 ms scripting at every throttle (pure compositor), React+GSAP pins the main thread at ~13 fps under 6× throttle. SVG+CSS-default verdict holds. See `spikes/02-runtime-cost/FINDINGS.md`.

## Context
Q1 asked whether mascot-forge's first Output Target should be **React+GSAP**, **SVG+CSS**,
or **both**. ADR-0003 already made the emitter pluggable; ADR-0005 made pixel-art the
first proof. The buildable slice built the **SVG+CSS** target only and left the comparison
open. Spike 01 settled it empirically: the *same* DevBrain mascot, the *same* three states
(`idle`/`active`/`alert`), built *twice* from one shared hand-segmented SVG and one shared
`rigged.json`, then compared on DX, code/runtime size, capability, perf feel, and
editability.

## Decision
Support **both** Output Targets and make **SVG+CSS the default**.

- **SVG+CSS — default.** ~0 KB JS runtime (CSS ~1.2 KB gzip + a few lines of vanilla JS),
  declarative `@keyframes`, browser-native compositor, no framework requirement, trivially
  human-reviewable and golden-testable. Best for portable/embeddable mascots, looping or
  state-keyed motion, many simultaneous instances, and non-React hosts.
- **React+GSAP — opt-in.** ~73 KB gzip runtime (GSAP 28.3 KB + React/ReactDOM ~45 KB; or a
  28.3 KB vanilla-GSAP floor). Chosen when the mascot lives in a React app **and** needs
  mid-tween interrupts / clean state overrides (e.g. telemetry idle→alert), sequenced or
  dynamically-parameterized motion, or runtime control the CSS keyframe model can't express.

Both consume one `rigged.json`. The shared rig drove both emitters' timing and pivots
unchanged — "one rig contract → two emitters" is confirmed viable.

## Consequences
- The Output Target Routing sketched in `CONTEXT.md` is now evidence-backed, not assumed:
  SVG+CSS = portable/lightweight default; React+GSAP = richer/interruptible React mascots.
- The Phase-3 code generator must target **both** emitters from the same `rigged.json`.
- `rigged.json` needs three changes before it is a robust cross-emitter contract (recorded
  in `FINDINGS.md` §8): (1) make the **absolute pivot canonical** and derive CSS `%`
  origins at emit time — the two runtimes resolve pivots differently (GSAP animates via the
  SVG `transform` *attribute*, so CSS `transform-box`/`transform-origin` are inert on the
  GSAP path); (2) replace CSS-string keyframes with a **structured channel form**
  (`{offset, rotate, scaleX, scaleY, x, y}`) so a GSAP emitter need not parse CSS; (3) make
  **loop semantics explicit** (`iteration`/`yoyo`) rather than inferred.
- The biggest fidelity risk for an automated pipeline is the GSAP-vs-CSS pivot computation
  difference; the schema changes above are the mitigation.
```text
Superseded decisions: none. Extends ADR-0003 (pluggable emitter) with a concrete v1 choice.
```
