# ADR-0005 — Proof-of-concept targets pixel art first

- **Status:** Accepted
- **Date:** 2026-06-17

## Context
General full-colour vectorization introduces curve-fitting, gradient handling, and noisy
segmentation. Pixel art maps cleanly to an exact `<rect>` grid (RLE/greedy meshing), and
its parts are typically colour-separable — simplifying both Phase 1 (vectorize) and
Phase 2 (segmentation). The DevBrain mascot — the first real consumer — *is* pixel art.

## Decision
Constrain the v1 proof-of-concept to **pixel-art / clean flat-art inputs**. Defer general
photographic/complex-image support (VTracer path) to a later milestone.

## Consequences
- Phase 1 can use a deterministic, artifact-free pixel-grid → `<rect>` conversion.
- Phase 2 can likely start with colour-cluster + connected-components, deferring SAM.
- Aligns the PoC with the actual first asset (DevBrain), so dogfooding is immediate.
- General-image support is a clearly-scoped follow-up, not a v1 blocker.
