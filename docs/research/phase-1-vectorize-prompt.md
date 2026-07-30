# Next Stage Prompt — Phase 1 Ingest & Vectorize (PNG → flat.svg)

Target: fresh Claude Code (or Codex) session in `C:\Users\student1\Dev\mascot-forge`.

Optimized for: the stage after Phase 3 (codegen) closed — one `rigged.json` (schema v2)
drives both Output Targets around canonical pivots, and the React+GSAP emitter shipped at
`tools/emit-react-gsap/`. The next documented build-plan step is **Phase 1 — Ingest &
Vectorize**: a dependency-free PNG→`flat.svg` pixel-art vectorizer.

Full plan: [`docs/phase-1-vectorize-implementation-plan.md`](../plans/phase-1-vectorize-implementation-plan.md).

---

## Copyable prompt

```text
You are implementing Phase 1 (Ingest & Vectorize) of mascot-forge in
C:\Users\student1\Dev\mascot-forge. Deliver a dependency-free pixel-art vectorizer that
turns the Clean Mascot Source PNG into a generated flat.svg. Favour clarity and exactness
over cleverness. Only build what is specified below — do not add features, segmentation,
or abstractions beyond this phase.

## 0. Read first (do not skip)
- docs/phase-1-vectorize-implementation-plan.md — THIS IS THE SPEC. Follow its contract,
  steps, non-goals, and stop conditions exactly.
- README.md and CONTEXT.md — concept and the project language (preserve it).
- docs/technical-proposal.md §1 (architecture/contracts) and §2 (Phase 1 — Ingest &
  Vectorize: the flat.svg output contract).
- docs/adr/0005-pixel-art-poc-first.md — pixel-art-first decision (exact rect geometry).
- docs/research/references.md "Vectorization" — GLORP (greedy mesh), pixel2svg (RLE),
  VTracer (reserved for the LATER general flat-art path, not v1).
- docs/buildable-slice/devbrain-manual-part.svg — the existing hand-authored source-pixel
  geometry (data-render-method="source-pixel-rle", data-source-bounds="21,77,170,177",
  viewBox 0 0 192 192). Phase 1 GENERATES equivalent geometry from the PNG.
- docs/buildable-slice/README.md — Clean Mascot Source provenance + the read-only rule.

## 1. Preserve project language (from CONTEXT.md)
Clean Mascot Source · Manual Part SVG · Buildable Slice · Future Expansion Note. The PNG is
the Clean Mascot Source; flat.svg is a generated intermediate artifact. Do NOT introduce
segmentation/part vocabulary — Phase 1 produces colour-clustered geometry only; named parts
are Phase 2.

## 2. Deliverable — pixel-art vectorizer + generated flat.svg
Build tools/vectorize-pixel.ps1 (PowerShell + System.Drawing, to stay dependency-free and
consistent with tools/emit-svg-css.ps1 — confirm before reaching for any npm/Node path).
It MUST:
- Read the Clean Mascot Source PNG READ-ONLY (never copy, move, or edit it). Documented
  source + metadata are in the plan and docs/buildable-slice/README.md.
- Decode to an ARGB grid; cluster by EXACT colour (pixel art = small fixed palette; no
  K-means in v1); RLE per row then greedy-merge vertically-adjacent equal runs into rects.
- Emit docs/buildable-slice/generated/devbrain-flat.svg per the plan's output contract:
  viewBox="0 0 192 192", width/height = source px, NO geometry over fully-transparent
  pixels, one <g data-color="#rrggbb"> per colour with nested <rect>, deterministic stable
  ordering, carry data-source-bounds + data-render-method="source-pixel-rle". Zero <path>,
  zero curve-fitting.

## 3. Verification
- Re-run the vectorizer twice → byte-identical output (deterministic).
- Add or extend a structural check (tools/check-flat-svg.ps1, or extend
  check-buildable-slice.ps1 WITHOUT weakening its existing assertions): flat.svg has
  viewBox 0 0 192 192, zero <path>, >=1 <g data-color> group, a sane <rect> count well
  below 1-per-opaque-pixel (greedy-mesh working), no geometry on transparent pixels.
- Visually confirm flat.svg renders pixel-identical to the source PNG at 192x192 and
  preserves the transparent pose. Share proof; do not ask the user to check manually.
- Scan changed files for TODO/TBD/FIXME.

## 4. Constraints / non-goals
- NO segmentation, named parts, VTracer/general flat-art path, VLM, telemetry, or emitter
  changes. flat.svg is colour-clustered only.
- Do NOT alter the Manual Part SVG, the rigged.json contract, the existing emitters, any
  accepted golden, or any ADR.
- Keep the SVG+CSS pipeline dependency-free; do not add npm to the repo root or this path.
- Only make changes directly requested. Do not add extra files, abstractions, or features.

## 5. Acceptance criteria
- [ ] tools/vectorize-pixel.ps1 generates devbrain-flat.svg deterministically from the
      read-only source PNG.
- [ ] flat.svg matches the output contract (viewBox, colour groups, rects-not-paths,
      transparent pose preserved) and renders pixel-identical to the source.
- [ ] Greedy-mesh reduces rect count materially vs 1-rect-per-pixel.
- [ ] Structural check passes; existing buildable-slice checks still pass; goldens unchanged.
- [ ] No DevBrain asset copied/edited; no segmentation introduced.

## 6. Stop conditions — stop and ask before
- adding any dependency (e.g. a Node PNG library) instead of the System.Drawing path.
- copying/editing the source PNG, or deriving any new DevBrain-asset file beyond flat.svg.
- producing or overwriting any golden.
- changing the Manual Part SVG, rigged.json, the emitters, or any ADR.

## 7. Report back
Summarise: the vectorizer design (decode → cluster → RLE → greedy-merge → emit); the
flat.svg contract conformance and rect-count reduction achieved; visual-equivalence proof;
and any flat.svg schema friction. Recommend the next stage (Phase 2 assisted segmentation,
which consumes flat.svg, or the open Q3 GSAP-vs-CSS runtime benchmark).
```

## Setup note
This prompt is for an agentic tool with real system access. Review the scope locks,
forbidden actions, and stop conditions before pasting. Confirm the source PNG path,
directories, and permissions match the actual project. Deliverable is dependency-free
(PowerShell + System.Drawing); confirm before introducing any Node/npm path.
