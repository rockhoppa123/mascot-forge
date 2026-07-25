# Changelog

All notable changes to mascot-forge are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Public-ready state — staged for the `v1.0.0` release (cut at public launch alongside the live demo).

### Added
- **React+GSAP reachable from the MCP agent path** — `forge_emit` gains a `target` parameter
  (`"svg-css"` default | `"react-gsap"` | `"both"`), implementing ADR-0003's "one rig contract,
  swappable emitter" for the first time on the agent path. The emitter's logic moved into a pure ESM
  core (`tools/emit-react-gsap/emit-react.mjs`) shared by the CLI and the MCP so they cannot drift; the
  committed `generated/` files are its byte-for-byte golden. New **P7** gate stage covers the target,
  which previously had none, and a cross-target pivot-fidelity test proves both Output Targets rotate
  every part around the identical absolute point — the risk ADR-0007 named as the biggest one for an
  automated pipeline, now tested rather than assumed. No new dependency: the core imports only `node:*`.
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
- **Guided reactivity tiers + full-fidelity editor round-trip** — the `rig_mascot` prompt now walks the
  agent through picking a tier (Simple `idle`-only / Standard `idle-active-alert` / Signals adds
  `loading-success-error`) before rigging, and steers silhouette/borderline input to a whole-body Simple
  rig instead of fake limbs. `forge_propose` returns a per-part motion plan (mirror-aware) and
  `forge_apply_tweaks` / `forge_review` add inline rename/role fixes and a human approve/redo/editor
  checkpoint. The editor gained matching add/remove app-signal-state controls (`idle` stays non-removable).
- **Self-describing handoff, both directions** — `forge_open_editor` and the editor's own "Export animated
  mascot" now emit `data-role`/`data-kind`/`data-pivot`/`data-preset-*` per part plus root `data-states`,
  so a rig opened via `?rig=` (or a re-opened export) rebuilds fully animated instead of loading inert —
  a save-and-resume round-trip.
- **Automated tests for the product** — a Playwright e2e smoke suite (`tests/`) covering the editor’s
  happy path and regressing two found bugs; plus an MCP agent-simulation test (`mcp/`). Both run in CI.
- **Project infrastructure** — GitHub Actions CI (full `check-all.ps1` gate + `e2e` + `mcp` workflows),
  community-health files (Code of Conduct, Security, Citation, issue/PR templates), curated README + badges.
- **AGENTS.md and DESIGN.md** — a contributor/agent guide (repo orientation, boundaries, the gate command)
  and the visual/product-surface rules separating the utility rig editor and demos from the emitted
  mascot as product.

### Fixed
- **Marquee suppress-flag could eat the next click** — after a drag, a stale `suppressClick` swallowed
  the following part-click; it’s now reset at the start of each pointer interaction.
- Changing a part's role no longer orphans an invalid preset selection — previously this made Export
  throw and silently do nothing. Stale presets are cleared on role change, and the Export button now
  surfaces any error instead of failing quietly.
- **System audit fixes (2026-07-05)** — a Simple-tier (idle-only) rig no longer crashes on `forge_emit`
  when a limb/accent's natural preset targets an undeclared state; `forge_start_from_layered_svg` now
  carries roles/pivots/presets/declared states through the MCP alt entry (previously dropped); part ids
  are sanitized at every input boundary (MCP + editor) so a space/uppercase id can no longer produce a
  broken `<g id>` or CSS selector; nested `<g>` layers in a layered-SVG import are now rejected with a
  clear error instead of silently losing the outer group's geometry; the suggested signal-state
  vocabulary now orders `error` last (highest priority), matching the runtime; silhouette grading
  requires ≤2 fills — a dominant-but-colourful image now grades borderline instead of unrigable;
  `pollJson` treats a non-2xx response as nothing-asserted instead of relying on a JSON-parse throw;
  anatomy-preset heuristics anchor to word boundaries (`detail` no longer matches `tail`, `eyebrow` no
  longer matches `eye`); renaming a part onto an existing id is rejected instead of silently clobbering
  it; region-overlay labels no longer clip above the top edge; the MCP's default first-pass colour count
  now matches the editor (6).
- **Post-audit follow-up pass (2026-07-25)** — `safePath` resolved `outDir` against `process.cwd()`
  instead of the repo root, so `forge_emit`/`forge_open_editor`/`forge_propose` wrote one directory too
  deep or threw "path outside project root" for any MCP client not launched with cwd pinned to the repo
  root (the common case); `forge_propose`'s `outDir` branch now returns a clickable URL like the other
  two, instead of a raw local path; `pollJson` no longer lets a slow tick's stale response overwrite a
  faster later tick's, and `fromEvents` degrades to nothing-asserted on a throwing `mapFn` instead of
  raising an uncaught exception, matching `pollJson`'s contract. In the rig editor: the `Escape`/`Ctrl+Z`/
  `p` global shortcuts no longer fire while a text field has focus (previously hijacked in-field typing,
  including the browser's native field-undo); the file input is keyboard-reachable again (`hidden` had
  dropped it from the tab order); the layout no longer squeezes the canvas to a sliver below 700px width;
  a "Vectorising…" status now appears before the CPU-bound PNG ingest; `--danger` red now meets AA
  contrast against the button background.
- **Cold-start dead-end + unearned anatomy (2026-07-25 playtest)** — a fresh proposal assigns no
  roles, so `forge_propose` recommended nothing and `forge_emit` hard-failed with "rig has no
  animation in any state" (reproduced on 3 of 3 unseen assets) while the checkpoint reported
  `advisory: (none)`. `forge_propose` and `forge_status` now return an advisory naming the exact next
  call. The segmenter also stopped asserting anatomy it cannot detect: without a per-asset
  `parts-spec.json` it names regions by **position** (`part-lower-left`, `part-upper`, `part-island-1`)
  instead of `part-leg-left`/`part-antenna`/`part-eyes` — it had labelled a ghost's head-top an
  "antenna" and a T-Rex's head "eyes". Assets shipping a parts-spec (DevBrain) are unaffected: the
  spec's vocabulary still wins. `forge_propose` additionally reports `tearRisks` where an animated
  part overlaps an inert one, the defect class that makes a mascot visibly come apart.

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
