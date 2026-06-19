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

### Build trail (2026-06-18, Phase 1 implementation)
| # | Finding | Outcome |
|---|---|---|
| 11 | Decoding the Clean Mascot Source PNG showed it is an **anti-aliased raster (2,381 distinct RGB, 36 alpha levels)**, not flat pixel art — exact same-colour clustering degenerates to ~1 rect/pixel (6,433 rects, ~10% mesh). | Amended ADR-0005 → **[ADR-0009](../adr/0009-vectorize-quantize-anti-aliased-source.md)**: v1 vectorizes by deterministic median-cut quantization (largest-gap split). `tools/vectorize-pixel.ps1` ships flat.svg at 89 rects / 98.8% reduction, palette 6, silhouette + accents preserved. |

### Build trail (2026-06-19, Spike 03 — Second-Asset Validation)
| # | Finding | Outcome |
|---|---|---|
| 12 | Ran the **whole pipeline on a second, structurally-different mascot** (cartoon Land Rover). Schema v2 + **both emitters** (`emit-svg-css.ps1`, `tools/emit-react-gsap/`) + the orchestrator runtime (`mascot-state.js` / `useMascotState.ts`) carried it with **zero edits** — verified live in both targets across `idle/active/alert`, with `assertPivotAgreesWithOrigin` passing for all 6 new parts. P1 needed one param (`-Colors 10`); P2 + rig authoring were the assisted steps (ADR-0002). DevBrain-tuned heuristics/strings (P2 part-naming vocab, React `PART_IDS`, `devbrain-*` filename/viewBox hard-codes, O(n²) scale) were **worked around, not edited** → opened Q7. | Claim upgraded *"one good demo" → "an engine that survives a second asset."* See `spikes/03-second-asset/FINDINGS.md`. |

## Open research questions
Status: 🔴 not started · 🟡 partial · 🟢 resolved

| # | Question | Status | Notes / next tool |
|---|---|---|---|
| Q1 | React+GSAP vs SVG+CSS vs both for v1 | 🟢 | **Both; SVG+CSS is the default**, React+GSAP opt-in for interruptible/rich React mascots. Settled empirically by Spike 01 (built both from one shared rig). See `spikes/01-emitter/FINDINGS.md` + ADR-0007. |
| Q2 | Does pixel art need SAM, or is colour-cluster + connected-components enough? | 🟢 | **CCL after colour threshold is sufficient** for colour-separable pixel art; SAM reserved for complex flat art. (pass 2, q10) |
| Q3 | GSAP vs CSS runtime cost on low-power clients | 🟢 | **SVG+CSS confirmed as default.** 18-cell CPU-throttle benchmark (1×/4×/6×): SVG+CSS = **0 main-thread long tasks / 0 ms scripting in every condition** (pure compositor); React+GSAP collapses to ~13 fps with the main thread pinned at 6× (and ~24 fps, half-blocked, at 4×). GSAP opt-in is cheap unthrottled but unsuitable as an always-on element on weak clients — exactly ADR-0007's framing. One-device hardware calibration flagged as follow-up (proxy only this session). See `spikes/02-runtime-cost/FINDINGS.md`. |
| Q4 | `rigged.json` schema for parent/child motion inheritance | 🟢 | **Adopt the Spine model**: ordered bones array, parent-before-child, each `{name, parent, x, y, rotation, length}`; SVG part nodes attach to a bone. (pass 2, q9) **Locked to schema v2** 2026-06-17 — canonical pivots + structured channels + explicit yoyo/iteration drive both emitters; see ADR-0008. |
| Q5 | SAM2 exact capabilities + license for layer proposals | 🟢 | **Apache 2.0, commercial-OK, MIT-compatible**; auto + prompted mask modes. Safe to use *if* CCL proves insufficient. (pass 2, q8) |
| Q6 | Where the human-confirm UI should live (CLI+preview vs local web app) | 🟢 | **CLI + static browser-preview review page**, not a web app. Phase 2 (`tools/segment-parts.ps1`) emits `devbrain-segmented-review.html` — a self-contained static page the human opens to confirm proposed parts/pivots. No server, no app to maintain; matches ADR-0002 (assisted) and the dependency-light house style. Settled by the Phase-2 implementation 2026-06-18. |
| Q7 | v1.1 generalisation: which DevBrain-tuned heuristics/strings need data-driving so a new asset needs no engine edit? | 🟢 | **Resolved 2026-06-19 (v1.1 generalisation, feature/v1.1-generalisation).** Items (1)–(3) and (5) shipped: (1) `-Spec parts-spec.json` data-drives P2 vocabulary (ADR-0010); (2) `PART_IDS` derived from `rig.parts` in `emit.ts`; (3) `-AssetName` param drives all output filenames and demo refs in `emit-svg-css.ps1`; W3a carries viewBox/source-path from spec; (5) Clean-Mascot-Source contract documented. Regression gate: `check-all.ps1` exits 0 on both DevBrain and Land Rover. Item (4) (scale) deferred to v1.2. |

## How to extend this log
1. Pick an open question above.
2. Run the query in whichever tool fits (note it in the trail with date + tool).
3. Drop sources into [`references.md`](references.md) with a one-line "why it matters."
4. Fold conclusions into `product-discovery.md` / `technical-proposal.md` and, if it's a
   decision, write an ADR in [`../adr/`](../adr/).
