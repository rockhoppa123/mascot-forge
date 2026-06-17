# Research Log & Methodology

This log records **how** the research behind the discovery + technical docs was done, and
tracks open questions. Keeping the trail explicit makes the proposal auditable and lets a
future you (or a collaborator) re-run or extend any query.

## Methodology

### Tools used
| Tool | Role in this project | Status |
|---|---|---|
| **Claude Code (`WebSearch`)** | Primary research engine for the 2026-06-17 pass: competitor landscape, vectorization methods, segmentation, auto-rigging research, GSAP licensing. | Used |
| **Claude Code (file tools)** | Inspected the DevBrain repo to characterise the baseline mascot (PNG-sprite-swap + Framer Motion) and copy the reference asset. | Used |
| **Perplexity** | Reserved for deeper academic follow-up (auto-rigging papers, SAM2 specifics). | Planned |
| **Gemini / Google** | Reserved for cross-checking market claims and finding recent (2026) tools. | Planned |
| **Codex / GPT** | Reserved for implementation-spike research (codegen patterns, GSAP API specifics) once building starts. | Planned |

> The 2026-06-17 pass was run entirely through Claude Code's live web search. Subsequent
> passes can be layered in from Perplexity/Gemini/Codex and recorded below, one row per
> query, so the provenance of every claim stays clear.

### Query trail (2026-06-17, Claude Code WebSearch)
| # | Query | What it resolved |
|---|---|---|
| 1 | Rive vs Lottie 2026 state machine web runtime comparison | Confirmed Rive = closest competitor; binary+WASM runtime; sizes (~200 KB / ~60 KB) |
| 2 | SAM 2 automatic image layer separation PNG→SVG | Weak results; flagged to re-run against Meta AI sources |
| 3 | VTracer vs Potrace raster→vector quality | VTracer chosen (colour, O(n), pixel-art, MIT) |
| 4 | GSAP free license Webflow 2025 | Confirmed GSAP 100% free incl. plugins since Apr 2025 |
| 5 | Pixel art PNG → clean SVG rect grid algorithm | RLE/greedy-mesh → `<rect>`; tools GLORP/pixel2svg/Blocky |
| 6 | Automatic 2D character rigging from image 2024–2025 | Confirmed auto-rig = unsolved research → human-in-loop v1 |
| 7 | Tool: image → animated React SVG mascot 2025 | No tool occupies our exact wedge; generators make their own art |

### Query trail (2026-06-17, pass 2 — open-question deep dive)
| # | Query | What it resolved |
|---|---|---|
| 8 | SAM2 license + capabilities | **Apache 2.0** (commercial-OK, MIT-compatible), Jul 2024; point/box/mask prompts + fully-automated mask mode → resolves Q5 |
| 9 | Rive/Spine bone hierarchy + JSON data model | Spine JSON: bones array, parent-before-child, `name/parent/length/x/y/rotation`; Rive nests children under parent bone → resolves Q4 (schema template) |
| 10 | Connected-component labeling for colour/sprite part separation | CCL after colour threshold is the standard part-separation method → resolves Q2 (no SAM needed for pixel art) |

## Open research questions
Status: 🔴 not started · 🟡 partial · 🟢 resolved

| # | Question | Status | Notes / next tool |
|---|---|---|---|
| Q1 | React+GSAP vs SVG+CSS vs both for v1 | 🟢 | **Both; SVG+CSS is the default**, React+GSAP opt-in for interruptible/rich React mascots. Settled empirically by Spike 01 (built both from one shared rig). See `spikes/01-emitter/FINDINGS.md` + ADR-0007. |
| Q2 | Does pixel art need SAM, or is colour-cluster + connected-components enough? | 🟢 | **CCL after colour threshold is sufficient** for colour-separable pixel art; SAM reserved for complex flat art. (pass 2, q10) |
| Q3 | GSAP vs CSS runtime cost on low-power clients | 🔴 | Empirical — micro-benchmark on actual dashboard hardware (not desk-researchable) |
| Q4 | `rigged.json` schema for parent/child motion inheritance | 🟢 | **Adopt the Spine model**: ordered bones array, parent-before-child, each `{name, parent, x, y, rotation, length}`; SVG part nodes attach to a bone. (pass 2, q9) |
| Q5 | SAM2 exact capabilities + license for layer proposals | 🟢 | **Apache 2.0, commercial-OK, MIT-compatible**; auto + prompted mask modes. Safe to use *if* CCL proves insufficient. (pass 2, q8) |
| Q6 | Where the human-confirm UI should live (CLI+preview vs local web app) | 🔴 | Decide during Phase-2 spike |

## How to extend this log
1. Pick an open question above.
2. Run the query in whichever tool fits (note it in the trail with date + tool).
3. Drop sources into [`references.md`](references.md) with a one-line "why it matters."
4. Fold conclusions into `product-discovery.md` / `technical-proposal.md` and, if it's a
   decision, write an ADR in [`../adr/`](../adr/).
