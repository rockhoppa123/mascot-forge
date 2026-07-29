# Product Discovery — mascot-forge

> **2026-07-29 note:** Written 2026-06-17, before [ADR-0011](adr/0011-geometry-agnostic-parts.md) moved
> the product to lead with a **layered SVG** input (raster auto-segmentation demoted to a labelled
> fallback after failing a cold-start playtest 3/3 on unseen assets). This document is 100% raster-framed
> and is kept unchanged below as the record of what was understood at the time — see
> [`../README.md`](../README.md) and [`guides/exporting-layers.md`](guides/exporting-layers.md) for the
> current direction.

> **Document type:** Product Discovery
> **Project code:** MASCOT-FORGE
> **Author:** Andrew Lawson
> **Date:** 2026-06-17
> **Status:** Draft for review
> **Research basis:** Live web research conducted via Claude Code (`WebSearch`) on
> 2026-06-17. Sources catalogued in [`research/references.md`](research/references.md);
> methodology in [`research/research-log.md`](research/research-log.md).

This document supersedes the earlier "DEV-BRAIN-01" draft, which conflated two products
(the mascot itself vs. the tool that makes mascots) and overstated the feasibility of
fully automated AI rigging. It corrects both based on research.

---

## 1. Executive summary

mascot-forge is an open-source pipeline that converts a static raster image into a
**rigged, articulated, telemetry-aware web mascot delivered as editable code**. The user
uploads an image; the tool vectorizes it, helps separate it into semantic parts
(body, limbs, antenna…), rigs those parts with transform-origins, and emits a React +
GSAP component (or a framework-agnostic SVG + CSS variant) whose animation states bind
to live application data.

The first consumer and test case is the **DevBrain dashboard mascot** — a pixel-art
moustache character currently animated as a flipbook of pre-rendered PNG poses. That
implementation is the baseline mascot-forge exists to beat.

**Primary goal:** a polished, portfolio-grade open-source project (MIT) demonstrating
end-to-end engineering — computer vision, codegen, animation, and developer ergonomics.
Monetisation is explicitly **not** a goal in this phase (see
[ADR-0004](adr/0004-mit-license.md)).

---

## 2. Problem statement

### 2.1 The core problem

There is a well-defined gap between **asset generation** and **front-end
implementation**. AI can produce a beautiful static mascot in seconds. Making that
mascot *move meaningfully on a web page* — where its parts articulate and its behaviour
reflects application state — is still slow, manual, specialist work:

1. Separate the flat image into layers (Illustrator/Figma).
2. Decide which parts move and around what pivot (transform-origins).
3. Hand-author animation code for each behavioural state.
4. Wire those states to real data.

This is **hours per asset** and requires three skill sets at once (illustration,
animation, front-end engineering) that rarely live in one person.

### 2.2 Why the existing tools don't close it

Research into the current landscape (full analysis in
[`research/landscape.md`](research/landscape.md)) shows the market is *mature but
segmented* — each tool owns one slice and leaves the seam exposed:

| Tool / category | What it does well | Why the gap remains |
|---|---|---|
| **Rive** | Best-in-class interactive **state machines** + vector rigging; one C++/WASM runtime across web, mobile, game engines | Output is a **binary `.riv`** played by a **~200 KB WASM canvas runtime**. You don't get editable code; you adopt their runtime and editor. |
| **Lottie / dotLottie** | Mature After-Effects → JSON playback; lighter (~60 KB) runtime; now has state machines too | Still a **JSON asset + player**, authored in After Effects. Not code you write, and AE is its own specialist skill. |
| **AI mascot generators** (svgapp.ai, mascot.bot, Fotor, etc.) | Generate posed mascot *art* from a text prompt; export SVG/PNG | They generate **their** art, not a rigging of **your** existing asset, and don't emit a data-bound code component. |
| **Vectorizers** (VTracer, Potrace, Vectorizer.AI) | Convert raster → vector paths; VTracer handles colour + pixel art well | Produce **one flat path/colour stack with no semantic anatomy** — limbs, body, antenna fuse into a single rigid shape that cannot articulate. |
| **Manual (Illustrator + Figma + hand-code)** | Total control, professional results | The status quo: **hours per asset**, three skill sets, not repeatable. |

**The wedge mascot-forge owns:** *image → owned, editable React + GSAP (or SVG/CSS) code,
with semantic parts that articulate and bind to live state.* No researched tool occupies
that exact intersection.

### 2.3 Honest caveat on novelty

