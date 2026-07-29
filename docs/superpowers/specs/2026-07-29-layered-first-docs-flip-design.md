# Layered-first docs flip — design

- **Date:** 2026-07-29
- **Status:** Approved (design phase)
- **Stage:** 3 of the layered-first reframe (harden ingest ✅ → cross-platform gate ✅ →
  **docs/demo flip** → hero capture → push)

## Problem

The reframe decision was taken on 2026-07-25: lead with layered SVG, demote raster auto-segmentation to
a documented fallback. Stages 1 and 2 did the engineering. The documentation has not moved, and it is
now the last thing still telling users the old story.

**Where the docs still lead with raster:**

- `README.md:8-12` — the headline, the single most load-bearing sentence in the repo:
  *"Hand a flat image to your AI agent; it rigs the parts by vision…"*. Layered SVG does not appear.
- `README.md:45-49` — the executive framing: *"takes a flat raster image (PNG, pixel-art first)"*.
- `README.md:97-113` — the pipeline diagram, `image.png → P1 Vectorize → P2 Segment → P3 Emit`. Layered
  input skips P1 and P2 entirely, but the diagram implies vectorise-then-segment is mandatory step one.
- `README.md:224-259` — quickstart and `mf` CLI section: entirely raster.
- `mcp/README.md:29-31` — the guided loop's step 1 is `forge_start_from_image`, with layered as a
  parenthetical.
- `docs/product-discovery.md` and `docs/technical-proposal.md` — **both of the documents
  `docs/README.md` designates "Start here"** are 100% raster-framed, and both predate ADR-0011 by days.

Layered SVG's only headline-adjacent mention is a parenthetical in the scope line (`README.md:22-23`).
Meanwhile `tools/rig-editor/README.md:19-24` already ranks it first and correctly, and ADR-0011 already
calls it "a first-class input" — so the repo contradicts itself depending on which file you open.

## The finding that shaped this stage

**A docs-only flip would be dishonest**, and this repo's named recurring failure mode is claims
outrunning code. The exploration found seven code-verified gaps. The decisive one is evidentiary:

> Raster was discredited by an **end-to-end cold-start playtest** — an agent driving the real tools
> against unseen assets, failing 3 of 3. Layered is supported by **parser-correctness tests against
> synthetic inline fixtures**. Both are real evidence. They are not the same *kind* of evidence, and a
> flip that implies symmetric proof overclaims.

Concretely, today:

- **No committed layered SVG example exists.** Every layered fixture in the repo is either pipeline
  *output* or an inline string literal inside a test file. A doc saying "drop this file" has no file to
  point at.
- **No e2e drives a layered SVG through the real UI.** `drop-rig.spec.mjs` does exactly that for a PNG —
  real `#file` input, role assignment, a real download event. The layered suites
  (`layered-transform.spec.mjs`, `handoff-rig.spec.mjs`) call `window.__rigEditor.loadLayeredSvg()`
  directly via `page.evaluate`. They prove the *ingest* rigorously and prove the two ingest paths agree;
  they do not prove the *user loop*.

## Decisions

Taken by the owner on 2026-07-29.

1. **Close the evidence gaps, then flip.** Add the committed example asset and the missing e2e first, so
   "drop this file and watch it work" is literally true and continuously tested — then move the docs.
2. **Stage 4 (hero capture) is deferred**, not cancelled. The existing `docs/hero-mcp-live.gif` demo is a
   PNG rigged through MCP — it documents the path being demoted. Revisit once an example asset exists to
   film. No hero work happens in this stage.

## Non-goals

- **A node rasterizer for `circle`/`ellipse`/`polygon`.** `mcp/tools.mjs:199-204` hard-fails on those,
  so the agent path is genuinely rect+path only. That limit gets **documented plainly**, not fixed —
  fixing it is deferred work and would delay a reframe that is already decided.
- **An `mf.ps1` layered verb.** The CLI has no layered entry at all. That is a real hole, and it gets
  stated in the docs rather than built: adding a CLI verb is feature work, not a docs flip.
- **Rewriting `product-discovery.md` or `technical-proposal.md`.** They are dated records of what was
  understood at the time. They get a short dated banner pointing at the current direction — annotate,
  never silently rewrite, the same rule stages 1 and 2 used.
- **Touching goldens, the MCP tool count (10), or the zero-dependency boundary.**

## Architecture

