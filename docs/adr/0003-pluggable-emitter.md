# ADR-0003 — Pluggable output emitter (React+GSAP ↔ SVG+CSS)

- **Status:** Accepted
- **Date:** 2026-06-17

## Context
Whether the ideal output is React+GSAP or framework-agnostic SVG+CSS is an open question
that depends on the use case (rich interactive states favour GSAP; lightest footprint
favours CSS). The author explicitly wants this resolved by research/experiment, possibly
choosing **both** depending on need.

## Decision
Make the rigging step **emitter-agnostic**. Phase 3 consumes a single `rigged.json` and
delegates to a swappable `Emitter` plugin. Ship two emitters in v1: `react-gsap` and
`svg-css`. Adding a third (Vue, Web Components, …) costs only the emitter.

## Consequences
- The output-format decision is deferred without blocking the rest of the pipeline.
- Slightly more abstraction in Phase 3 (one interface, two implementations).
- A build-time spike (hand-build both for the DevBrain asset) decides defaults
  empirically rather than in the abstract.
- GSAP being 100% free (since Apr 2025) removes any licensing constraint on the
  `react-gsap` emitter.