The truly hard, currently-unsolved sub-problem is **fully automatic 2D rigging** —
inferring a skeleton/anchors from a single flat image. This is active academic research
(UniRig, SIGGRAPH 2025; RigAnything; Adobe's diffusion-based rigging), mostly aimed at
3D and not production-ready for arbitrary 2D web mascots. mascot-forge therefore does
**not** claim to solve auto-rigging. It claims to make the *whole workflow* dramatically
faster with a **human in the loop** for the one genuinely hard step (see
[ADR-0002](adr/0002-assisted-not-full-auto.md)).

---

## 3. Users & use cases

### 3.1 Primary persona — "the indie/portfolio developer"
Builds side projects, dashboards, SaaS landing pages. Wants a characterful mascot that
reacts to app state, but won't learn After Effects or pay for a runtime. Values **owning
the code** (auditable, themeable, no vendor lock-in). *This is also the author.*

### 3.2 Secondary persona — "the design-engineer"
Comfortable in both Figma and React. Wants to skip the tedious layer-separation +
boilerplate-codegen step and jump straight to refining the animation. Values a clean,
editable code output they can take over.

### 3.3 Anti-persona (explicitly out of scope for v1)
- Studios needing film-grade character animation → use Rive/Spine.
- Teams already standardised on After Effects → use Lottie.
- Non-technical users wanting zero-code → that's a hosted GUI, a possible far-future
  layer, not the v1 CLI/library.

### 3.4 Driving use case — DevBrain telemetry mascot
The mascot sits on a homelab dashboard and reflects system state:

| Telemetry state | Intended mascot behaviour |
|---|---|
| Idle (CPU < 15%) | Subtle vertical "breathing" |
| Active / container sync | Rhythmic walk-cycle (legs articulate) |
| Alert (RAM/temp spike) | Rapid antenna pulse + body jitter |

The legacy DevBrain mascot **cannot** do the walk-cycle convincingly because legs and
antenna are baked into static PNG poses — proving the need for true part articulation.

---

## 4. Scope

### 4.1 In scope (v1 / proof-of-concept)
- Ingest a **pixel-art PNG** (clean grid → reliable vectorization — see
  [ADR-0005](adr/0005-pixel-art-poc-first.md)).
- Vectorize to a clean, layer-able SVG.
- **Assisted** semantic segmentation: tool proposes parts, human confirms/adjusts.
- Compute transform-origins per part.
- Emit a **React + GSAP** component **and/or** a **SVG + CSS** variant via a pluggable
  emitter ([ADR-0003](adr/0003-pluggable-emitter.md)).
- A small state machine mapping named states → animations, with a data-binding hook.
- Reproduce DevBrain's three states (idle/active/alert) better than the PNG baseline.

### 4.2 Out of scope (v1)
- Fully automatic, zero-touch rigging.
- Photographic / complex full-colour images (pixel-art and clean flat art only).
- A hosted web GUI / SaaS (CLI + library first).
- Non-React framework adapters beyond the agnostic SVG+CSS path.
- Monetisation, accounts, billing.

### 4.3 Open questions deferred to research/spike
- Does the **React+GSAP** or **SVG+CSS** emitter (or both) best serve the v1 use case?
  → resolved per-need via the pluggable emitter; spike both on the DevBrain asset.
- How much can **SAM/SAM2** segmentation help vs. simple colour-cluster + connected-
  components for pixel art? (Pixel art may not need a heavy VLM.)
- Runtime cost of GSAP vs. pure CSS keyframes on low-power dashboard clients.

---

## 5. Success criteria

**The project succeeds (v1) if:**
1. A pixel-art PNG can be turned into a rigged, multi-part animated React component in
   **minutes, not hours**, with the human only confirming segmentation.
2. The DevBrain mascot rebuilt through mascot-forge **visibly out-classes** the legacy
   PNG-flipbook (independent leg/antenna motion; smooth idle/active/alert states).
3. The emitted code is **readable and editable** — a developer can tweak a timing or
   colour without the tool.
4. The repo reads as a **credible portfolio piece**: clear docs, ADRs, tests, demo.

**Explicit non-goals:** revenue, user counts, beating Rive on raw performance.

---

## 6. Risks (carried into the technical proposal)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Auto-segmentation too unreliable to be useful | High | Human-in-the-loop confirm step; pixel-art-first keeps parts colour-separable |
| Scope creep toward a full SaaS | Medium | MIT + CLI/library only in v1; GUI explicitly deferred |
| Vector artifacting on scaling | Medium | Pixel-art `<rect>` grid path is mathematically exact (no curve fitting) |
| GSAP licensing | **Resolved** | GSAP is 100% free incl. all plugins since Apr 2025 (Webflow) |
| Solo-dev bandwidth (author is a full-time student) | High | Tight v1 scope; one test asset; reuse existing OSS (VTracer, GSAP, SAM) |

Detailed technical mitigations are in
[`technical-proposal.md`](technical-proposal.md#risks--mitigations).
