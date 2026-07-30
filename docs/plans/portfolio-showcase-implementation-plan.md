# Portfolio Showcase — Implementation Plan

**Status:** 📋 planned. Created 2026-06-20.
**Position:** post-v1.2. Engine is asset-agnostic (v1.1), `mf` CLI + scale guard shipped (v1.2).
This milestone adds **no pipeline capability** — it makes the finished tool *look like* the
polished open-source piece it already is, for a public/portfolio audience.

> **Ponytail framing.** The repo already works end-to-end and is documented (README is current,
> ADRs 0001–0009, technical proposal, two proven assets). The single highest-leverage act is
> **surfacing the land-rover that is already forged** — `spikes/03-second-asset/generated/` exists
> but no public surface shows it, so the repo still *reads* as one hand-tuned demo. Adding a second
> panel to `showcase.html` turns "a demo" into "an engine" at **zero new rigging cost**. Everything
> else (a hero image, a CONTRIBUTING.md, a branch merge) is packaging. No web app, no docs site,
> no GitHub Pages, no third asset, no new dependency.

---

## Goal

A visitor lands on the GitHub page and within 30 seconds sees: a **hero image** of a forged,
articulated mascot; a one-paragraph "what + why"; a **Quick Start**; and a line proving it works
on **two visually different assets** (pixel-art creature + cartoon vehicle), not one. One click to
a live before/after showcase that animates **both** assets side by side. A developer who scrolls
finds a CONTRIBUTING.md and a one-command regression gate. The public `master` HEAD contains the
`mf` CLI and the current README — nothing important stranded on a feature branch.

## Audience

- **Recruiter / hiring manager (30s glance):** needs a hero image + one-line pitch above the fold. Most never clone.
- **Technical reader:** needs the "how it works" path — pipeline diagram → showcase → ADRs/spike FINDINGS.
- **Developer who might use it:** needs Quick Start, the `mf` CLI, the asset input contract, CONTRIBUTING.md.

---

## Decisions

**D1 — README scope: targeted, not a rewrite.** Phase 6 already removed the stale "pre-alpha / no
runtime code" language; the current README has what/why, the ✅ pipeline diagram, the design-decision
table, repo layout, Quick Start, and `mf` CLI docs. It is *good*. Gaps a portfolio viewer notices:
**no image above the fold** (GitHub renders one — biggest single win) and **no explicit "proven on 2
assets" claim**. So: add a hero image, add one "two assets" line near the top, verify every demo link
resolves. No prose duplication of the proposal/ADRs.

