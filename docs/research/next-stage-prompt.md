# Next Stage Prompt - Dependency-Free SVG+CSS Emitter Implementation

> ✅ **COMPLETED (2026-06-17).** This stage shipped: `tools/emit-svg-css.ps1`,
> `tools/check-buildable-slice.ps1`, and `docs/buildable-slice/generated/` all exist.
> The current next stage is **schema-lock + the React+GSAP emitter** —
> see [`react-gsap-emitter-prompt.md`](react-gsap-emitter-prompt.md). Kept here for provenance.

Target: Codex agentic coding session

Optimized for: a fresh Codex session working in this repo after the SVG+CSS
Buildable Slice fixture/demo pass and golden acceptance are complete.

## Copyable prompt

```text
You are Codex working in C:\Users\dev\Dev\mascot-forge.

## Objective

Implement the next Buildable Slice stage: a minimal dependency-free SVG+CSS emitter that
consumes the existing Manual Part SVG plus docs/buildable-slice/devbrain-rigged.json and
generates an SVG+CSS demo equivalent to the accepted hand-authored demo.

## Context

mascot-forge is pre-alpha and docs-first. The Buildable Slice Evidence Pack is complete
with implementation gate "Go with caveats." The first SVG+CSS fixture/demo pass is
implemented and its three reduced-motion screenshots are accepted as goldens.

Preserve the project language from CONTEXT.md:

- Buildable Slice
- Evidence Pack
- Evidence Standard
- Local Proof
- Clean Mascot Source
- Manual Part SVG
- Motion Intent
- Motion Intent Confirmation
- Animation State
- Output Target
- Output Target Routing
- Routing Matrix
- Future Expansion Note

Current Output Target: SVG+CSS.
Deferred Output Target: React+GSAP.
Only Animation States: idle, active, alert.
impact remains a transient accent under accents, not a state.

Current accepted goldens:

- docs/buildable-slice/goldens/devbrain-svg-css-idle-reduced.png
- docs/buildable-slice/goldens/devbrain-svg-css-active-reduced.png
- docs/buildable-slice/goldens/devbrain-svg-css-alert-reduced.png

Current fixture/demo files:

- docs/buildable-slice/README.md
- docs/buildable-slice/devbrain-manual-part.svg
- docs/buildable-slice/devbrain-rigged.json
- docs/buildable-slice/devbrain-svg-css.css
- docs/buildable-slice/devbrain-svg-css-demo.html
- docs/buildable-slice/goldens/
- tools/check-buildable-slice.ps1
- docs/buildable-slice-svg-css-implementation-plan.md

The next-stage plan is in docs/buildable-slice-svg-css-implementation-plan.md under:
"Next Stage Plan - Minimal Dependency-Free SVG+CSS Emitter Contract".

## Read First

Read these before editing:

- README.md
- CONTEXT.md
- docs/technical-proposal.md
- docs/adr/0006-research-first-buildable-slice.md
- docs/research/buildable-slice-evidence.md
- docs/research/proofs/README.md
- docs/research/proofs/svg-css-transform-proof.html
- docs/buildable-slice-svg-css-implementation-plan.md
- docs/buildable-slice/README.md
- docs/buildable-slice/devbrain-manual-part.svg
- docs/buildable-slice/devbrain-rigged.json
- docs/buildable-slice/devbrain-svg-css.css
- docs/buildable-slice/devbrain-svg-css-demo.html
- tools/check-buildable-slice.ps1
- assets/README.md

## Target State

Done means:

- docs/buildable-slice/devbrain-rigged.json contains the six minimal SVG+CSS motion
  recipes under animations.idle, animations.active, and animations.alert.
- tools/emit-svg-css.ps1 exists and uses PowerShell XML/JSON APIs, not npm or string-only
  parsing, to validate inputs and generate SVG+CSS output.
- docs/buildable-slice/generated/ exists and contains only generated SVG+CSS demo files:
  - devbrain-svg-css.generated.svg
  - devbrain-svg-css.generated.css
  - devbrain-svg-css.generated-demo.html
- tools/check-buildable-slice.ps1 validates the generated files and proves generated
  state controls come from rigged.json.
- docs/buildable-slice/README.md documents how to run the generated demo.
- docs/buildable-slice-svg-css-implementation-plan.md records the implementation result,
  caveats, and verification output.
- Accepted goldens remain unchanged and are not overwritten.

## Scope

Work only in:

- docs/buildable-slice/devbrain-rigged.json
- docs/buildable-slice/generated/
- docs/buildable-slice/README.md
- docs/buildable-slice-svg-css-implementation-plan.md
- tools/emit-svg-css.ps1
- tools/check-buildable-slice.ps1

Read-only context:

- README.md
- CONTEXT.md
- docs/technical-proposal.md
- docs/adr/
- docs/research/
- docs/buildable-slice/devbrain-manual-part.svg
- docs/buildable-slice/devbrain-svg-css.css
- docs/buildable-slice/devbrain-svg-css-demo.html
- docs/buildable-slice/goldens/
- assets/README.md

## Required Motion Recipes

Extend the existing animations object with exactly these six SVG+CSS recipes:

- idle / part-body / devbrain-idle-breathe / 1800ms / ease-in-out / infinite /
  reduced transform scale(1)
- idle / part-eyes / devbrain-blink / 4200ms / step-end / infinite /
  no reduced transform
- active / part-leg-left / devbrain-walk-left / 520ms / ease-in-out / infinite /
  reduced transform rotate(10deg)
- active / part-leg-right / devbrain-walk-right / 520ms / ease-in-out / infinite /
  reduced transform rotate(-10deg)
- alert / part-antenna / devbrain-antenna-pulse / 420ms / ease-in-out / infinite /
  reduced transform scale(1.08)
- alert / part-moustache / devbrain-recoil / 360ms / cubic-bezier(.2, .8, .2, 1) /
  infinite / reduced transform translateX(-4px)

Use this object shape for each recipe:

{
  "part": "part-body",
  "name": "devbrain-idle-breathe",
  "durationMs": 1800,
  "timing": "ease-in-out",
  "iteration": "infinite",
  "keyframes": [
    { "offset": "0%, 100%", "transform": "scale(1)" },
    { "offset": "50%", "transform": "scale(.985, 1.035)" }
  ],
  "reduced": { "transform": "scale(1)" }
}

Mirror the existing hand-authored CSS keyframes from
docs/buildable-slice/devbrain-svg-css.css unless the plan says otherwise.

## Emitter Requirements

tools/emit-svg-css.ps1 MUST:

- Default to:
  - -SvgPath docs/buildable-slice/devbrain-manual-part.svg
  - -RigPath docs/buildable-slice/devbrain-rigged.json
  - -OutDir docs/buildable-slice/generated
- Parse SVG with [xml].
- Parse JSON with ConvertFrom-Json.
- Fail fast before writing files if:
  - states are not exactly idle, active, alert
  - impact appears in states
  - accents.impact is missing
  - a part references a missing SVG ID or missing bone
  - a parent bone appears after its child
  - an animation key is not one of idle, active, alert
  - a recipe references an unknown part
  - a keyframe name is duplicated
  - a recipe is missing durationMs, timing, iteration, keyframes, or part
- Generate CSS from rigged.json parts and animation recipes:
  - transform-box: fill-box
  - transform-origin for every part
  - data-state selectors for idle, active, alert
  - @keyframes blocks
  - @media (prefers-reduced-motion: reduce)
  - .force-reduced-motion reduced selectors
  - no data-state="impact"
- Generate the SVG by preserving Manual Part SVG geometry and semantic IDs while linking
  to devbrain-svg-css.generated.css.
- Generate the demo HTML from the rigged.json states array, with buttons only for idle,
  active, and alert, query-param routing, and ?reduce=1 support.

## Constraints

- Do not add npm dependencies.
- Do not create package.json or a package scaffold.
- Do not delete files.
- Do not change ADR decisions.
- Do not copy, edit, transform, or derive new files from DevBrain assets.
- Do not modify the accepted goldens except to read/verify their presence.
- Do not expand into automated vectorization, segmentation, Motion Intent UI,
  React+GSAP package integration, telemetry binding, or broad browser certification.
- Do not promote impact to a state.
- Only make changes directly required for this emitter stage.

## Acceptance Criteria

- [ ] Running tools/emit-svg-css.ps1 writes the three generated demo files.
- [ ] Running tools/check-buildable-slice.ps1 passes and covers both fixture and generated
      output.
- [ ] Generated demo buttons are exactly idle, active, alert.
- [ ] Generated CSS includes no data-state="impact".
- [ ] Generated files preserve all semantic part IDs.
- [ ] Accepted goldens remain exactly the three reduced-motion PNGs listed above.
- [ ] Docs record the generated demo path, caveats, and verification results.

## Verification

Before completion, run:

pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\emit-svg-css.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-buildable-slice.ps1
git diff --check

Then run explicit guards:

$rig = Get-Content -Raw 'docs/buildable-slice/devbrain-rigged.json' | ConvertFrom-Json
if ($rig.states -contains 'impact') { throw 'impact must stay outside states' }

$expected = @(
  'devbrain-svg-css-active-reduced.png',
  'devbrain-svg-css-alert-reduced.png',
  'devbrain-svg-css-idle-reduced.png'
) | Sort-Object
$actual = Get-ChildItem -LiteralPath 'docs/buildable-slice/goldens' -File |
  Select-Object -ExpandProperty Name | Sort-Object
if (($actual -join ',') -ne ($expected -join ',')) {
  throw 'goldens directory must contain exactly the three accepted reduced-motion screenshots'
}

Scan updated docs and generated files for unfinished markers:

Select-String -Path `
  'docs/buildable-slice/README.md',`
  'docs/buildable-slice-svg-css-implementation-plan.md',`
  'tools/emit-svg-css.ps1',`
  'tools/check-buildable-slice.ps1' `
  -Pattern 'TODO|TBD|FIXME|XXX|\.\.\.'

If browser automation is already available without adding repo dependencies, capture the
generated demo for idle, active, and alert with ?reduce=1 into a temp folder for human
review. Do not overwrite accepted goldens.

## Stop Conditions

Stop and ask before:

- adding any dependency
- creating any package manifest or scaffold
- deleting, moving, or renaming files
- touching files outside Scope
- changing ADR decisions
- modifying accepted goldens
- copying or modifying DevBrain assets
- adding impact to states
- implementing React+GSAP, vectorization, segmentation, Motion Intent UI, telemetry
  binding, or broad browser certification

## Final Response

Summarize:

- files changed
- generated files created
- whether accepted goldens remained unchanged
- recommended next path
- unresolved caveats
- verification commands and results
```

## Target And Setup Note

Target: Codex agentic coding session. Optimized to front-load current docs-first state,
scope locks, accepted goldens, and verification so the emitter implementation can proceed
without re-planning.

This prompt is for an agentic tool with real system access. Review the scope locks,
forbidden actions, and stop conditions before pasting. Confirm file paths, directories,
and permissions match the actual project.
