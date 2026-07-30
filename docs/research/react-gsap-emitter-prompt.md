# Next Stage Prompt — Schema-Lock + React+GSAP Emitter (completes Phase 3)

> ✅ **COMPLETED 2026-06-17.** Both deliverables shipped and live-verified.
> `rigged.json` is locked to **schema v2** (canonical pivots, structured channel keyframes,
> explicit yoyo/iteration; legacy CSS fields retained → SVG+CSS goldens byte-unchanged). The
> React+GSAP emitter lives at `tools/emit-react-gsap/`; the generated component rotates every
> part around its canonical pivot, walks the legs out-of-phase, interrupts active→alert
> cleanly, and honours reduced motion. Decision recorded in
> [ADR-0008](../adr/0008-rigged-json-schema-v2-lock.md). Next stage:
> [Phase 1 — Vectorize](phase-1-vectorize-prompt.md)
> ([plan](../plans/phase-1-vectorize-implementation-plan.md)).

Target: fresh Codex or Claude Code session working inside `C:\Users\student1\Dev\mascot-forge`.

Optimized for: the stage after Spike 01 resolved Q1 (ADR-0007: both targets, SVG+CSS
default, React+GSAP opt-in) and after the dependency-free **SVG+CSS emitter**
(`tools/emit-svg-css.ps1` + `docs/buildable-slice/generated/`) already shipped. Phase 3's
remaining half is the **React+GSAP emitter** — plus a **schema-lock** of `rigged.json` so
one JSON drives *both* emitters around identical pivots.

---

## Copyable prompt

