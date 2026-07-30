# Real-export fixture — provenance

## `gopher-73.svg`

| | |
|---|---|
| **Source** | [MariaLetta/free-gophers-pack](https://github.com/MariaLetta/free-gophers-pack), `characters/svg/73.svg` |
| **Author** | Maria Letta |
| **Licence** | **CC0 1.0 Universal** (public domain dedication) — the pack's `LICENSE` is the CC0 legal code, and its README states: "This package is now licensed as CC0 (public domain) so you can use the images in any way with no restrictions." |
| **Retrieved** | 2026-07-30, from `raw.githubusercontent.com/MariaLetta/free-gophers-pack/master/characters/svg/73.svg` |
| **Size** | 8 585 bytes, **unmodified** — byte-for-byte as published |
| **Exported by** | Affinity Designer (the file still carries `xmlns:serif="http://www.serif.com/"`) |

## Why this file is here

Every layered fixture in this repo was hand-authored until now, and that is exactly what let a
geometry defect ship: `assets/example-layered/robot.svg` uses **absolute** path data, so it matched
browser truth 7/7 while real Figma/Illustrator/Inkscape exports — which emit **relative** data by
default — had parts placed hundreds of units off-canvas, with `forge_emit` still reporting `ok=true`.
See [`docs/superpowers/playtests/2026-07-30-final-playtest.md`](../../docs/superpowers/playtests/2026-07-30-final-playtest.md).

This file was chosen for what it *is*, not for how it looks:

- **entirely relative curve data** — 165 relative commands to 27 absolute `moveto`s, the exact input
  shape the defect was blind to;
- **no `transform` anywhere**, so layered ingest accepts it rather than refusing it by layer name;
- a `<clipPath>`, so the non-rendered-subtree rule is exercised on real art;
- two `<circle>`s, which the text parser defers to the browser — the documented v1 ceiling, asserted
  rather than hidden;
- small enough (8 KB) to live in a public repo without apology.

**It is one file from one tool.** It is evidence that the parser reads a genuine export correctly, not
coverage of every exporter. It contains no arc (`a`/`A`) commands — that pack's exporter converts arcs
to béziers — so arc handling is still covered only by the unit tests in `path-bbox.test.mjs`.

## How the truth values were produced

`gopher-73.bbox.json` holds each drawable's bounding box as measured by **Chromium's real `getBBox`**,
in document order, rounded to 2 dp. Recorded once, in a fresh browser, from the file served over HTTP.

Two checks use it, and they exist as a pair on purpose:

- **`tools/rig-editor/layer-ingest.test.mjs`** (node gate, P5) asserts the text parser's box *contains*
  the recorded box for all 26 rect/path elements. Zero-dependency: the gate never launches a browser.
- **`tests/e2e/real-export.spec.mjs`** (Playwright) re-measures the same file **live** and asserts the
  recording still matches, then compares the parser against that live geometry inside one page. Without
  it, the recording could quietly go stale and the node gate would keep passing against a fossil.

Both were mutation-tested: breaking a coordinate in the SVG fails the recorded-truth check, and making
the parser read relative commands as absolute (reproducing the original defect) fails the live check.

## If you replace this fixture

Keep the source bytes unmodified and re-record the truth values against them — a fixture edited to make
a test pass is worth less than no fixture at all.
