# Changelog

All notable changes to mascot-forge are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Public-ready state — staged for the `v1.0.0` release (cut at public launch alongside the live demo).

### Added
- **DevBrain mascot ownership migration** — the former DevBrain mascot is now the flagship showoff
  asset for mascot-forge. Source sheets, exported PNG poses, and the old DevBrain runtime baseline live
  under `assets/devbrain/` for before/after comparison and MCP demo material.
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
- **Editor onboarding & editing UX** — one-click "Load example" (a finished, animated DevBrain), a
  few-parts split hint, a `file://` guard, inline tooltips + on-screen shortcuts, a visible "Place
  pivot" button, per-shape **paint / erase** reassignment, deselect (Esc / click empty canvas), and an
  always-visible **rig-status strip** showing which states have an animation.
- **One-click animated export** — an "Export animated mascot" button emits a **self-contained animated
  SVG** (+ standalone demo HTML) with the CSS inlined; no terminal, no `mf emit`. A shared `emit.js`
  generates the CSS for both the live preview and the export, so they can't drift.
- **Agent-driven rigging via MCP** (`mcp/`, milestone M1) — an MCP server (`forge_start_from_image` →
  `assign_region` with normalized 0..1 boxes → `forge_emit`) lets a vision agent (e.g. Claude) do the
  *semantic* part identification the deterministic segmenter can't, driving the same shared modules. No
  bundled model; the runtime stays dependency-free.
- **Automated tests for the product** — a Playwright e2e smoke suite (`tests/`) covering the editor’s
  happy path and regressing two found bugs; plus an MCP agent-simulation test (`mcp/`). Both run in CI.
- **Project infrastructure** — GitHub Actions CI (full `check-all.ps1` gate + `e2e` + `mcp` workflows),
  community-health files (Code of Conduct, Security, Citation, issue/PR templates), curated README + badges.

### Fixed
- **Marquee suppress-flag could eat the next click** — after a drag, a stale `suppressClick` swallowed
  the following part-click; it’s now reset at the start of each pointer interaction.
- Changing a part's role no longer orphans an invalid preset selection — previously this made Export
  throw and silently do nothing. Stale presets are cleared on role change, and the Export button now
  surfaces any error instead of failing quietly.

### Changed
- Repositioned around the defensible core: *owned, editable, data-reactive animation code* (states bind
  to live app data), not "auto-rig any image."
- Auto-segmentation demoted to a best-effort flat-art fallback (see
  [segmentation reality-check](docs/research/segmentation-reality-check.md)); layered SVG is preferred.
- `docs/` reorganised — per-phase implementation plans moved under `docs/plans/`, with a `docs/README.md`
  index.
- **Canonical pipeline consolidated** — `tools/rig-editor/{vectorize,segment}.js` are the source of truth;
  the Windows-only PowerShell `vectorize-pixel.ps1` / `segment-parts.ps1` are marked legacy/batch-only.

### Unchanged (contracts held)
- `rigged.json` schema v2 ([ADR-0008](docs/adr/0008-rigged-json-schema-v2-lock.md)) — geometry lives in
  `manual-part.svg`, so the geometry-agnostic change touched no locked contract.

---

Earlier milestones (v1.0 buildable slice, v1.1 generalisation, v1.2 invocation + scale) were tracked as
internal phase plans under [`docs/plans/`](docs/plans/) prior to the first public release.