```text
You are implementing the next stage of mascot-forge in C:\Users\student1\Dev\mascot-forge.
This completes Phase 3 ("one rigged.json → both emitters"). It is two coupled deliverables:
(1) lock the rig schema, (2) build the React+GSAP emitter. Favour clarity over cleverness.

## 0. Read first (do not skip)
- README.md and CONTEXT.md — concept and the project language (preserve it; see below).
- docs/technical-proposal.md §3 (rigged.json / Spine model), §4 (the pluggable Emitter
  interface), §7 (build plan; step 2 is this stage).
- docs/adr/0003-pluggable-emitter.md and docs/adr/0007-output-target-verdict-both-svg-css-default.md.
- spikes/01-emitter/FINDINGS.md — the comparison + §8 schema fixes. THIS IS THE SPEC for
  the schema-lock and the source of the golden React+GSAP behaviour.
- spikes/01-emitter/src/react-gsap/Mascot.tsx — the accepted hand-built golden the emitter
  must reproduce. Note the pivot fix it documents (clearProps wiped transformOrigin).
- spikes/01-emitter/src/svgPrep.ts — id-namespacing so two SVGs coexist on one page.
- docs/buildable-slice/devbrain-rigged.json — the contract you are about to lock.
- docs/buildable-slice/devbrain-svg-css.css and tools/emit-svg-css.ps1 — the EXISTING
  SVG+CSS emitter that ALSO consumes rigged.json. Any schema change must keep it working.

## 1. Preserve project language (from CONTEXT.md)
Buildable Slice · Output Target · Output Target Routing · Manual Part SVG · Animation State
· Clean Mascot Source · Future Expansion Note. Output Targets: SVG+CSS (default) and
React+GSAP (opt-in). Animation States are exactly idle, active, alert. `impact` stays a
transient accent under `accents`, never a state.

## 2. Deliverable A — schema-lock rigged.json (do FIRST)
Apply the three fixes from FINDINGS.md §8 so the contract is emitter-neutral:
1. Make ABSOLUTE pivot canonical. Each part already has both `origin` ("50% 0%") and an
   absolute `pivot` {x,y}; they currently DISAGREE (e.g. leg origin resolves to y≈152 but
   pivot.y=137). Treat `pivot` as source of truth; emitters derive the CSS `%` per part
   bbox at emit time. This is the exact bug Spike 01 hit (parts rotated around the wrong
   point). Fix the leg/part values so pivot and the bbox-derived `%` agree.
2. Replace CSS-string keyframes with a STRUCTURED CHANNEL form. Today
   `keyframes[].transform` is a CSS string ("rotate(14deg)", "scale(.985,1.035)"). Add a
   neutral channel shape per keyframe, e.g.
   { "offset": 0.5, "rotate": -18, "scaleX": 1, "scaleY": 1, "x": 0, "y": 0 }
   so a GSAP emitter consumes it without parsing CSS. Keep it lossless for the existing CSS
   recipes (breathe, blink, walk-left/right, antenna-pulse, recoil).
3. Make loop semantics EXPLICIT. Add `iteration` and a `yoyo` boolean per animation rather
   than inferring yoyo from `infinite` + symmetric keyframes.
Bump `version` to 2 and record a short migration note in the rig file's sibling README.

CRITICAL: tools/emit-svg-css.ps1 consumes the OLD shape. Either (preferred) update it to
derive CSS keyframe strings + `%` origins from the new channel/pivot form and re-emit the
SVG+CSS generated files, OR keep the CSS strings as a derived/back-compat field. Do not
break the SVG+CSS emitter. Its accepted goldens must remain byte-unchanged.

## 3. Deliverable B — the React+GSAP emitter
Build a small Node+TypeScript generator (this Output Target already uses npm; the SVG+CSS
one does not). Suggested home: tools/emit-react-gsap/ (its own package.json; do not pollute
the dependency-free SVG+CSS path).

The emitter MUST:
- Inputs default to the Manual Part SVG (docs/buildable-slice/devbrain-manual-part.svg) and
  the locked rigged.json.
- Emit a React + TypeScript Mascot component that renders the inline SVG and animates the
  rig part groups with GSAP timelines, driven entirely by rigged.json (states, durations,
  channel keyframes, pivots, yoyo/iteration).
- Reproduce the Spike 01 golden behaviour: idle = body breathe + eye blink; active =
  independent out-of-phase leg walk + body bob; alert = antenna pulse + moustache recoil +
  body jitter, and alert INTERRUPTS active cleanly.
- Apply transformOrigin from the canonical pivot so parts rotate/scale around the SAME
  point the SVG+CSS target uses (this is the FINDINGS pivot bug — verify legs stay hinged
  at the hip, eyes scale at centre, no white gap).
- Honour prefers-reduced-motion (static near-rest poses matching the SVG+CSS fallbacks).
- Namespace ids if more than one mascot can mount on a page (see svgPrep.ts).
- Be lifecycle-safe under React StrictMode (kill/restore tweens on state change; do NOT use
  clearProps:"transform" — it wipes transformOrigin).

## 4. Constraints
- Do not change ADR decisions. Do not delete or move accepted goldens
  (docs/buildable-slice/goldens/ — exactly the three reduced-motion PNGs).
- Do not copy, edit, or derive new files from DevBrain assets.
- Keep the SVG+CSS emitter dependency-free; confine npm to the React+GSAP emitter folder.
- Do not expand into vectorization, segmentation, Motion Intent UI, telemetry binding, or
  the GSAP-vs-CSS runtime benchmark (that is open question Q3, separate).
- Do not promote `impact` to a state.

## 5. Acceptance criteria
- [ ] rigged.json is version 2 with canonical pivots, structured channel keyframes, and
      explicit iteration/yoyo; pivot and bbox-derived % agree.
- [ ] tools/emit-svg-css.ps1 still runs; its generated SVG+CSS demo regenerates and the
      accepted goldens are byte-unchanged.
- [ ] The React+GSAP emitter generates a working Mascot component from rigged.json.
- [ ] Generated component: legs hinge at the hip, eyes blink at centre (no white gap),
      alert interrupts active, reduced motion respected — verified live.
- [ ] No DevBrain assets copied; impact never a state.

## 6. Verification
- Run the SVG+CSS emitter + its check script; confirm goldens unchanged.
- Build/run the generated React+GSAP component (reuse the spikes/01-emitter harness or a
  minimal Vite page). Confirm via DOM probes that each part's GSAP origin equals the
  canonical pivot, and that active leg rotation matches the rigged.json channel values.
- Scan changed files for TODO/TBD/FIXME.

## 7. Stop conditions — stop and ask before
- adding dependencies outside the React+GSAP emitter folder
- any schema change that would break the SVG+CSS emitter or alter accepted goldens
- deleting/moving/renaming files, or touching DevBrain assets
- changing ADR decisions or promoting impact to a state

## 8. Report back
Summarise: schema v2 diff + migration note; whether the SVG+CSS goldens stayed byte-equal;
the React+GSAP emitter design; live verification (pivots, leg rotation, interrupt, reduced
motion); and any further rigged.json schema friction discovered while building the second
emitter. Recommend the next stage (Phase 1 vectorize, or Q3 runtime benchmark, or Q6
confirm-UI decision).
```

## Setup note
This prompt is for an agentic tool with real system access. Deliverable A (schema-lock)
must land before B, and B must not regress the dependency-free SVG+CSS emitter or its
accepted goldens. Confirm paths and permissions before pasting.
