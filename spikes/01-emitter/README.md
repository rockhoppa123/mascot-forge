# Spike 01 — Emitter Shoot-out

Throwaway harness that settles **Q1** (`docs/research/research-log.md`): which Output Target
for v1 — React+GSAP, SVG+CSS, or both? It builds the *same* DevBrain mascot, with the *same*
three states, **twice** — once per emitter — from one shared rig, then compares.

**Read the result:** [`FINDINGS.md`](./FINDINGS.md) → verdict written up as
[`../../docs/adr/0007-output-target-verdict-both-svg-css-default.md`](../../docs/adr/0007-output-target-verdict-both-svg-css-default.md).

## Run
```bash
npm install
npm run dev   # opens http://localhost:5173
```
Three buttons (Idle / Active / Alert) drive both mascots side by side. The "Force reduced
motion" checkbox exercises the `prefers-reduced-motion` fallback without changing OS settings.

## Layout
| Path | Role |
|---|---|
| `src/mascot.svg` | **Shared geometry** — copy of the accepted `docs/buildable-slice/devbrain-manual-part.svg`. Both targets render this exact SVG. |
| `src/rigged.json` | **Shared rig contract** — copy of the accepted `docs/buildable-slice/devbrain-rigged.json`. Drives timing/pivots for both targets. |
| `src/react-gsap/Mascot.tsx` | Emitter target A — React + GSAP timelines. |
| `src/svg-css/Mascot.tsx` + `mascot.css` | Emitter target B — CSS keyframes (stylesheet reused verbatim from the buildable slice). |
| `src/svgPrep.ts` | Id-namespaces the GSAP copy so both SVGs coexist on one page without duplicate ids / CSS bleed. |
| `FINDINGS.md` | **Keeper** — the comparison and verdict. |

## Reconciliation note
The original prompt (`docs/spikes/01-emitter-spike-prompt.md`) predated the project's switch
to "Buildable Slice" language. It assumed a fresh SVG/rig and ADR-0006. Both were already
taken, so this spike **reused** the accepted geometry, **added the missing React+GSAP target**
next to the existing SVG+CSS one, and writes the verdict as **ADR-0007**. Only the React+GSAP
files, the harness, and `FINDINGS.md` are new; `mascot.svg`/`rigged.json` are the accepted
buildable-slice assets carried forward as the Phase-3 contract.
