# mascot-forge portfolio showcase — fresh-agent planning prompt

> Copy everything below the line into a fresh Claude Code session rooted at
> `C:\Users\student1\Dev\mascot-forge`. Your deliverable is a **plan document**,
> not implementation. Do NOT edit any source file.

---

Invoke the ponytail skill (/ponytail) FIRST and keep it active for the whole task.

You are writing the **portfolio showcase implementation plan** for mascot-forge.
mascot-forge is an open-source tool-chain that forges a PNG mascot into a
data-reactive SVG+CSS (or React+GSAP) animated component. Two assets are proven
(devbrain, land-rover). The engine is asset-agnostic as of v1.1. The goal of this
milestone is to make mascot-forge *look* like the polished open-source tool it
already *is* — good enough to put in a portfolio and share publicly.

The owner is Andrew: 3rd-year BCom Management Sciences student (Business Analytics),
Stellenbosch University. This repo is a portfolio piece demonstrating systems
thinking, creative engineering, and end-to-end delivery — not just code.

---

## 0. Read first (do not skip, in this order)

1. `README.md` — current state. Note: sparse or developer-focused? Missing demo?
2. `docs/technical-proposal.md` §1–§2 — the "what" and "why" in Andrew's own words.
3. `docs/buildable-slice/README.md` — the buildable slice outputs.
4. `docs/buildable-slice/showcase.html` — the existing showcase page (what does it show?
   two assets side-by-side? does it look presentable to a non-technical viewer?).
5. `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` — the existing
   per-asset demo page (state toggle, live animation).
6. `docs/buildable-slice/orchestrator-demo.html` — the orchestrator demo page.
7. `spikes/03-second-asset/FINDINGS.md` — the Land Rover validation story. Note whether
   this is readable as a "how it works" narrative for a portfolio viewer.
8. `docs/adr/` — list the ADRs. Note: are they linked from anywhere for a reader to find?
9. `assets/devbrain/` + `assets/land-rover/` — understand the asset input contract.
10. `tools/check-all.ps1` — the regression gate (6 checks, PASS/FAIL output).
11. `LICENSE` — confirm MIT (or whatever it is).
12. Glob `**/*.md` in repo root and `docs/` — inventory all existing docs.
13. Grep for `TODO` or `FIXME` across the repo — surface any rough edges.

---

## 1. Context to carry

**What already exists (likely):**
- `docs/buildable-slice/showcase.html` — side-by-side asset showcase, authored during
  Phase 6. May need copy + visual polish, not a rewrite.
- `docs/buildable-slice/orchestrator-demo.html` — live state-toggle demo.
- ADRs 0001–0010 covering every major design decision.
- Spike write-ups: `spikes/01-emitter/FINDINGS.md`, `spikes/02-runtime-cost/FINDINGS.md`,
  `spikes/03-second-asset/FINDINGS.md`.
- `docs/technical-proposal.md` — full architecture rationale.
- MIT LICENSE (assumed — verify).

**What probably needs work:**
- `README.md` — likely sparse. Needs: what it is, who it's for, a visual, quick-start
  invocation, link to showcase/demo.
- No animated GIF or screenshot in README (GitHub renders these).
- No CONTRIBUTING.md or issue-template directory.
- The showcase HTML may be functional but not visually impressive as a first impression.
- Third asset: two assets is good proof; three assets is "engine" proof. Candidate assets
  that would be quick to forge and visually distinctive are worth considering.

**The portfolio audience:**
- A recruiter or hiring manager who glances at the GitHub page for 30 seconds.
- A technical reader who wants to understand what it does and how.
- A developer who might want to use it on their own mascot.

---

## 2. Decisions the plan must make

D1 — **README scope**: targeted improvements (add hero GIF, quick-start section, links)
or full rewrite from scratch? Prefer targeted — the proposal + ADRs already have the
right prose; don't duplicate them.

D2 — **Demo/showcase**: is `showcase.html` already good enough to link from README, or
does it need copy changes? Does it need to be hosted (GitHub Pages) or is a local
`open docs/buildable-slice/showcase.html` instruction sufficient for a portfolio?

D3 — **Third asset**: yes or no? A third asset proves the claim "works on any mascot"
more strongly. Criteria: visually different from devbrain (pixel art) and land-rover
(cartoon illustration). Candidates to consider: a simple robot/icon (geometric shapes),
a cartoon animal, a pixel-art character. The plan must name a concrete candidate and
explain why it was picked (or argue convincingly that two assets is enough).
- Note: forging a new asset requires human-in-the-loop steps (P2 rigging) — the plan
  must estimate effort and flag this as the owner's task, not the agent's.

D4 — **GitHub-readiness extras**: CONTRIBUTING.md, issue templates, `.github/` directory?
Ponytail rule applies — only add what a viewer would notice is *missing*. A CONTRIBUTING.md
is expected for an open-source repo; issue templates are nice-to-have.

D5 — **What "done" looks like**: define a concrete acceptance bar (e.g. "GitHub repo
landing page shows a screenshot/GIF, has a one-paragraph description, has a Quick Start
section, links to the live demo, and `check-all.ps1` still passes").

---

## 3. Deliverable

Write `docs/portfolio-showcase-implementation-plan.md` in
`C:\Users\student1\Dev\mascot-forge`.

The plan must include:
- **Goal** — what the repo looks like when done (one paragraph; written as if describing
  the GitHub page to someone who hasn't seen it).
- **Audience** — who this showcase is for and what they need to see.
- **Decisions** (D1–D5 resolved with reasoning, one paragraph each).
- **Work items** (W-prefixed, ordered, each with: what, acceptance criterion, gate).
  Must include at minimum:
  - W-readme: README rewrite/update — hero image/GIF, what/why, quick-start, links.
  - W-showcase: assess + patch `showcase.html` if needed; confirm linkable from README.
  - W-third-asset (if D3 = yes): which asset, what the owner must supply (PNG), what
    the agent handles (pipeline run), how long it will take.
  - W-github: CONTRIBUTING.md + any other GitHub-readiness items.
  - W-gate: `pwsh tools/check-all.ps1` exits 0 after all changes.
- **What is NOT in this milestone** (e.g. npm package publish, CI/CD, Rive target,
  GitHub Pages hosting if not trivially achievable).
- **Open risks** — e.g. animated GIF capture requires running the demo in a browser
  (who captures it? the agent can't); third asset P2 rigging is always manual.

Format: dense bullets over paragraphs. Use existing plan docs in `docs/` as style reference.

Do NOT create any other files. Do NOT edit any source file.
Write the plan, then stop.
