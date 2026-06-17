# ADR-0006 — Research first Buildable Slice before implementation

- **Status:** Accepted
- **Date:** 2026-06-17

## Context
mascot-forge is still pre-alpha, and the next work could easily split in three directions:
keep researching the whole four-phase pipeline, start implementation immediately, or
research only the first credible end-to-end slice. The project needs enough evidence to
avoid building on shaky browser/runtime assumptions, but it also needs to avoid research
becoming endless.

## Decision
Before product implementation starts, create a **Buildable Slice Evidence Pack** at
`docs/research/buildable-slice-evidence.md`. It focuses on a narrow path: Clean Mascot
Source → Motion Intent → Manual Part SVG / `rigged.json` → Output Target Routing. The
Evidence Pack must include primary sources, Local Proofs where browser/runtime behaviour
matters, cons and constraints, Future Expansion Notes, and a final go/no-go
implementation gate.

## Consequences
- Implementation starts only after the Buildable Slice has evidence-backed acceptance
  checks.
- Research stays narrow enough to produce a decision instead of a link archive.
- Alternatives such as SVG+CSS, React+GSAP, automation, segmentation, and richer product
  flows are preserved through Routing Matrix entries or Future Expansion Notes.
- Full-pipeline research, automated vectorization, AI Motion Intent parsing, and DevBrain
  telemetry binding remain outside the Buildable Slice unless evidence pulls them in.
