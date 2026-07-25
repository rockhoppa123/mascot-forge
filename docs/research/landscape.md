# Competitive & Prior-Art Landscape

> Research conducted 2026-06-17 via Claude Code `WebSearch`. Each claim links to a source
> in [`references.md`](references.md). This is a living document — append as new tools or
> research appear, and date each addition.

## TL;DR

The space is **mature but segmented**. Strong tools exist for *playing* interactive
vector animation (Rive, Lottie) and for *generating* mascot art (AI generators) and for
*vectorizing* images (VTracer, Potrace). **None** occupy mascot-forge's exact
intersection: *arbitrary image → owned, editable React+GSAP/SVG+CSS code with semantic,
articulating parts bound to live state.* Fully automatic 2D rigging — the one piece that
would make this trivial — is unsolved research, which is why the gap persists.

---

## 1. Interactive vector runtimes

### Rive — the closest competitor
- **Strengths:** purpose-built interactive **state machines** (states + transitions
  driven by boolean/number/trigger inputs set at runtime); true vector rigging/bones;
  one unified C++ runtime across web, iOS, Android, Flutter, Unity, Unreal. Outperforms
  Lottie on file size and runtime in most dimensions.
- **Why not a substitute:** ships a **binary `.riv` asset** played by a **~200 KB
  gzipped WASM runtime** that renders via Canvas/WebGL, bypassing the DOM. You author in
  Rive's editor and adopt Rive's runtime — **you do not get editable code you own.**
- **Takeaway for us:** Rive validates demand for state-driven interactive mascots. Our
  differentiation is *code ownership and DOM-native SVG output*, not beating Rive's
  engine.

### Lottie / dotLottie
- **Strengths:** mature After-Effects → JSON pipeline; lighter (~60 KB) `lottie-web`
  runtime; huge ecosystem; dotLottie now adds state machines "nearly as capable as
  Rive's."
- **Why not a substitute:** still a **JSON asset + player**, and authored in After
  Effects — a separate specialist skill. Not code you write or own.

### Plain CSS / JS animation
- The fallback the status quo falls back to. Total ownership, zero deps, but everything
  is hand-authored per asset — exactly the manual burden we automate.

---

## 2. AI mascot / SVG generators
- Examples: svgapp.ai, mascot.bot, Fotor, Template.net, Easy-Peasy, Magicshot.
- **What they do:** generate posed mascot *art* from a text prompt; export SVG/PNG;
  some offer pose libraries.
- **Why not a substitute:** they create **their** art from a prompt — they do **not**
  take *your* existing asset (e.g. the DevBrain moustache) and rig it into *your*
  codebase as a data-bound component. Different job: art generation, not rigging+codegen.

### 2a. MCP-driven agent-rigging tools (watch-item, added 2026-07-25)
- **Allyson MCP** (`github.com/isaiahbjork/allyson-mcp`) — an MCP server, one tool
  (`generate_svg_animation`), that takes a source PNG/JPG/SVG plus a natural-language prompt and
  emits an animated `.tsx` React component. This is the closest thing found to mascot-forge's
  "agent drives an MCP to rig your existing art into owned code" wedge — not a generator like §2.
- **Why it doesn't close the gap (yet):** confirmed via its README — decorative effects only (glow,
  pulse, spin, bounce), no semantic anatomy (limb/core/accent), no pivot-based articulation, and no
  live-data state binding (a static animated component, not a state machine wired to telemetry).
  mascot-forge's two headline differentiators (semantic-parts rigging + live-data binding) hold.
- **Why it's still worth recording:** it proves the "MCP-driven agent rigs your art" idea is no
  longer unique to mascot-forge — a second, independent implementation exists in the wild. Re-check
  this entry if Allyson (or a similar tool) adds bone/pivot rigging or state-machine binding.

---

## 3. Raster → vector (Phase 1 building blocks)

