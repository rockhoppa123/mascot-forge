# Phase 6 — Polish & Demo: Implementation Plan

**Status:** 📋 planned. Created 2026-06-18.
**Build-plan position:** step 6 (final) of [`technical-proposal.md` §7](technical-proposal.md). Phases 3
(codegen + schema-lock v2), 1 (vectorize), 2 (assisted segmentation), and 4 (orchestrator) are all
complete. This is the closing phase: make the finished pipeline **legible and showable** — it adds
no new pipeline capability.

> **Ponytail framing.** The engine already works end-to-end: PNG → flat.svg → segmented parts →
> emitters → a data-reactive mascot. Phase 6 is **not** new functionality; it is *truth-telling and
> packaging*. The single highest-value act is fixing the root `README.md`, which still claims
> "pre-alpha … No runtime code yet" — that is now false and is the first thing a portfolio visitor
> reads. Everything else (a before/after page, a one-command check) reuses artifacts that already
> exist. The laziest version: edit one README, add one static showcase page that reuses the locked
> generated SVG, and one thin script that runs the checks we already have. No web app, no docs site,
> no new dependency, no new rendering code.

---

## Goal

Close the build plan by making the working v1 **self-evidently real and runnable**:

1. **README demo** — the root `README.md` reflects reality (pipeline shipped, how to run it), not the
   stale research-phase status.
2. **Docs** — the build plan and slice docs mark Phase 4/6 done and point at the runnable surface; no
   dangling "no runtime code" / "planned" language for shipped phases.
3. **Tests** — one command runs every phase check + the orchestrator self-check, so the whole pipeline
   is verifiable in a single step.
4. **Before/after vs the PNG baseline** — one static page that puts the original DevBrain mascot
   (static/flipbook PNG, whole-sprite motion) next to the forged, part-articulated, data-reactive
   mascot — the visual proof that mascot-forge beats its own baseline (README §"The origin: DevBrain").

This is the portfolio close-out (mascot-forge is portfolio-first, MIT — ADR-0004).

---

## Evidence basis (documented)

- **[technical-proposal.md §7 step 6](technical-proposal.md)** — Phase 6 scope verbatim: "Polish &
  demo. README demo, docs, tests, before/after vs. the PNG baseline."
- **Stale `README.md`** — line 11–12 still says *"Status: pre-alpha / research + design phase … No
  runtime code yet."* The pipeline diagram (§Pipeline) has **no ✅ markers**; the repository-layout
  block omits `runtime/`, `tools/`, and the generated buildable slice; the design-decisions table
  stops at ADR-0005 (0006–0009 exist).
- **Baseline asset** — `assets/devbrain/` is "test case #1 … the baseline mascot-forge must beat"
  (README §showoff asset). The Clean Mascot Source is the read-only
  `assets/devbrain/poses/default.png` (192×192, 15670 bytes — do not touch).
- **Forged "after" surface (reuse, do not rebuild):** `docs/buildable-slice/orchestrator-demo.html`
  (Phase 4) already fetches+injects the locked `generated/devbrain-svg-css.generated.svg` and drives
  `data-state` from a mock feed. The showcase reuses this exact mechanism.
- **Existing checks to aggregate:** `check-flat-svg.ps1` (P1), `check-segmented.ps1` (P2),
  `check-buildable-slice.ps1` (P3 slice), `check-orchestrator.ps1` (P4) + `node runtime/mascot-state.test.mjs`.
- **[research-log Q3](research/research-log.md)** — GSAP-vs-CSS low-power benchmark is 🔴 "now
  unblocked" but **empirical / separate**; Phase 6 flags it as runnable, does not run it.

---

## Scope

**In scope (the four deliverables above), and nothing else.** Polish means *make the existing thing
legible*, not add features. Concretely:

- Rewrite the README **status + run + layout + decisions** to match the shipped pipeline; keep the
  existing positioning/wedge prose (it is still accurate and good).
- One static, dep-free **before/after showcase page** reusing the locked generated SVG via fetch+inject.
- One **`check-all.ps1`** that runs the four phase checks + the node test fail-fast with a summary.
- Mark Phase 4 (and this Phase 6) **✅** in `technical-proposal.md §7`; add the orchestrator demo +
  showcase to the slice `README.md` file table.

**State vocabulary preserved everywhere:** Animation State, Output Target, Buildable Slice, Clean
Mascot Source, `rigged.json`, Manual Part SVG.

---

## Planned files (ponytail audit — 1 new, 3 edits)

| File | Action | Why it must exist |
|---|---|---|
| `README.md` (root) | **edit** | The status line is currently false; this is the #1 portfolio artifact. Highest value, lowest effort. |
| `docs/buildable-slice/showcase.html` | **new** | The "before/after vs PNG baseline" deliverable. Static, dep-free, reuses the locked generated SVG + the Phase-4 orchestrator core. |
| `tools/check-all.ps1` | **new** | The "tests" deliverable: one command verifies the whole pipeline. Thin sequential wrapper over the five checks that already exist — no framework. |
| `docs/technical-proposal.md` | **edit** | §7 build plan must mark Phase 4 ✅ and Phase 6 done so the doc stops contradicting the repo. |
| `docs/buildable-slice/README.md` | **edit** | Add `orchestrator-demo.html` + `showcase.html` to the file table and a one-line run note. |

