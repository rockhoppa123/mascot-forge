# ADR-0002 — v1 is assisted (human-in-the-loop), not fully automatic

- **Status:** Accepted
- **Date:** 2026-06-17

## Context
The original draft assumed a VLM could do end-to-end semantic segmentation + rigging +
codegen with zero human input. Research shows fully automatic 2D rigging from a single
image is unsolved, active academic work (UniRig SIGGRAPH 2025, RigAnything, Adobe
diffusion rigging, ASMR) — mostly 3D and not production-ready. The author is a solo
student dev, not an ML researcher.

## Decision
v1 keeps a **human in the loop** for the one genuinely hard step (semantic segmentation
+ anchor confirmation). The tool *proposes*; the human *confirms/adjusts* in a minimal
UI; everything else is automated. Full-auto is an explicit long-term stretch goal, not a
v1 requirement.

## Consequences
- The project is buildable by one person this year.
- The "wedge" is honest: speed + code-ownership, not magic auto-rigging.
- Requires a small confirm/review UI (Phase 2).
- If/when 2D auto-rig research matures, it slots in behind the same Phase-2 contract.
