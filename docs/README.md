# mascot-forge docs

Documentation index. Start with the current story below, then dig into decisions, the buildable slice,
and research as needed.

## Start here
- [`../README.md`](../README.md) — the current story: layered SVG leads, raster is a labelled fallback,
  pipeline diagram, quickstart.
- [`guides/exporting-layers.md`](guides/exporting-layers.md) — how to export a layered SVG (Figma/
  Illustrator/Inkscape) that ingests cleanly.
- [`../DESIGN.md`](../DESIGN.md) — editor/demo visual constraints and agent UI-skill routing (the *product surface*).

## Historical record (predates ADR-0011)
- [`product-discovery.md`](product-discovery.md) — the original problem, market gap, personas, scope,
  success criteria, written 2026-06-17. 100% raster-framed; superseded as the *why* by the README once
  ADR-0011 moved the product to lead with layered SVG. Kept as the record of what was understood at the
  time — see its banner.
- [`technical-proposal.md`](technical-proposal.md) — the original architecture, phases, stack, open
  questions, same vintage. See the README and the export guide for the current direction.

## Reference
- [`../assets/devbrain/`](../assets/devbrain/) — the former DevBrain mascot, now the flagship showoff
  asset and legacy baseline for before/after comparisons.
- [`adr/`](adr/) — Architecture Decision Records (0001–0011): the load-bearing choices and their rationale.
- [`buildable-slice/`](buildable-slice/) — the v1 slice: rig fixture, emitted output, and the live demos
  (`orchestrator-demo.html`, `showcase.html`).
- [`research/`](research/) — landscape analysis, references, the research log, and phase prompts.
- [`plans/`](plans/) — per-phase implementation plans (historical execution records).

## Provenance
- [`../spikes/`](../spikes/) — research spikes (e.g. the second-asset validation) that de-risked the
  design before it was built. Kept as honest engineering provenance.
