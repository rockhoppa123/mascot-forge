# Spike 01 — Emitter Shoot-out (implementation prompt)

Hand this prompt to a coding agent (Codex or a fresh Claude Code session) run **inside
`C:\Users\student1\Dev\mascot-forge`**. It is self-contained; the agent should read the
referenced repo files first.

---

## PROMPT (copy from here ⬇)

You are implementing **Spike 01** for the open-source project `mascot-forge`. Work inside
the repo at `C:\Users\student1\Dev\mascot-forge`. This is a **throwaway spike to learn
from**, but two of its outputs are keepers (a hand-segmented SVG and a written comparison)
that later phases depend on. Favour clarity over cleverness.

### 0. Read first (do not skip)
- `README.md` — overall concept and the pipeline diagram.
- `docs/product-discovery.md` — §3.4 (the idle/active/alert telemetry states) and §5
  (success criteria).
- `docs/technical-proposal.md` — §3 (Phase-2 output: the `rigged.json` Spine model), §4
  (the two emitters and the `Emitter` interface), §7 step 1 (this spike).
- `docs/adr/0003-pluggable-emitter.md` and `docs/adr/0005-pixel-art-poc-first.md`.
- `assets/README.md` + `assets/devbrain-mascot-reference-v1.png` — the mascot art and the
  baseline you must beat. Also inspect the current implementation for context:
  `C:\Users\student1\Dev\DevBrain\components\mascot\devbrain-mascot.tsx` (it swaps
  pre-rendered PNG poses — that's the flipbook you're replacing with a real rig).

### 1. Why this spike exists
Settle, **empirically**, the project's biggest open question (Q1 in
`docs/research/research-log.md`): is the right output **React + GSAP**, **SVG + CSS**, or
**both**? You will build the *same* mascot, with the *same* three states, **twice** — once
per emitter target — from one shared, hand-segmented SVG, then compare. This also produces
the **golden-file target** that Phase 3's code generator must later reproduce.

### 2. The asset
The DevBrain mascot is pixel-art: an **orange moustache-shaped body** with two **optical
blocks (eyes)**, two **dark-grey legs**, two small **arms**, and a **green right-angled
antenna**. Parts are colour-separable. Use `assets/devbrain-mascot-reference-v1.png` as the
visual reference (it shows the DEFAULT/THINKING/HAPPY/DIAGNOSTIC/REBOOT poses).

### 3. Deliverables (create under `spikes/01-emitter/`)

**a) `mascot.svg` — the hand-segmented rig source (KEEPER).**
- Inline SVG, viewBox matching the art. Recreate the mascot as clean `<rect>` pixel
  geometry (this is pixel art — no curve tracing; a faithful blocky reproduction is fine).
- Group every moving part under a semantic `<g id="...">`: `body`, `eye-left`, `eye-right`,
  `arm-left`, `arm-right`, `leg-left`, `leg-right`, `antenna`.
- Set a sensible `transform-origin` (pivot) per part: legs pivot at the hip line, antenna
  at its base, arms at the shoulder. Use `transform-box: fill-box`.

**b) `rigged.json` — the rig data model (KEEPER, validates the schema).**
- Author by hand following the **Spine model** (see technical-proposal §3): an ordered
  `bones` array, parent-before-child, each `{ name, parent, x, y, rotation }`, plus, for
  each part, its SVG `<g>` id and computed `transform-origin`. This is the seed contract
  for Phase 3 — keep it minimal but complete enough to drive both emitters.

**c) `react-gsap/Mascot.tsx` — emitter target A.**
- A React + TypeScript component rendering the inline SVG, animated with **GSAP** (now
  100% free incl. all plugins). Use GSAP timelines keyed on the part transform-origins.
- Prop: `state: "idle" | "active" | "alert"`. Switching state transitions the animation.

**d) `svg-css/` — emitter target B.**
- `mascot.svg` (same geometry) + `mascot.css` (CSS keyframes, GPU-friendly transforms) +
  a tiny vanilla `state.js` that toggles a `data-state` attribute. No React, no GSAP.

**e) Demo harness.**
- A Vite + React + TS app (`spikes/01-emitter/`) with a single page showing **both
  implementations side by side** and three buttons: Idle / Active / Alert. Keep setup
  minimal.

**f) `FINDINGS.md` — the comparison (KEEPER).** See §6.

### 4. The three states (must visibly beat the PNG baseline)
The baseline can't articulate parts — your rig must. Implement:
- **idle** — subtle vertical "breathing" translate on the whole body (~2–3 px, slow ease).
- **active** — a **walk-cycle**: `leg-left` and `leg-right` rotate **independently and out
  of phase** at their hip pivots, with a slight body bob. *This is the headline proof —
  the PNG flipbook physically cannot do this.*
- **alert** — rapid **antenna** pulse (scale/rotate at its base) + a short body **jitter**.
Transitions: `alert` should interrupt/override whatever is playing.

### 5. Constraints
- Honour `prefers-reduced-motion: reduce` (fall back to a near-static pose) in both targets.
- Keep both implementations rendering the *same* SVG geometry so the comparison is fair.
- TypeScript for the React side. GSAP via npm. Throwaway-grade wiring is fine, but
  `mascot.svg`, `rigged.json`, and `FINDINGS.md` must be clean — they're reused.
- Do **not** build any pipeline/automation here. This is hand-built on purpose.

### 6. `FINDINGS.md` must answer
For each emitter (react-gsap vs svg-css), record:
- **DX** — how fiddly was authoring the 3 states? What hurt?
- **Code** — line count + gzipped bundle size (incl. the runtime: GSAP vs none).
- **Capability** — could it do the walk-cycle / interrupting alert cleanly?
- **Perf feel** — smoothness; any jank on a throttled CPU (use devtools 6× throttle).
- **Editability** — how readable/tweakable is the output for a downstream developer?
Then a verdict: **React+GSAP, SVG+CSS, or both** for v1 — with the reasoning. If "both",
say which is the default and when to pick the other. This verdict resolves Q1 and should
be written up as a new ADR (`docs/adr/0006-...`).

### 7. Done when
1. `npm run dev` shows both mascots side by side; the three buttons work in both.
2. The **active** state shows independent leg motion (proof of articulation).
3. `prefers-reduced-motion` is respected.
4. `FINDINGS.md` has the filled comparison + a clear verdict.
5. `mascot.svg` + `rigged.json` are clean and committed.

### 8. Report back
Summarise: the verdict + why, the bundle-size delta, the biggest surprise, and any change
you'd make to the `rigged.json` schema based on actually using it. Propose the ADR-0006
text.

## (⬆ copy to here)

---

## Where this lives / next
- Spike code: `spikes/01-emitter/` in this repo (throwaway; keep `mascot.svg`,
  `rigged.json`, `FINDINGS.md`).
- After the spike: write **ADR-0006** (output-format verdict), flip **Q1 → 🟢** in
  `docs/research/research-log.md`, and carry `rigged.json` forward as the Phase-3 contract.