### VTracer (visioncortex) — chosen general vectorizer
- Rust, MIT, O(n) (vs Potrace's O(n²)). Full-colour via **K-means colour clustering**
  into stacked layers; ~30–70% smaller output than Adobe Image Trace; explicitly handles
  low-res **pixel art** (`image-rendering: pixelated`).
- **Relevance:** its per-colour layering is a *head start* on Phase-2 segmentation, not a
  replacement for it (colour ≠ anatomy).

### Potrace
- Black-and-white only (needs binarized input), O(n²). Fine for monochrome silhouettes;
  unsuitable for a colour mascot. Noted for completeness, not selected.

### Pixel-art specific (chosen v1 path)
- **GLORP**, **pixel2svg**, **Blocky**: convert pixel grids to clean SVG via
  run-length-encoding / greedy meshing — contiguous same-colour pixels → one `<rect>`.
  Mathematically exact, no curve-fitting, no scaling artifacts. Ideal for the pixel-art
  DevBrain mascot.

---

## 4. Segmentation (Phase 2 building blocks)
- **Segment Anything (SAM / SAM2)**, Meta: prompt-free mask proposals trained on 1B+
  masks; can isolate arbitrary objects. Usable to *propose* part masks, named by a VLM.
  **SAM2 is Apache-2.0** (commercial-OK, MIT-compatible), released Jul 2024; supports
  point/box/mask prompts *and* a fully-automatic mask mode — so it is licence-safe to
  bundle as the fallback path.
- **Classical (chosen first):** colour threshold → **connected-component labeling (CCL)**,
  plus GrabCut/colour clustering — cheaper, deterministic, and sufficient for flat/pixel
  art where parts are colour-separable (the DevBrain case). **Use these before reaching
  for SAM**; SAM2 is the escalation, not the default.

---

## 5. Automatic rigging (the unsolved core — Phase 2/3 frontier)
Active 2024–2025 research, mostly **3D**, none production-ready for arbitrary 2D web mascots:
- **UniRig** (VAST-AI, SIGGRAPH 2025): one model, automated skeleton + skinning across
  humans/animals/objects.
- **RigAnything**: autoregressive transformer; skeleton + skinning from arbitrary poses.
- **Adobe diffusion-based rigging**: infers a rig from 3–5 example posed frames.
- **ASMR** (CGF 2025): adaptive skeleton-mesh rigging via a 2D generative prior.
- **Takeaway:** validates [ADR-0002](../adr/0002-assisted-not-full-auto.md) — auto-rig is
  a moonshot; v1 keeps a human in the loop and treats full-auto as a long-term stretch.

---

## 6. Licensing intelligence
- **GSAP is 100% free, including all formerly-paid plugins** (SplitText, MorphSVG,
  DrawSVG, ScrollTrigger, ScrollSmoother, Inertia), for commercial use, since **April
  2025**, following **Webflow's acquisition of GreenSock** (Oct 2024). This removes the
  single biggest historical risk of building on GSAP and makes the `react-gsap` emitter
  fully viable for an MIT project. MorphSVG/DrawSVG are directly useful for mascot motion.

---

## 7. Positioning summary

| Axis | Rive | Lottie | AI generators | Vectorizers | **mascot-forge** |
|---|---|---|---|---|---|
| Takes *your* arbitrary image | partial | ✗ | ✗ | ✓ | ✓ |
| Semantic articulating parts | ✓ | ✓ | ✗ | ✗ | ✓ (assisted) |
| State-machine / data binding | ✓ | ✓ (dotLottie) | ✗ | ✗ | ✓ |
| Output is **owned, editable code** | ✗ | ✗ | partial (static) | ✓ (flat) | ✓ |
| No proprietary runtime | ✗ | ✗ | n/a | ✓ | ✓ |

mascot-forge is the only column that is ✓ across *image-in*, *articulation*, *data-binding*,
**and** *owned code* — at the cost of an assisted (not fully automatic) segmentation step.
