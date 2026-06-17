# Reference Library

Annotated sources gathered during discovery. Grouped by topic. Add new entries with the
date you found them and a one-line "why it matters."

> Convention: `[topic] Title — why it matters (found YYYY-MM-DD)`

## Interactive vector runtimes (Rive / Lottie)
- [Rive vs Lottie: Complete Comparison for 2026 — Unicorn Icons](https://unicornicons.com/learn/rive-vs-lottie) — clearest breakdown of state-machine difference + runtime sizes (found 2026-06-17).
- [Lottie vs Rive — Callstack](https://www.callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) — performance/file-size framing (found 2026-06-17).
- [Rive as a Lottie Alternative — rive.app](https://rive.app/blog/rive-as-a-lottie-alternative) — Rive's own positioning (bias-aware) (found 2026-06-17).
- [Engineering Interactive Mascots with Rive's State Machine — DEV](https://dev.to/uianimation/engineering-interactive-mascots-with-rives-state-machine-and-runtime-architecture-4e2h) — directly on-topic: mascots + state machines (found 2026-06-17).
- [Lottie vs Rive vs CSS Animations 2026 — PkgPulse](https://www.pkgpulse.com/guides/lottie-vs-rive-vs-css-animations-web-animation-formats-2026) — adds the CSS baseline comparison (found 2026-06-17).
- [LottieFiles or Rive — LottieFiles Blog](https://lottiefiles.com/blog/lottie-animations/lottiefiles-or-rive) — dotLottie state-machine capability claim (found 2026-06-17).

## Raster → vector
- [VTracer — visioncortex (GitHub)](https://github.com/visioncortex/vtracer) — chosen general vectorizer; MIT, O(n), colour clustering, pixel-art support (found 2026-06-17).
- [Potrace vs ImageTrace vs VTracer — aisvg.app](https://www.aisvg.app/blog/image-to-svg-converter-guide) — comparison backing the VTracer-over-Potrace call (found 2026-06-17).
- [Comparison of raster-to-vector conversion software — Wikipedia](https://en.wikipedia.org/wiki/Comparison_of_raster-to-vector_conversion_software) — neutral overview (found 2026-06-17).

## Pixel-art → SVG (v1 path)
- [GLORP — optimized pixel-art to SVG, greedy meshing (GitHub)](https://github.com/ZackGphom/GLORP) — greedy-mesh approach + reference impl (found 2026-06-17).
- [Pixel-Art_to_SVG — jwolle1 (GitHub)](https://github.com/jwolle1/Pixel-Art_to_SVG) — simple grid-line approach (found 2026-06-17).
- [pixel2svg.com](https://pixel2svg.com/) — RLE rationale (contiguous pixels → one rect) (found 2026-06-17).

## Segmentation
- [Image segmentation — Wikipedia](https://en.wikipedia.org/wiki/Image_segmentation) — background (found 2026-06-17).
- [GrabCut — Wikipedia](https://en.wikipedia.org/wiki/GrabCut) — classical alternative to SAM (found 2026-06-17).
- [Object co-segmentation — Wikipedia](https://en.wikipedia.org/wiki/Object_co-segmentation) — background (found 2026-06-17).
- [SAM 2 — facebookresearch (GitHub)](https://github.com/facebookresearch/segment-anything) + [SAM 2 paper (arXiv)](https://arxiv.org/pdf/2408.00714) — **Apache 2.0**, point/box/mask prompts + automatic mask mode; commercial-OK, MIT-compatible (found 2026-06-17, pass 2).
- [SAM 2 model license — Roboflow](https://roboflow.com/model-licenses/segment-anything-2) — confirms Apache 2.0 / commercial use (found 2026-06-17, pass 2).
- [Connected-component labeling — Wikipedia](https://en.wikipedia.org/wiki/Connected-component_labeling) — the part-separation method (CCL after colour threshold) chosen ahead of SAM for pixel art (found 2026-06-17, pass 2).
- [Connected Component Analysis — Data Carpentry](https://datacarpentry.github.io/image-processing/08-connected-components.html) — practical Python walkthrough for separating coloured regions into parts (found 2026-06-17, pass 2).

## Rig data model (rigged.json schema)
- [Spine JSON export format — Esoteric Software](http://en.esotericsoftware.com/spine-json-format) — the bones-array / parent-before-child template adopted for `rigged.json` (found 2026-06-17, pass 2).
- [Spine Bones — User Guide](http://en.esotericsoftware.com/spine-bones) — transform inheritance (rotate/translate/scale/shear cascade to children) (found 2026-06-17, pass 2).
- [Rive Bones — Help](https://help.rive.app/editor/manipulating-shapes/bones) — parent/child nesting model, cross-check (found 2026-06-17, pass 2).

## Automatic rigging (research frontier)
- [UniRig — VAST-AI (GitHub), SIGGRAPH 2025](https://github.com/VAST-AI-Research/UniRig) — unified auto skeleton + skinning (found 2026-06-17).
- [RigAnything — arXiv](https://arxiv.org/html/2502.09615v1) — template-free autoregressive rigging (found 2026-06-17).
- [Automatic diffusion-based rigging — Adobe Research](https://research.adobe.com/publication/automatic-diffusion-based-rigging-for-characters-with-diverse-topologies/) — rig from few posed frames (found 2026-06-17).
- [ASMR: Adaptive Skeleton-Mesh Rigging via 2D Generative Prior — Wiley CGF 2025](https://onlinelibrary.wiley.com/doi/10.1111/cgf.70052?af=R) — 2D-prior angle, most relevant to 2D (found 2026-06-17).

## Licensing
- [Webflow makes GSAP 100% free — Webflow Blog](https://webflow.com/blog/gsap-becomes-free) — primary source for the free-GSAP claim (found 2026-06-17).
- [GSAP is Now Completely Free, Even for Commercial Use — CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/) — corroboration + plugin list (found 2026-06-17).
- [Standard License — GSAP](https://gsap.com/community/standard-license/) — the actual licence terms (found 2026-06-17).

## AI mascot generators (adjacent, not competitors)
- [svgapp.ai mascot generator](https://svgapp.ai/mascot/) — prompt → mascot art (found 2026-06-17).
- [mascot.bot](https://mascot.bot/) — interactive avatar SDK angle (found 2026-06-17).