**Deliberately skipped (YAGNI):**
- **No landing page / marketing site / docs-site generator** — the README *is* the front door.
- **No new rendering, animation, or emitter code** — the showcase reuses the locked generated SVG and
  the Phase-4 core verbatim.
- **No GIF/video capture pipeline** — a static side-by-side page (+ a screenshot shared in the report)
  is the proof; a recorded loop is add-when-someone-asks.
- **No CI / GitHub Actions** — `check-all.ps1` is the "run everything" surface; wire CI when there is a
  remote actually running it.
- **No Q3 benchmark build** — flagged as runnable, measured separately (companion, not Phase 6).
- **No npm at the repo root, no new dependency anywhere.**

---

## Implementation steps

1. **README.md** — flip the status to "v1 buildable slice complete" (pre-1.0, single-asset); add ✅
   markers to the pipeline diagram for P1–P4; add a **Run / Quickstart** section (run the emitter +
   `check-all.ps1`; open the generated demo, the orchestrator demo, and the showcase); refresh the
   repository-layout block (`runtime/`, `tools/`, `docs/buildable-slice/generated/`); extend the
   design-decisions table with ADR-0006…0009. Keep the wedge/positioning prose.
2. **docs/buildable-slice/showcase.html** — static page, two panels: **Before** = the baseline PNG
   (whole-sprite, can't articulate — label it as the flipbook baseline); **After** = fetch+inject the
   locked `generated/devbrain-svg-css.generated.svg` and drive it with the Phase-4 core from a mock
   feed (reuse `orchestrator-demo.html`'s mechanism). Caption the contrast: independent part
   articulation + reacts to live data. Dep-free, no new assets.
3. **tools/check-all.ps1** — run `check-flat-svg.ps1`, `check-segmented.ps1`, `check-buildable-slice.ps1`,
   `check-orchestrator.ps1`, and `node runtime/mascot-state.test.mjs` in sequence; fail-fast on first
   non-zero; print a per-check ✅/❌ summary and a final pass/fail line.
4. **docs/technical-proposal.md §7** — mark step 5 (Phase 4) ✅ with date and plan link; mark step 6
   (this phase) ✅/done.
5. **docs/buildable-slice/README.md** — add `orchestrator-demo.html` and `showcase.html` rows to the
   file table; one-line run note (served via a static HTTP server because they fetch the generated SVG).
6. **Visually verify** the showcase renders before vs after and the after auto-cycles states; capture a
   single screenshot and share it. Run `check-all.ps1` and paste the summary.

---

## Verification

- **One-command checks:** `tools/check-all.ps1` exits 0 with every sub-check ✅ (P1 flat-svg, P2
  segmented, P3 slice, P4 orchestrator, node determinism test).
- **Locked artifacts byte-unchanged:** `rigged.json`, `devbrain-manual-part.svg`, both emitters, the
  accepted goldens, the locked generated demo, every ADR — confirm via `git status` / no `M` on those.
- **README truthful:** no "no runtime code" / "planned" language remains for shipped phases; the
  Run section's commands actually work.
- **Showcase:** before (PNG) vs after (rigged, auto-cycling `idle→active→alert→idle`) both render in a
  browser; share the screenshot — do not ask the human to check manually.
- Scan changed/new files for TODO/TBD/FIXME.

---

## Non-goals (explicit)

- **No emitter changes**, no edits to `rigged.json`, `devbrain-manual-part.svg`, the locked generated
  demo, any accepted golden, or any ADR.
- **No new pipeline capability** — Phase 6 is packaging only; the engine is feature-complete for v1.
- **No web app, no docs site, no marketing site, no CI** — static page + one wrapper script.
- **No npm at the repo root, no new dependency.**
- **No edits to the DevBrain repo.**
- **No Q3 benchmark run** — flagged runnable, measured separately.

---

## Open questions touched (from §9)

- **Q3 (GSAP-vs-CSS runtime cost on low-power clients)** — still 🔴 open; Phase 6 only restates it as
  runnable now that both targets are live and bound. The actual micro-benchmark on real dashboard
  hardware is the natural *next* piece of work after v1 close-out.

---

## Handoff summary

Phases 1–4 produced a working, verifiable engine; Phase 6 makes that legible and showable without
adding capability. It corrects the false README status, adds a one-command `check-all.ps1` over the
five checks that already exist, and ships a static before/after page that reuses the locked generated
SVG + the Phase-4 core to contrast the PNG baseline against the forged, articulated, data-reactive
mascot. No locked artifact changes and **no new ADR** is required — this phase changes nothing about
the documented method, it only finishes packaging v1.
