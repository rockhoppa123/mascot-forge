# DevBrain Integration — fresh-agent planning prompt

> 2026-06-26 supersession: this prompt is historical. DevBrain no longer integrates
> the mascot. The former DevBrain mascot now lives in `mascot-forge/assets/devbrain/`
> as the showoff asset and legacy baseline for before/after comparison.

> Copy everything below the line into a fresh Claude Code session rooted at
> `C:\Users\dev\Dev\mascot-forge`. Your deliverable is a **plan document**,
> not implementation. Do NOT edit any source file in either repo.

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the whole task.

You are writing the **DevBrain Integration implementation plan** for mascot-forge.
mascot-forge is a tool-chain that forges a PNG mascot into a data-reactive SVG+CSS
(or React+GSAP) animated component. The engine is now asset-agnostic (v1.1 shipped).
The next milestone is to **replace DevBrain's current PNG-sprite-swap mascot with the
forged SVG+CSS (or React+GSAP) mascot** so DevBrain's data drives real animation.

Your job: read both repos, understand the gap, and write a complete, unambiguous
implementation plan a fresh agent can execute without asking questions.

---

## 0. Read first (do not skip, in this order)

### mascot-forge (`C:\Users\dev\Dev\mascot-forge`)
1. `docs/technical-proposal.md` §1–§5 — pipeline overview, four phases, two output targets.
2. `docs/buildable-slice/README.md` — what the SVG+CSS buildable slice is and its files.
3. `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` — open mentally;
   understand what the emitted demo contains (SVG object + JS state router + CSS vars).
4. `runtime/mascot-state.js` — the orchestrator core (state machine + `data-state` writer).
5. `tools/emit-react-gsap/src/useMascotState.ts` — the React hook wrapping the runtime.
6. `tools/emit-react-gsap/generated/Mascot.tsx` — the emitted React+GSAP component.
7. `docs/research/research-log.md` §Q1, §Q3 — why SVG+CSS is the default target.
8. `spikes/03-second-asset/FINDINGS.md` §8 "What the emitted files actually are" —
   understand the shape of both output targets.
9. `spikes/01-emitter/FINDINGS.md` — original shoot-out; cross-target summary.

### DevBrain (`C:\Users\dev\Dev\DevBrain`)
10. `components/mascot/devbrain-mascot.tsx` — current PNG-sprite-swap component (full file).
11. `lib/mascot-pose.mjs` — `resolveMascotPose`: maps `DevBrainMascotState` → pose + loop.
12. `lib/mascot-contract.test.mjs` — the contract test that guards the mascot API.
13. `app/mascot-smoke/` — the `/mascot-smoke` smoke-test route (entry point + page).
14. `components/landing/mascot-showcase.tsx` — where the mascot is rendered on the landing page.
15. `public/mascot/` — the PNG sprite files currently served.
16. Grep for `DevBrainMascot` across the repo to find every call-site.
17. Grep for `mascot-state` or `useMascotState` to confirm none exists yet.
18. `package.json` — note installed deps (motion/react, next, react); note what is NOT there
    (gsap, @gsap/react).

---

## 1. Context you must carry

**mascot-forge pipeline output (what exists today):**
- `docs/buildable-slice/generated/devbrain-svg-css.generated.svg` — the forged SVG
  (mascot parts as named `<g>` groups, CSS `transform-origin` on each, `data-state`
  attribute on root `<svg id="mascot">`).
- `docs/buildable-slice/generated/devbrain-svg-css.generated.css` — keyframe animations
  keyed to `[data-state="idle"]`, `[data-state="active"]`, `[data-state="alert"]`.
- `runtime/mascot-state.js` — sets `svg.dataset.state` from a state machine; injectable
  data source (poll, WebSocket, or direct call). Has no React dep.

**DevBrain mascot today:**
- 8 states (`DevBrainMascotState`): default, thinking, diagnostic, offline, reboot, happy,
  caution, blocked, critical, alert, asleep, sleepy (see the type in `devbrain-mascot.tsx`).
