# ADR-0001 — Scope is a reusable engine, not one mascot

- **Status:** Accepted
- **Date:** 2026-06-17

## Context
The originating need was to make the DevBrain dashboard mascot look professional. But the
underlying pain — turning a static image into a rigged, data-bound web mascot — is
generic and, per research, not served by any single existing tool. The author also wants
a portfolio-grade open-source project.

## Decision
Build **mascot-forge as a reusable engine** (image → animated mascot pipeline). The
DevBrain moustache is **test case #1 / dogfooding**, not the product.

## Consequences
- Designs must generalise beyond one asset (clean phase contracts, no DevBrain-specific
  hard-coding in the core).
- Slightly more up-front design than a one-off mascot fix.
- Far stronger portfolio artifact and reusable result.
- DevBrain still benefits directly: it consumes the engine's first output.
