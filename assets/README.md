# assets/

Per-asset source files. Each subdirectory is one mascot.

## Clean-Mascot-Source contract

- Source must be a **transparent PNG**, flat/pixel-art-friendly (no gradients, no anti-aliased edges)
- Oversized sources: downscale with **nearest-neighbor** interpolation before vectorizing — NOT bicubic
  - Bicubic blends flat cartoon colours into smooth gradients; median-cut (ADR-0009) then slices each into visible colour bands
  - Nearest-neighbor preserves hard colour edges → flat runs merge → no banding
- Reference: `spikes/03-second-asset/prep-source.ps1` — worked background-keying + NN-downscale example

## Layout

| Directory | Asset |
|---|---|
| `devbrain/` | Former DevBrain mascot; mascot-forge flagship showoff asset |
| `land-rover/` | Land Rover Series III (Spike 03 second-asset validation) |

## Test case #1 — DevBrain mascot

`devbrain-mascot-reference-v1.png` — the reference sheet for DevBrain's pixel-art
moustache mascot (orange moustache body, arms, legs, green antenna), showing several
states: `DEFAULT`, `THINKING`, `HAPPY`, `DIAGNOSTIC`, `REBOOT`.

This is the **baseline mascot-forge must beat**, the first end-to-end test asset, and the public showoff
for what the project, software, and MCP path can do.

### Baseline implementation (the thing we're improving on)
The mascot used to live in the DevBrain repo. It now lives here:

- Reference sheets: `assets/devbrain/reference-sheets/`
- Exported PNG poses: `assets/devbrain/poses/`
- Old DevBrain runtime baseline: `assets/devbrain/baseline-devbrain-runtime/`

**How the old DevBrain implementation worked:** it was *not* a rigged vector. Each state rendered a
**pre-rendered transparent PNG pose** (`/mascot/default.png`, `/mascot/thinking.png`, …,
exported by the archived `baseline-devbrain-runtime/tools/mascot-trace/export-assets.mjs`), swapped per state, with
`motion/react` (Framer Motion) animating the **whole sprite** (idle hop). Because parts
are baked into flat PNGs, **legs and antenna cannot move independently** — which is
exactly why a convincing walk-cycle isn't possible and why it reads as "good but not pro."

### Why it's the right first test
- It is **pixel art** → fits the [pixel-art-first PoC](../docs/adr/0005-pixel-art-poc-first.md).
- Its parts are **colour-separable** (orange body / dark legs / green antenna) → friendly
  to colour-cluster segmentation before any heavy ML.
- It has **clear behavioural states** already mapped to telemetry (idle/active/alert) →
  ready-made target for the Phase-4 state orchestrator.

> Asset reuse note: migrated from the DevBrain repo for reference/testing/showoff work. DevBrain is the
> author's own project, so reuse is unrestricted. DevBrain no longer owns mascot runtime or assets.
