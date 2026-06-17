# mascot-forge

**Turn a static image into a rigged, articulated, telemetry-aware web mascot — as code you own.**

mascot-forge is an open-source pipeline that takes a flat raster image (PNG, pixel-art
first) and produces an **animated, component-segmented mascot** that you drop into a
React app. Unlike a black-box runtime, the output is **human-readable code you can read,
edit, and own**: a `.tsx` component, GSAP timelines (or pure SVG/CSS), and a small
state machine that binds animation states to your application's live data.

> Status: **pre-alpha / research + design phase.** This repository currently holds the
> product discovery and technical proposal. No runtime code yet. See [`docs/`](docs/).

---

## Why this exists

Modern AI is great at generating *static* mascots and *heavy* video loops. The painful
gap is the step *after* art exists: turning a flat image into an interactive,
data-driven web element. Today that means hours of manual work in Illustrator/Figma —
separating layers, setting transform-origins, hand-writing animation code — per asset.

Existing tools each solve part of this but leave the gap open:

- **Rive** — excellent interactive state machines and rigging, but ships a binary
  `.riv` file played by a ~200 KB WASM canvas runtime. You don't own the animation as
  editable code.
- **Lottie / dotLottie** — great After-Effects-to-JSON playback (and now state
  machines), but again a JSON asset + a runtime player, not code you author.
- **AI mascot generators** (svgapp.ai, mascot.bot, …) — generate *their* art from a
  prompt. They don't rig *your* existing asset into *your* codebase.
- **Vectorizers** (VTracer, Potrace) — flatten an image into one path/colour stack with
  no semantic anatomy: legs, body, and antenna fuse into a rigid blob.

**The wedge:** nothing takes an arbitrary image and emits *owned, editable React + GSAP
(or SVG/CSS) code* with semantic parts that articulate and respond to live state.

## The origin: DevBrain

mascot-forge starts as dogfooding. [DevBrain](https://github.com/) (the author's
self-hosted homelab dashboard) has a pixel-art moustache mascot. Its current
implementation is a **flipbook of pre-rendered PNG poses** swapped per state, with
whole-sprite motion — which is exactly why it looks "good but not pro": the legs and
antenna can't move independently. That asset is **test case #1**
(see [`assets/`](assets/)) and the baseline mascot-forge must beat.

## Pipeline (target)

```
[ image.png ]
      │  Phase 1 — Ingest & Vectorize (VTracer / pixel-grid → SVG)
      ▼
[ flat SVG ]
      │  Phase 2 — Assisted Segmentation (AI proposes parts, human confirms)
      ▼
[ semantic <g> layers + transform-origins ]
      │  Phase 3 — Rig & Emit (pluggable backend)
      ▼
[ React+GSAP component ]  ──or──  [ framework-agnostic SVG+CSS ]
      │  Phase 4 — State Orchestrator (bind states to live telemetry)
      ▼
[ mascot that breathes on idle, walks on activity, panics on alert ]
```

See the [Technical Proposal](docs/technical-proposal.md) for the full architecture.

## Design decisions so far

| Decision | Choice | ADR |
|---|---|---|
| Scope | Reusable **engine**, not one mascot | [0001](docs/adr/0001-scope-engine-not-just-mascot.md) |
| Automation (v1) | **Assisted / human-in-the-loop** (full-auto is a stretch goal) | [0002](docs/adr/0002-assisted-not-full-auto.md) |
| Output | **Pluggable emitter**: React+GSAP ↔ SVG+CSS | [0003](docs/adr/0003-pluggable-emitter.md) |
| License | **MIT** (portfolio-first, fully open) | [0004](docs/adr/0004-mit-license.md) |
| PoC scope | **Pixel-art first** (clean grid → reliable trace) | [0005](docs/adr/0005-pixel-art-poc-first.md) |

## Repository layout

```
mascot-forge/
├── README.md                  ← you are here
├── LICENSE                    ← MIT
├── docs/
│   ├── product-discovery.md   ← problem, market gap, personas, scope, success criteria
│   ├── technical-proposal.md  ← architecture, phases, stack, open questions
│   ├── research/
│   │   ├── landscape.md       ← competitor + prior-art analysis (sourced)
│   │   ├── references.md       ← annotated link library
│   │   └── research-log.md    ← methodology + tool-per-query trail
│   └── adr/                   ← architecture decision records
└── assets/
    └── devbrain-mascot-reference-v1.png   ← test case #1
```

## License

[MIT](LICENSE) © 2026 Andrew Lawson
