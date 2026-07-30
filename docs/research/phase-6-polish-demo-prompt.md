# Phase 6 (Polish & Demo) — fresh-agent implementation prompt

> Copy everything below the line into a fresh Claude Code session at
> `C:\Users\student1\Dev\mascot-forge`. Companion design doc:
> [`docs/phase-6-polish-demo-implementation-plan.md`](../plans/phase-6-polish-demo-implementation-plan.md).

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the entire task. This is the final "polish & demo" phase — the engine already works end-to-end, so the temptation to over-build is the main risk. Every choice must be the laziest thing that actually works: edit the README rather than write a site, reuse the locked generated SVG rather than render anything new, one thin script over the checks that already exist rather than a test framework. Question whether each new file needs to exist at all (YAGNI).

You are implementing Phase 6 (Polish & Demo) of mascot-forge in C:\Users\student1\Dev\mascot-forge. This is step 6 (final) of the build plan. Only make changes directly requested. Do NOT add new pipeline capability, files, abstractions, dependencies, or features beyond this phase — the engine is feature-complete for v1; this phase only makes it legible and showable.

## Context (carry forward — Phases 1–4 all shipped)
- Pipeline, all DONE: PNG →[P1 vectorize ✅]→ flat.svg →[P2 segment ✅]→ named parts + pivots →[P3 codegen ✅]→ emitters →[P4 orchestrator ✅]→ data-reactive mascot.
- P4 shipped a dep-free state machine (`runtime/mascot-state.js`) + React hook (`tools/emit-react-gsap/src/useMascotState.ts`) + a static `docs/buildable-slice/orchestrator-demo.html` that fetches+injects the locked generated SVG and drives `data-state` from a mock feed. REUSE that mechanism — do not rebuild it.
- LOCKED ground truth, MUST NOT be overwritten/altered: devbrain-rigged.json, devbrain-manual-part.svg, both emitters (emit-svg-css.ps1, emit-react-gsap/), the accepted reduced-motion goldens, the locked generated demo (devbrain-svg-css.generated-demo.html), the generated SVG/CSS, every ADR. The Clean Mascot Source PNG (`assets/devbrain/poses/default.png`) is read-only — never touch it.

## 0. Read first (do not skip)
- docs/phase-6-polish-demo-implementation-plan.md — the full design (file map, ponytail audit, steps). This prompt is the operational summary; the plan is the detail.
- README.md (root) — CURRENTLY STALE: status says "pre-alpha / research + design phase … No runtime code yet" (false); pipeline diagram has no ✅ markers; layout block omits runtime/ and tools/; decisions table stops at ADR-0005. This is the #1 thing to fix.
- docs/technical-proposal.md §7 (build plan — step 6 is this phase) and §9 (open questions, Q3).
- docs/buildable-slice/orchestrator-demo.html — the Phase-4 "after" surface you REUSE for the showcase.
- docs/buildable-slice/README.md — the slice file table you extend.
- CONTEXT.md — preserve project vocabulary (Animation State, Output Target, Buildable Slice, Clean Mascot Source, rigged.json, Manual Part SVG).

## 1. Goal
Close the build plan by making the working v1 self-evidently real and runnable. Four deliverables: (1) a truthful README with a run/quickstart section; (2) docs that mark shipped phases done; (3) one command that runs every check; (4) a static before/after page contrasting the PNG baseline with the forged, articulated, data-reactive mascot. NO new pipeline capability, NO web app, NO docs site, NO new dependency.

