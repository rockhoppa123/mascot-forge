# Changelog

All notable changes to mascot-forge are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Public-ready state — staged for the `v1.0.0` release (cut at public launch alongside the live demo).

### Added
- **Browser rig editor** (`tools/rig-editor/`) — a dependency-free static page that sits between
  `mf forge` and `mf emit`: assign parts, roles, pivots, and per-state animation presets, live-preview
  the motion, validate, and export the `manual-part.svg` + `rigged.json` (+ `parts-spec.json`) pair.
- **Marquee rect-level split** — drag to select enclosed geometry and peel colour-fused regions into
  their own part (full-containment policy).
- **In-browser PNG ingest** — vectorize (median-cut quantize + RLE/greedy-mesh) + connected-component
  segmentation, entirely client-side, with a nearest-neighbour downscale and rect-count guard.
- **Geometry-agnostic parts + layered-SVG ingest** ([ADR-0011](docs/adr/0011-geometry-agnostic-parts.md))
  — drop a layered Figma/Inkscape/Illustrator SVG; each layer becomes a named part with its real
  geometry (paths/curves) carried through. The recommended high-fidelity input.
- **Project infrastructure** — GitHub Actions CI (full `check-all.ps1` gate), community-health files
  (Code of Conduct, Security, Citation, issue/PR templates), and a curated README + badges.

### Changed
- Repositioned around the defensible core: *owned, editable, data-reactive animation code* (states bind
  to live app data), not "auto-rig any image."
- Auto-segmentation demoted to a best-effort flat-art fallback (see
  [segmentation reality-check](docs/research/segmentation-reality-check.md)); layered SVG is preferred.
- `docs/` reorganised — per-phase implementation plans moved under `docs/plans/`, with a `docs/README.md`
  index.

### Unchanged (contracts held)
- `rigged.json` schema v2 ([ADR-0008](docs/adr/0008-rigged-json-schema-v2-lock.md)) — geometry lives in
  `manual-part.svg`, so the geometry-agnostic change touched no locked contract.

---

Earlier milestones (v1.0 buildable slice, v1.1 generalisation, v1.2 invocation + scale) were tracked as
internal phase plans under [`docs/plans/`](docs/plans/) prior to the first public release.