- Renders one PNG per pose via `next/image`; motion = Framer Motion `<motion.div>` hop.
- Pose resolution lives in `lib/mascot-pose.mjs` (maps multi-state → 8 art poses).
- Call-sites pass a `state` prop; a parent (panel or page) decides which state to show.
- `/mascot-smoke` is the acceptance test route.

**Key decisions the plan must resolve:**

D1 — **Output target**: SVG+CSS or React+GSAP?
- SVG+CSS: no new deps; works as `<object>` or inlined; orchestrator is vanilla JS.
  Downside: `<object>` embed does not inherit React context; inline SVG is large.
- React+GSAP: native React component; richer interrupts; needs `gsap` + `@gsap/react`
  (~45 kB gzipped), which DevBrain does NOT currently have.
- ADR-0007 says SVG+CSS is default; Q3 spike confirmed it costs zero main-thread on
  throttled clients. Recommend SVG+CSS unless you find a hard blocker.

D2 — **State mapping**: DevBrain's 8+ states → mascot-forge's 3 (idle / active / alert).
- The plan must propose a concrete mapping table and justify each row.
- idle = calm / resting (default, asleep, sleepy, offline?)
- active = something is happening (thinking, diagnostic, happy, reboot?)
- alert = something needs attention (caution, blocked, critical, alert?)
- The plan must state whether the current `DevBrainMascotState` type is kept, narrowed,
  or aliased — and what changes at call-sites if the type changes.

D3 — **Component boundary**: drop-in swap vs new component?
- Option A: Replace internals of `devbrain-mascot.tsx` with the forged mascot; keep the
  same props API so zero call-sites change.
- Option B: New `ForgedMascot` component alongside the existing one; migrate call-sites
  incrementally.
- Recommend A unless the prop surface is incompatible.

D4 — **SVG delivery**: `<object>` embed vs inline SVG vs `next/image`-style static?
- `<object data="...svg">` — simplest; CSS file applies via the SVG's own `<?xml-stylesheet?>`;
  orchestrator sets `data-state` on the inner SVG via `contentDocument`. One caveat:
  same-origin only.
- Inline SVG — copy SVG into JSX; large (~3k rects) but no fetch; React controls the DOM.
- Static SVG served from `/public` — Next.js serves it, `<object>` fetches it.

D5 — **Orchestrator wiring**: what drives the state machine in DevBrain?
- The orchestrator (`mascot-state.js`) needs a data source to decide idle/active/alert.
- DevBrain already resolves mascot state from panel data (system health, Hermes status).
  That logic is in `lib/mascot-pose.mjs`.
- The plan must say whether `mascot-state.js` is wired to a DevBrain server adapter,
  called directly from the React component with the resolved state, or something else.

---

## 2. Deliverable

Write `docs/devbrain-integration-implementation-plan.md` in `C:\Users\dev\Dev\mascot-forge`.

The plan must include:
- **Goal** (one paragraph — what done looks like).
- **Decisions** (D1–D5 resolved with reasoning, one paragraph each).
- **File map** — every file touched in both repos, one line per file, what changes.
- **Work items** (W-prefixed, ordered, each with: what, acceptance criterion, regression gate).
  - First item must be: merge `feature/v1.1-generalisation` → `master` in mascot-forge.
  - Include a DevBrain branch name (`feat/forged-mascot` or similar).
  - Include a DevBrain `/mascot-smoke` acceptance test update as a mandatory item.
  - Include a mascot-forge `check-all.ps1` gate run as a mandatory item (proves no regression).
- **What is NOT changing** (explicit out-of-scope list — DevBrain data adapters, Hermes
  wiring, other panels, the mascot-forge pipeline itself).
- **Open risks** — anything that might block execution (e.g. `<object>` same-origin on
  the deployed CT202 container, GSAP license if D1 flips to React+GSAP, CSS `@keyframes`
  specificity vs DevBrain's Tailwind global styles).

Format: dense bullets over paragraphs. Use the existing plan docs in `docs/` as style reference.

Do NOT create any other files. Do NOT edit any source file. Do NOT open a browser.
Write the plan, then stop.
