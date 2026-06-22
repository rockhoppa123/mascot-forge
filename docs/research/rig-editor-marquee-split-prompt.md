# Rig Editor — marquee rect-level split (Phase 1 finish) — fresh-agent prompt

> Copy everything below the line into a fresh Claude Code session rooted at
> `C:\Users\student1\Dev\mascot-forge`. Deliverable is **working code + tests**. This finishes the
> one functional gap left in the shipped Phase 1 rig editor; it is a small, contained addition, not
> a re-architecture. Build it as written; if you find it genuinely wrong mid-build, stop and flag it.

---

Invoke the ponytail skill (`/ponytail`) FIRST and keep it active. Use test-driven development:
every pure-logic change gets its node `assert` test written/red before the implementation (mirror
the existing `tools/rig-editor/*.test.mjs` — no framework, no fixtures dir, reuse committed files).

## What already exists (shipped last session — read it, don't rebuild it)

The browser rig editor lives in `tools/rig-editor/` and is **done except one thing**: it loads a
`mf forge` `segmented.svg`, lets you assign **whole proposed parts** to roles/bones/pivots/presets,
live-previews motion, validates, and exports the `manual-part.svg` + `rigged.json` (+ `parts-spec.json`)
pair that `mf emit` consumes. The pure-logic core is node-tested and wired into `tools/check-all.ps1`
(check *P5 rig-editor*). See `tools/rig-editor/README.md`.

**The gap:** there is no way to **split** a proposed part at `<rect>` granularity. When P2 fuses
regions into one group (e.g. the land-rover wheels are colour-fused into `part-body` —
`spikes/03-second-asset/FINDINGS.md`), you currently cannot peel those rects into their own part.
The data model already supports it; only the **canvas marquee + rect-level selection UI** is missing.
This is the headline reason a visual editor beats hand-editing JSON, so it is worth finishing.

## 0. Read first (in this order)

1. `tools/rig-editor/README.md` — what the editor is and how it's structured.
2. `tools/rig-editor/model.js` — the rect-granular model. Key fact: `assign(rectIds, partId)` already
   moves an arbitrary set of rects to any part (creating it if new). **Split = `assign(subset, newId)`.**
   Rects carry stable ids (`r0`, `r1`, …) from the loader.
3. `tools/rig-editor/app.js` — the DOM glue. Today: each rect is rendered with `data-rid=<rect id>`
   inside its part `<g class="part" id=…>`; selection is **part-level** via `e.target.closest('g.part')`;
   `svgPoint(e)` already converts a mouse event to viewBox coords; pivot placement uses a `p`-key mode.
4. `tools/rig-editor/loader.js` + `tools/rig-editor/model.test.mjs` — the rect id scheme and the
   assign/split/rename invariants the model already guarantees.
5. `tools/rig-editor/pivot.js` (`bboxOf`) — reuse for marquee hit-testing if helpful.
6. `docs/buildable-slice/generated/devbrain-segmented.svg` — the committed 89-rect / 5-part fixture
   used by every node test (the golden round-trip input).

## 1. Build order (gate green between each; node test red→green; `pwsh tools/check-all.ps1` stays 0)

**S1 — selection model [A].** Add a *rect-set* selection to the editor state (alongside the existing
part selection). Pure helpers, node-tested: given a marquee rect (x,y,w,h) in viewBox coords and the
model's rects, return the enclosed rect ids (use `bboxOf`/simple AABB containment). Put the geometry
in a small pure module (e.g. `tools/rig-editor/select.js`) with `rectsInMarquee(rects, box)` so it is
node-testable; `app.js` only wires pointer events to it. *Accept:* node test — a marquee over the
devbrain fixture selects exactly the enclosed rect ids; partial-overlap policy is explicit and tested.

**S2 — marquee UI [A, glue].** Drag on the canvas draws a marquee `<rect>`; on release, the enclosed
rects become the current rect-selection (highlight them). Plain click still selects a part (keep it);
choose a non-conflicting gesture (e.g. drag = marquee, click = part-select; or a shift modifier).
Respect the perf note: do not loop all rects per `pointermove` — only compute the set on release.
*Accept:* manual/eval check that dragging selects rects; no `check-all` regression.

**S3 — split/reassign action [A].** With a rect-selection active, a panel control "move N rects → [part]"
(existing part or a new id) calls `model.assign(selectedRectIds, targetId)`, then re-renders the two
affected groups and recolours. *Accept:* node test on the model path — splitting a subset of
`part-body` into `part-front-wheel` leaves `part-body` with the remainder, the new part with the
subset, and **every rect still in exactly one group** (`everyRectGrouped()` true; rect count
conserved). Then an editor-level check: load fixture → marquee a subset → split → export → the
exporter golden still validates and loses no rect.

**S4 — docs + gate [A].** Update `tools/rig-editor/README.md` (remove "split is deferred"; document the
marquee gesture). `pwsh tools/check-all.ps1` exits 0; all `tools/rig-editor/*.test.mjs` pass.

## 2. Hard constraints (unchanged from Phase 1 — do not relitigate)

- **Dep-free static page, zero build, no backend, no new dependency** (D1/D2). Vanilla ESM + SVG only.
- **Pure logic stays node-testable** — geometry/selection in a module with a `*.test.mjs`; `app.js` is
  thin glue (mirrors how `model`/`pivot`/`exporter` are split from the DOM today).
- **D6 invariant holds:** every rect always lands in exactly one group; a split never drops geometry.
- **Locked schema untouched** — this is selection/UI only; `rigged.json` v2 and the exporter output
  shape do not change. `mf check` (`tools/check-buildable-slice.ps1`) stays canonical.
- **Perf:** hit-test/recolour by the existing patterns (native `closest`, class/fill swap on changed
  groups only); keep interaction responsive on the ~7555-rect devbrain manual asset.

## 3. Definition of done

- Dragging a marquee on the canvas selects the enclosed rects; a panel action splits/reassigns them to
  an existing or new part; the canvas recolours and the parts list rect-counts update.
- New `tools/rig-editor/select.js` (or equivalent) is node-tested; the model split path is tested for
  geometry conservation; the exporter golden round-trip still passes after a split.
- `tools/rig-editor/README.md` updated; `pwsh tools/check-all.ps1` exits 0 (P5 includes any new test —
  add it to the `"model","loader",…` list in `tools/check-all.ps1`).

## 4. Owner (Andrew) tasks — flag, don't attempt

- **Preset *feel*** tuning in `presets.js` (motion taste).
- **README screenshot** of the editor (capture in a browser).

## 5. Out of scope (later / separate)

- Phase 2 (port `vectorize-pixel.ps1` + `segment-parts.ps1` to JS for raw-image, no-terminal upload).
- React+GSAP emit of arbitrary part ids (needs `PART_IDS`-from-rig — a pipeline v1.1 backlog item in
  `spikes/03-second-asset/FINDINGS.md`, not an editor change).
- Undo history, multi-asset project management, new animation states.

Build S1→S4 in order, keep the gate green, stop at S4.