```
assets/example-layered/<name>.svg   NEW — the committed "start here" asset
tests/e2e/drop-layered.spec.mjs     NEW — the real user loop, mirroring drop-rig.spec.mjs
mcp/tools.test.mjs                  MODIFIED — its layered test consumes the committed asset
                                      instead of an inline string, so one file proves both paths
docs/guides/exporting-layers.md     NEW — the onboarding path under this direction
README.md                           MODIFIED — headline, framing, pipeline diagram, quickstart
mcp/README.md                       MODIFIED — layered leads the guided loop
docs/README.md                      MODIFIED — "Start here" points at the current story
docs/product-discovery.md           MODIFIED — dated banner only
docs/technical-proposal.md          MODIFIED — dated banner only
```

### The example asset is the load-bearing artifact

Everything else depends on it, so its constraints are hard:

- **`rect` and `path` only.** No `circle`/`ellipse`/`polygon`/`polyline`/`line`, because the MCP path
  rejects those outright. An example that only worked in the browser would break the very promise the
  headline is about to make to agent users.
- **No `transform` attribute anywhere**, or stage 1's guard refuses it by name.
- **Multiple meaningfully-named top-level `<g>` layers**, since the layer name becomes the part id.
  Names must survive `sanitizeId` into readable parts (`"Left Arm"` → `part-left-arm`).
- **Realistic, not a minimal repro** — several layers, a plausible viewBox, real path geometry. The
  existing inline fixtures are correct as unit tests and useless as evidence that the pipeline handles
  something a designer would actually export.
- Hand-authored in this repo. We cannot ship someone's real Figma export, and a synthetic file that
  *obeys the same rules* is the honest substitute — provided the docs say it is hand-authored.

### One asset, both paths

`mcp/tools.test.mjs` already has a layered test driven by an inline string. Repointing it at the
committed asset costs almost nothing and buys a real guarantee: the same file a user is told to drop is
proven to work through the agent path too. Without this, the asset is only ever exercised by the
browser e2e, and the MCP promise stays untested against it.

### The e2e mirrors the raster one deliberately

`tests/e2e/drop-rig.spec.mjs` is the template: real `page.setInputFiles("#file", …)`, role assignment
through the UI, a real `download` event. The layered test should follow its shape closely, so the two
input paths are visibly held to the same standard — and so a reviewer can diff them.

Expected e2e count moves **24 → 25**.

### What the export guide must actually say

Consolidating guidance currently scattered across `docs/gallery/README.md:28-33`,
`tools/rig-editor/README.md:22-24`, `docs/launch/README.md:41-42`, and — for the most important rule —
nowhere at all except a runtime error string in `layer-ingest.js:52-57`:

| Rule | Why |
|---|---|
| Each **top-level `<g>` is one part**; name it meaningfully | The layer name becomes the part id |
| **Flatten or expand transformed groups before export** | Any `transform` in a layer's subtree is refused by name. Figma: right-click → Flatten selection. Illustrator: Object → Expand |
| Nesting is fine | Stage 1 made a layer own every drawable in its subtree at any depth |
| `data-*` only on the top-level `<g>` | Nested groups contribute geometry, never metadata |
| **Avoid `circle`/`ellipse`/`polygon` for the agent path** | MCP rejects them; the browser editor handles them. Convert to paths, or use the editor |
| Clip paths and masks are ignored safely | Stripped before layer selection; they never become phantom parts |

The transform rule is the one that currently exists **only** as a runtime error message. It is also the
most likely first-run failure for a real Figma export. It leads the guide.

## Honest limits the flipped docs must state

Not buried in a footnote — these are the difference between a reframe and an overclaim:

1. The **agent/MCP path is rect + path only**.
2. The **`mf.ps1` CLI has no layered entry**; layered goes through the browser editor or MCP.
3. The example asset is **hand-authored to the same rules**, not a captured real-world export.
4. Layered's evidence is **parser correctness plus a proven user loop** — not the cold-start playtest
   that discredited raster. Say what is proven, not what is implied.

## Acceptance

- A committed layered SVG asset ingests cleanly through **both** the browser editor and
  `forge_start_from_layered_svg`, proven by tests, not by inspection.
- `tests/e2e/drop-layered.spec.mjs` drives that file through the real `#file` input to a real download.
- `README.md`'s headline, executive framing, pipeline diagram and quickstart lead with layered; raster is
  present and labelled a fallback, not deleted.
- `docs/guides/exporting-layers.md` exists and states the transform rule first.
- The four honest limits above appear in user-facing docs.
- `product-discovery.md` and `technical-proposal.md` carry dated banners; their bodies are unchanged.
- Gate `RESULT: PASS`; e2e **25 passed**; goldens unmoved; no root `package.json`; MCP tools 10.
