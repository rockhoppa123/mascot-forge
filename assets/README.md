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
| `devbrain/` | DevBrain mascot (reference asset, v1 pipeline) |
| `land-rover/` | Land Rover Series III (Spike 03 second-asset validation) |

## Test case #1 — DevBrain mascot

`devbrain-mascot-reference-v1.png` — the reference sheet for DevBrain's pixel-art
moustache mascot (orange moustache body, arms, legs, green antenna), showing several
states: `DEFAULT`, `THINKING`, `HAPPY`, `DIAGNOSTIC`, `REBOOT`.

This is the **baseline mascot-forge must beat** and the first end-to-end test asset.

### Baseline implementation (the thing we're improving on)
The mascot currently lives in the DevBrain repo at:

- `C:\Users\student1\Dev\DevBrain\components\mascot\devbrain-mascot.tsx`
- (parallel copy: `C:\Users\student1\Dev\DevBrain-mascot\components\mascot\devbrain-mascot.tsx`)
- Reference art: `C:\Users\student1\Dev\DevBrain\docs\design\devbrain-mascot-*.png`

**How it works today:** it is *not* a rigged vector. Each state renders a
**pre-rendered transparent PNG pose** (`/mascot/default.png`, `/mascot/thinking.png`, …,
exported by `tools/mascot-trace/export-assets.mjs`), swapped per state, with
`motion/react` (Framer Motion) animating the **whole sprite** (idle hop). Because parts
are baked into flat PNGs, **legs and antenna cannot move independently** — which is
exactly why a convincing walk-cycle isn't possible and why it reads as "good but not pro."

### Why it's the right first test
- It is **pixel art** → fits the [pixel-art-first PoC](../docs/adr/0005-pixel-art-poc-first.md).
- Its parts are **colour-separable** (orange body / dark legs / green antenna) → friendly
  to colour-cluster segmentation before any heavy ML.
- It has **clear behavioural states** already mapped to telemetry (idle/active/alert) →
  ready-made target for the Phase-4 state orchestrator.

> Asset reuse note: copied from the DevBrain repo for reference/testing. DevBrain is the
> author's own project, so reuse is unrestricted.