**D2 — Showcase: patch, keep local-served.** `showcase.html` works and reuses locked artifacts
read-only (good pattern) but shows **only DevBrain** — so it proves "this mascot animates," not "any
mascot." Patch it to add a **land-rover panel** reusing the already-emitted SVG+CSS from the spike.
Hosting: the existing `python -m http.server` instruction is sufficient for a portfolio — `fetch()`
needs HTTP, and a static screenshot in the README covers viewers who never clone. **GitHub Pages is
out of scope** (the demos `fetch()` relative paths, which Pages supports, but wiring + a workflow is
packaging the milestone doesn't need; flagged as a stretch in §Not in this milestone).

**D3 — Third asset: NO new forge; surface the existing second asset instead.** The land-rover spike
already *settled* the engine-generality question (FINDINGS verdict: "YES — it survives a second asset,
zero engine edits"). A brand-new third asset would cost real human-in-the-loop effort (P1 palette
tuning + the P2 confirm step + manual rig authoring, ~2–4h owner time) for **marginal** additional
proof. The lazy, higher-value move is to *show the proof that already exists*. If the owner later
wants a third asset purely for visual variety, a sensible distinct candidate is a **flat-design
geometric robot/icon** (clean vector shapes — different from pixel-art *and* cartoon-illustration);
that is an **owner stretch task, explicitly out of this milestone**.

**D4 — GitHub-readiness extras: CONTRIBUTING.md only.** An open-source repo without a CONTRIBUTING.md
reads as unfinished — a viewer notices its absence. Add a short one (how to forge an asset via `mf`,
how to run the gate, PR expectation: `check-all.ps1` green). **Skip** issue templates and `.github/`
workflows — nice-to-have, no viewer notices them missing, and CI is explicitly out of scope.

**D5 — Definition of done.** All true at once: (a) README shows a hero image on the GitHub landing
page; (b) README has the existing one-paragraph what/why, a Quick Start, a "two assets proven" line,
and working links to showcase + both demos; (c) `showcase.html` animates **both** devbrain and
land-rover side by side; (d) CONTRIBUTING.md exists; (e) `pwsh tools/check-all.ps1` exits 0; (f) the
v1.2 branch is merged to `master` so public HEAD carries `mf.ps1` + current README.

---

## Work items (ordered)

**First action:** `git stash list` / `git status` to confirm a clean v1.2 working tree, then start
W-showcase. Tags below: **[A]** = agent can do unattended · **[H]** = human-in-the-loop (owner) ·
rough effort in parens.

**W-showcase — add the land-rover panel** *(do first; it produces the hero asset)* **[A]** *(~1–2h)*
- What: extend `docs/buildable-slice/showcase.html` from 2 panels (DevBrain before/after) to also
  show the forged land-rover. Reuse the spike's emitted SVG+CSS the same read-only fetch+inject way
  the DevBrain "after" panel does — no duplicated geometry, no new render code.
- Sub-decision (resolve in W): the land-rover SVG+CSS lives under `spikes/03-second-asset/generated/svg-css/`.
  Either (i) reference it via relative path from the showcase, or (ii) **copy** it into
  `docs/buildable-slice/generated/` (preferred — a showcase shouldn't reach into `spikes/`; keeps the
  public surface self-contained). Copying adds files but is the honest packaging move.
- Provenance (if copying): add a one-line header comment in the copied files naming the source
  (`spikes/03-second-asset/...`) and the regen command (`mf emit land-rover`), so a future edit
  regenerates rather than hand-patches a stranded copy.
- Verify before building: confirm `land-rover-rigged.json` exposes the same `idle/active/alert` states
  the orchestrator/mock feed drives (FINDINGS forced a 6-slot mapping — states may differ). If states
  differ, drive the land-rover panel with whatever states its rig declares, not a hard-coded list.
- Acceptance: served over HTTP, the page shows devbrain + land-rover; both articulate and cycle
  through their states. `check-all.ps1` still green (incl. the existing land-rover regression cell).
- Add to the gate: a cheap existence assert that every file `showcase.html` `fetch()`es actually
  exists on disk (catches a broken copy/path before a viewer sees a blank panel). Fold into the
  existing `check-buildable-slice.ps1` rather than a new check.
- Gate: `pwsh tools/check-all.ps1` exits 0.

**W-readme — hero image + targeted edits** **[A]** copy/links · **[H]** final GIF capture *(~0.5h + owner capture)*
- What: (1) add a hero image at the top — see Risk on capture; interim use the existing
  `land-rover-svgcss-idle.png` or a showcase screenshot. (2) Add one line near the top: "Proven on two
  visually different assets — a pixel-art creature and a cartoon vehicle — with zero engine edits
  (see the [second-asset spike](../../spikes/03-second-asset/FINDINGS.md))." (3) Click every demo/showcase
  link and confirm it resolves.
- Acceptance: README renders the hero on GitHub (image committed, relative path); "two assets" line
  present; all links valid. No section rewritten.
- Gate: links manually opened; image visible in GitHub preview.

**W-github — CONTRIBUTING.md** **[A]** *(~0.5h)*
- What: short CONTRIBUTING.md — prerequisites (pwsh 7+, Node), how to forge an asset (`mf forge` →
  human rig review → `mf emit`), how to run the gate (`mf check`), the one PR rule (gate must be green),
  MIT/DCO note. Link it from README.
- Acceptance: file exists, ≤1 screen, linked from README, no TODO markers.
- Gate: none beyond existence.

**W-merge — land v1.2 on master** **[H]** owner approves the merge · **[A]** prepares it *(~0.5h)*
- What: the showcase + README live on `feature/v1.2-invocation-and-scale` with `mf.ps1` and README
  changes currently **uncommitted/untracked**. Commit this milestone's changes, then merge v1.2 (incl.
  the v1.1 generalisation it builds on) to `master` so public HEAD is complete.
- Acceptance: `master` contains `mf.ps1`, current README, both showcase panels, CONTRIBUTING.md;
  working tree clean.
- Gate: `pwsh tools/check-all.ps1` exits 0 on `master` after merge.

**W-gate — final regression** **[A]** *(~0.1h)*
- What: run the full gate after all changes.
- Acceptance/Gate: `pwsh tools/check-all.ps1` → all 6 checks PASS, exit 0.

---

## Not in this milestone

- **Brand-new third asset** — owner stretch only (D3); not required to prove generality.
- **GitHub Pages / any hosting** — local `python -m http.server` + a README screenshot suffices.
- **npm package / published CLI** — `mf.ps1` dispatcher is the v1 invocation surface (ADR/v1.2).
- **CI/CD, issue templates, `.github/` workflows** — no viewer notices them missing.
- **Rive / new Output Target** — separate roadmap item.
- **Animated GIF** if capture proves fiddly — ship a static hero now, GIF later (see Risks).

---

## Open risks

- **Hero GIF/screenshot needs a running browser — the agent can't capture it.** Mitigation: the agent
  can commit the *existing* static `spikes/03-second-asset/generated/land-rover-svgcss-idle.png` as an
  interim hero, and flag GIF/screenshot capture as **the owner's manual task** (run the showcase, record).
- **land-rover artifacts live under `spikes/`, not `docs/buildable-slice/`.** W-showcase must decide
  copy-vs-reference (plan recommends copy) — a reach into `spikes/` from a public showcase is a smell.
- **State mismatch:** land-rover's rig may not declare the same `idle/active/alert` triad the mock feed
  uses; verify before wiring the panel (W-showcase) or the second panel sits frozen.
- **Merging unreviewed v1.2 work to `master`** bundles `mf.ps1` + scale guard with the showcase. Run the
  gate before merge; consider a quick self-review of the v1.2 diff since it has never been merged.
- **README hero path** must be a committed relative path (not a local absolute or an external URL) or it
  breaks on GitHub.
- **Copied land-rover artifacts drift from the spike source** if hand-edited later. Mitigation: the
  provenance header (W-showcase) + the fetch-existence assert (W-showcase gate) make drift visible;
  treat the copies as build output, regenerate via `mf emit land-rover`, don't hand-patch.
