# External Research Prompt (Gemini / Perplexity)

Paste the block below into **Gemini** and **Perplexity** separately (run it in both —
they surface different sources). Save each tool's raw answer per the instructions at the
bottom, then fold conclusions back into `landscape.md` / `references.md` and update the
open-question statuses in `research-log.md`.

---

## PROMPT (copy from here ⬇)

You are a senior front-end/graphics engineer helping me de-risk an open-source project.
Be specific, cite sources with links, prefer 2024–2026 material, and flag anything that is
opinion vs. measured fact. Where you make a recommendation, give the reasoning and the
trade-off, not just a verdict.

**Project context.** I'm building `mascot-forge`: an open-source (MIT) pipeline that turns
a static raster image (pixel-art first) into a *rigged, articulated* web mascot delivered
as **code I own** — either a React + GSAP component or framework-agnostic SVG + CSS — with
a small state machine that binds animation states (idle / active / alert) to live app data
(e.g. homelab dashboard telemetry). It is NOT a runtime like Rive/Lottie (those ship a
binary asset + player); the differentiator is human-readable, editable output code. v1 is
assisted (a human confirms the auto-proposed part segmentation), not fully automatic.
First test asset is a pixel-art moustache mascot with separable colours (orange body, dark
legs, green antenna).

Answer each question as its own section:

**Q3 — Animation runtime performance.** For small, continuously-looping SVG transforms
(translate/rotate/scale on a handful of `<g>` groups), compare **GSAP**, **native CSS
keyframes**, and the **Web Animations API** on low-powered clients (e.g. a Raspberry-Pi-
class device or a cheap laptop browser). What are the main-thread/compositor costs, when
does each win, and is there real benchmark data? Recommend a default for idle loops vs.
event-driven state transitions.

**Q6 — Human-in-the-loop segmentation/rigging UI.** How do existing tools let a user
confirm or adjust auto-proposed regions and set pivot points / transform-origins? Look at
Rive, Spine, DragonBones, SVGator, and image-annotation tools (Label Studio, Roboflow,
labelme). What UX patterns work best for "confirm these parts, name them, set each part's
pivot"? Should a solo-dev v1 do this in a CLI + browser preview, or a small local web app?

**Schema — 2D rig data model.** Beyond Spine's JSON (ordered bones array, parent-before-
child, name/parent/x/y/rotation), how do DragonBones, Lottie, and Rive represent a 2D rig
(part hierarchy + transforms + how artwork attaches to bones)? Recommend a *minimal* JSON
schema for an SVG-based rig: a hierarchy of named parts, each with its SVG node id(s),
bounding box, and transform-origin, plus parent/child transform inheritance.

**Reuse — existing OSS.** What maintained, permissively-licensed (MIT/Apache/BSD) libraries
exist for (a) pixel-art / flat-image → clean `<rect>`/path SVG, and (b) connected-component
labeling on coloured regions in JS/TS or via WASM? Note license, maintenance status, and
quality so I avoid reinventing them.

**Quality — SVG animation + accessibility best practices.** Best practices for animating
inline SVG on the web in 2026: `transform-box`/`transform-origin` gotchas, GPU-accelerated
properties, avoiding layout thrash, and honouring `prefers-reduced-motion`. What commonly
makes hand-built SVG mascots look amateur vs. professional?

**Market — validation & positioning.** Is "turn my image into owned, editable React/SVG
mascot code with live-data-bound states" a real unmet need, or do existing tools/workflows
already cover it well enough? Name the closest real competitors beyond Rive and Lottie, and
say honestly whether this wedge is defensible or a nice-to-have.

**Naming.** Is `mascot-forge` available/clear on npm and GitHub? Any existing projects with
that or a confusingly similar name? Any trademark/SEO concerns?

End with a short "Top 3 things I'd change about this plan" section.

## (⬆ copy to here)

---

## Where to save the responses

1. Create the file for each tool under `docs/research/responses/`:
   - `docs/research/responses/perplexity-2026-06-17.md`
   - `docs/research/responses/gemini-2026-06-17.md`
2. Paste the **raw, unedited** answer into each (keep the links the tool gives you).
3. Add a one-line header at the top of each file: tool name, model/version, date.
4. When done, tell Claude Code "fold in the external research" — it will:
   - extract sourced facts into `references.md` (with "found … via Perplexity/Gemini"),
   - update `landscape.md` where the competitive picture changed,
   - flip the relevant statuses in `research-log.md` (Q3, Q6, schema, etc.),
   - write any new decisions as ADRs.

> Keep raw responses separate from the curated docs — provenance stays clean and you can
> always re-check a claim against what the tool actually said.