## 2. Deliverables (ponytail: 1 new file + 3 edits + showcase)
- **README.md (edit)** — flip status to "v1 buildable slice complete" (pre-1.0, single-asset); add ✅ to the pipeline diagram for P1–P4; add a **Run / Quickstart** section (run emit-svg-css.ps1, run check-all.ps1, open the generated demo + orchestrator demo + showcase via a static HTTP server); refresh the repository-layout block (runtime/, tools/, docs/buildable-slice/generated/); extend the design-decisions table with ADR-0006…0009. KEEP the existing wedge/positioning prose — it is accurate.
- **docs/buildable-slice/showcase.html (new)** — static, dep-free, two panels. BEFORE = the baseline asset (assets/devbrain-mascot-reference-v1.png OR the source pose) labelled as the whole-sprite flipbook baseline that can't articulate. AFTER = fetch+inject the locked generated/devbrain-svg-css.generated.svg and drive it with the Phase-4 core (runtime/mascot-state.js) from a mock feed, auto-cycling states. Caption the contrast (independent part articulation + reacts to live data). NO new assets, NO new rendering code — reuse orchestrator-demo.html's mechanism.
- **tools/check-all.ps1 (new)** — run check-flat-svg.ps1, check-segmented.ps1, check-buildable-slice.ps1, check-orchestrator.ps1, and `node runtime/mascot-state.test.mjs` in sequence; fail-fast on first non-zero exit; print a per-check ✅/❌ summary + a final pass/fail line. Thin sequential wrapper — NO test framework.
- **docs/technical-proposal.md §7 (edit)** — mark step 5 (Phase 4) ✅ with date + plan link; mark step 6 (this phase) ✅/done.
- **docs/buildable-slice/README.md (edit)** — add orchestrator-demo.html + showcase.html rows to the file table; one-line note that they need a static HTTP server (they fetch the generated SVG).

## 3. Verify
- One command: `tools/check-all.ps1` exits 0 with every sub-check ✅ (P1, P2, P3 slice, P4 orchestrator, node determinism test).
- Locked artifacts byte-UNCHANGED: rigged.json, manual-part.svg, both emitters, the goldens, the locked generated demo, the generated SVG/CSS, every ADR (confirm via git status).
- README truthful: no "no runtime code" / "planned" language remains for shipped phases; the Run section commands actually work.
- Visual proof: the showcase renders BEFORE (PNG) vs AFTER (rigged, auto-cycling idle→active→alert→idle) in a browser. Serve via a static HTTP server (the page fetches the generated SVG — file:// will be blocked by CORS). Share a screenshot — do not ask the human to check manually.
- Scan changed/new files for TODO/TBD/FIXME.

## 4. Constraints / non-goals
- NO new pipeline capability — packaging only; the engine is feature-complete for v1.
- NO web app, NO docs site, NO marketing site, NO CI/GitHub Actions, NO GIF/video capture pipeline. Static page + one wrapper script.
- NO npm at the repo root, NO new dependency anywhere, NO new rendering/animation/emitter code.
- NO emitter changes, NO edits to rigged.json / manual-part.svg / the locked generated demo / the generated SVG/CSS / any golden / any ADR.
- NO edits to the DevBrain repo. NO Q3 benchmark run (flag it as runnable only).

## 5. Acceptance criteria
- [ ] README.md status is truthful (v1 shipped), has a working Run/Quickstart section, ✅ pipeline diagram, refreshed layout + decisions table; positioning prose preserved.
- [ ] docs/buildable-slice/showcase.html renders a static before/after, reusing the locked generated SVG + the Phase-4 core, auto-cycling states (shared screenshot).
- [ ] tools/check-all.ps1 runs all five checks fail-fast and exits 0.
- [ ] technical-proposal §7 marks Phase 4 ✅ and Phase 6 done; slice README lists the orchestrator demo + showcase.
- [ ] all locked artifacts byte-unchanged; no TODO/TBD/FIXME in changed files.

## 6. Stop and ask before
- adding ANY dependency, npm at the repo root, a build step, a framework, or CI config.
- overwriting/altering rigged.json, the Manual Part SVG, either emitter, the generated SVG/CSS, the locked generated demo, any golden, or any ADR.
- building anything beyond a static page + one script (no web app, no docs site).
- writing/altering any new pipeline feature — if you think v1 is missing something, FLAG it, do not build it in this phase.

## 7. Checkpoints
- After reading the plan + README + docs: output a 3–5 line ponytail plan (the laziest viable approach to the four deliverables), then proceed.
- After each step output: ✅ [what was completed].
- Write a new ADR ONLY if you change a documented decision (polish changes none, so none is expected).

## 8. Report back
What changed in the README (status + run + layout + decisions); the showcase design (before PNG baseline vs after rigged+data-reactive, reusing the locked SVG + Phase-4 core) with the shared screenshot; the check-all.ps1 summary output; confirm all locked artifacts byte-unchanged; note Q3 (GSAP-vs-CSS low-power benchmark) as the natural next work after v1 close-out; flag any gap that would block calling v1 "done."
