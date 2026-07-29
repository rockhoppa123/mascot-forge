# Layered hero demo — design

- **Date:** 2026-07-29
- **Status:** Approved (design phase)
- **Stage:** 4 of the layered-first reframe (harden ingest ✅ → cross-platform gate ✅ → docs/demo flip ✅
  → **hero** → push)

## Problem

The README's hero slot has been a promise nobody could keep.

- `docs/hero-mcp-live.gif` was **embedded but never existed** — the README rendered a broken image until
  stage 3 removed the embed. The apology beneath it described a placeholder that was never committed.
- The demo it pointed at, `docs/buildable-slice/mcp-live-demo.html`, is built from a **PNG through the
  raster path** (`mcp/build-smiley-demo.mjs`). Under layered-first it showcases the demoted path.
- Capturing a GIF is an owner action. It has not happened across multiple sessions, and a plan that
  depends on it stays blocked indefinitely.

There is a deeper problem than "the hero is missing". **A GIF is an ungated artifact by construction.**
It cannot fail a check when the code beneath it changes. This repo already learned that lesson
expensively, and `mcp/smiley-golden.test.mjs` records it in its own header:

> *"that artifact is REGENERABLE but was ungated, so it silently rotted two feature waves behind the
> engine… Every blink yanked the eyes ~10.6 units down, 12% of the frame, into the middle of the face."*

Re-creating the hero as a GIF would rebuild exactly that trap.

## Decision

Taken by the owner on 2026-07-29.

**Invert the dependency.** The durable deliverable is a **live demo page driven by the committed example
asset and gated by tests**. The GIF becomes an optional recording *of that page* — an upgrade, not a
prerequisite. If it is never captured, the README still points at something true and running.

## Non-goals

- **Capturing a GIF or any screenshot.** Screenshots time out in this environment (the Browser pane
  does not composite), so any plan where the agent produces one is fiction. Recording stays an owner
  step, and the plan must leave it *possible*, not *required*.
- **Touching `docs/buildable-slice/mcp-smiley/*` or `mcp/build-smiley-demo.mjs`.** Those are gated
  goldens. The raster demo stays exactly as it is, correctly labelled as the raster example.
- **Adding an MCP tool.** Locked at 10.
- **A node rasterizer**, an `mf.ps1` layered verb, or any other deferred item.

## Architecture

Mirror the structure that already works for the smiley, because it is the structure that stopped the
rot:

```
mcp/build-robot-demo.mjs              NEW — the LAYERED loop with no live agent, exporting
                                        buildRobot() the way build-smiley-demo.mjs exports buildSmiley()
docs/buildable-slice/layered-robot/   NEW — the committed artifact it produces
docs/buildable-slice/layered-live-demo.html  NEW — the hero page, layered-sourced, live-data bound
mcp/robot-golden.test.mjs             NEW — freshness gate, mirroring smiley-golden.test.mjs
tools/gate/check-all.mjs              MODIFIED — P6 gains the new test
tests/e2e/layered-hero.spec.mjs       NEW — drives the page and proves it actually animates
README.md                             MODIFIED — hero slot points at the layered demo
CONTRIBUTING.md                       MODIFIED — capture recipe updated for the new page
```

### Why a generator, not a hand-built page

`mcp/build-smiley-demo.mjs` is described in the README as *"a runnable, no-live-agent reproduction of
the whole raster loop"*. **The layered equivalent does not exist.** Building one closes a real gap
beyond the hero: it gives anyone — reviewer, contributor, sceptic — a single command that drives
`startFromLayeredSvg → set_part → forge_emit` end to end and produces the artifact, no agent required.

That also means the hero is reproducible rather than hand-tuned, which is the difference between a demo
and a screenshot of a demo.

### Two layers of gating, both already proven here

1. **Freshness** (`robot-golden.test.mjs`, modelled on `smiley-golden.test.mjs`): rebuild from the same
   recipe and assert the committed artifact matches byte-for-byte. This is the exact mechanism that
   catches rot, and it is why the smiley bug cannot recur.
2. **Behaviour** (`layered-hero.spec.mjs`): drive the page in a real browser and assert it *animates* —
   not that files exist. The verification technique this repo has established is to seek animations
   deterministically via `element.getAnimations()` + `animation.currentTime` and measure
   `getBoundingClientRect()` drift, because timer sampling misses short keyframe windows.

The first catches a stale artifact; the second catches an artifact that is fresh but broken. The smiley
incident was both.

### What the hero should actually show

The live-data binding is the real differentiator — the README's claim is that animation **states bind to
your app's live data**, not merely that a mascot moves. The current hero proves that with a
raster-sourced mascot. The new one must prove the same thing with a **layered-sourced** mascot, so the
page keeps the differentiator and fixes the path story in one move.

Concretely: the robot, rigged from its named layers, cycling through its declared states driven by a
simulated feed — the same shape as `mcp-live-demo.html`, different source and different provenance.

### The GIF, made optional

`CONTRIBUTING.md` already carries a capture recipe for the old hero. It gets updated to point at the new
page, and the README keeps a `<!-- HERO SLOT -->` comment. The difference from today is that **nothing
is embedded until a file exists** — no dangling reference, no apology for a missing artifact. A visitor
gets a working link; a recording, if made later, is an addition.

## Risks

- **A new committed artifact is a new rot surface.** Mitigated by making the freshness gate part of the
  same task that creates the artifact — not a follow-up. An ungated artifact must never be committed,
  even briefly.
- **The generator duplicates smiley logic.** Some structural similarity is expected and fine; what must
  not be duplicated is the emit/rig logic itself, which lives in `mcp/tools.mjs` and
  `tools/rig-editor/emit.js` and should be called, not reimplemented.
- **P6 grows.** The gate's MCP row gains a test. That is the intended cost of gating a new artifact.

## Acceptance

- `node mcp/build-robot-demo.mjs` regenerates the committed artifact from `assets/example-layered/robot.svg`
  with no live agent, and the freshness test proves the committed copy matches a fresh build.
- `docs/buildable-slice/layered-live-demo.html` loads, animates, and switches state on live data.
- An e2e proves the page animates by measuring real motion, not by asserting a file exists.
- The gate runs the new test; `RESULT: PASS`.
- README's hero slot points at the layered demo, with **no embedded reference to a file that does not
  exist**.
- `mcp/build-smiley-demo.mjs` and `docs/buildable-slice/mcp-smiley/*` are byte-unchanged.
- MCP tool count 10; no root `package.json`; existing goldens unmoved.
