# React+GSAP as a reachable, tested Output Target — design

- **Date:** 2026-07-25
- **Status:** Approved (design phase)
- **Governs:** [ADR-0003](../../adr/0003-pluggable-emitter.md) (pluggable emitter),
  [ADR-0007](../../adr/0007-output-target-verdict-both-svg-css-default.md) (both targets, SVG+CSS default)

## Problem

Three gaps, all in the same place.

1. **The agent path can't reach the second Output Target.** `mcp/tools.mjs` has zero references to
   `react`/`gsap`; `forgeEmit` hardcodes the SVG+CSS path. README and ADR-0007 both advertise
   React+GSAP as a shipped, opt-in target, but a user following the headline MCP flow cannot get it.
   ADR-0003 mandates "Phase 3 consumes a single `rigged.json` and delegates to a swappable Emitter
   plugin" — the MCP currently does not delegate at all.
2. **The React+GSAP target has no gate coverage.** `tools/check-all.ps1` never mentions it. A
   first-class shipped target regresses silently.
3. **ADR-0007's #1 named risk has never been tested.** It states: "The biggest fidelity risk for an
   automated pipeline is the GSAP-vs-CSS pivot computation difference." The emitter self-asserts
   internally (`assertPivotAgreesWithOrigin`), but nothing proves the two *targets* resolve a part's
   pivot to the same absolute point. The risk is real because the two sides compute the part bbox by
   different routes: `tools/rig-editor/exporter.js` derives the CSS `%` from the **model's** rect
   bbox, while `tools/emit-react-gsap/src/emit.ts` re-derives a bbox by regex-scanning `<rect>`
   elements out of the **emitted SVG**. Nothing currently forces those two to agree.

## Non-goals

- Changing the default. SVG+CSS stays the default; React+GSAP stays opt-in (ADR-0007).
- Adding an MCP tool. The tool count is a locked contract at 10 (`mcp/protocol.test.mjs`).
- Adding any dependency to the runtime, the browser editor, or `mcp/`.
- Making React or GSAP a *build* dependency of anything. They are demo-app deps only.

## Key enabling fact

`tools/emit-react-gsap/src/emit.ts` imports **only** `node:fs`, `node:path`, `node:url`. React, GSAP,
Vite and TypeScript are dependencies of the *demo application*, not of the emitter. The emitter is a
pure string generator. So it can be driven in-process with no install and no build step.

## Architecture

Extract the emitter's logic into a pure ESM core, and let both callers share it. This mirrors an
existing pattern in the repo: `tools/rig-editor/emit.js` is the shared SVG+CSS generator used by both
the live preview and the export, precisely so the two cannot drift. The second target gets the same
treatment.

```
tools/emit-react-gsap/
├── emit-react.mjs        ← NEW. Pure ESM core, zero deps.
│                            emitReactGsap({ riggedJson, manualSvg }) -> { [filename]: contents }
├── emit-react.test.mjs   ← NEW. node:assert. Golden + unit + cross-target fidelity.
├── src/emit.ts           ← becomes a thin CLI wrapper: read files -> core -> write files
├── generated/            ← unchanged output; serves as the golden
└── demo/                 ← vite demo app (npm deps live here, dev-only)
```

**Core contract.** One exported function, no I/O:

```js
emitReactGsap({ riggedJson, manualSvg, sourceLabel }) -> { "Mascot.tsx": "...", "mascotRig.ts": "...",
                                                           "mascotMarkup.ts": "...", "README.md": "..." }
```

It throws a descriptive `Error` on invalid input (wrong schema version, missing part geometry,
pivot/origin drift). It never touches the filesystem and never reads `process.env` — the CLI owns
both. `sourceLabel` is the provenance string the generated files cite (today hardcoded to the
DevBrain paths); making it a parameter is what lets an MCP session name its own source.

**MCP surface.** `forgeEmit` gains one optional parameter — no new tool, so the 10-tool lock holds:

```js
forgeEmit({ session, assetName, outDir, target })   // target: "svg-css" (default) | "react-gsap" | "both"
```

`forgeEmit` already computes `exportRig(model, …) -> { riggedJson, manualSvg }`, which is exactly the
core's input. The React path is therefore a branch on data already in hand, not a second pipeline.
Return shape follows the existing convention: byte counts when `outDir` is omitted, written paths plus
a served URL when it is given.

**Known limitation to surface, not hide.** `computeBBoxes` requires `<rect>` geometry. ADR-0011 made
parts geometry-agnostic, so a path-based rig (a layered Figma/Inkscape import) cannot currently be
emitted to React+GSAP. The MCP must return a clear, actionable message for that case rather than
propagating a raw emitter throw. This is a documented v1 ceiling, not a bug to fix here.

## Testing

Every stage is TDD, `node:assert/strict`, no framework, mirroring the existing `*.test.mjs` files.

1. **Golden (port safety).** The committed `tools/emit-react-gsap/generated/*` files must be
   reproduced **byte-for-byte** by the extracted core from the same rig inputs. Verified before
   writing the spec: running the current emitter produces zero content diff against the committed
   files (`git diff --ignore-cr-at-eol` is empty), so the golden is current and the port is
   de-risked. Line endings are normalised before comparison.
2. **Cross-target pivot fidelity (the ADR-0007 risk).** For every part in a rig, assert that the
   SVG+CSS `transform-origin: X% Y%` — resolved against that part's bbox via
   `originToPivot(origin, bbox)` from `tools/rig-editor/pivot.js` — equals the absolute pivot the
   React+GSAP target passes to GSAP as `svgOrigin`, within a tolerance of 0.5% of the part bbox.
   This is the first test in the project's history to prove both targets rotate around the identical
   point. It must run against the real DevBrain rig, not a synthetic fixture.
3. **MCP behaviour.** `target: "react-gsap"` and `target: "both"` return the React artifacts; the
   default is unchanged (regression guard for SVG+CSS callers); an invalid `target` is rejected with
   a clear error; a path-only rig produces the actionable ceiling message rather than a raw throw;
   `tools/list` still reports exactly 10 tools.

**Gate wiring.** A new `tools/check-react-gsap.ps1` runs the core's tests and the fidelity test, added
to `tools/check-all.ps1` as **P7**. Without this the target regresses silently, which is gap #2.

## Demo

Extend the existing vite demo (`tools/emit-react-gsap/demo/main.tsx`) to render the same rig in both
targets side by side: the React+GSAP `<Mascot>` component next to the SVG+CSS output, sharing one
state control so both react to the same state change simultaneously. This makes ADR-0003's "one rig
contract → two emitters" claim visible rather than asserted.

The demo needs `npm install` inside `tools/emit-react-gsap/` and is therefore **not** part of the
pipeline gate — the same separation the Playwright e2e suite already uses (`tests/`, dev-dep only).

## Stages

Sequential; each ends gate-green and independently committable.

| # | Stage | Deliverable |
|---|---|---|
| 1 | Extract the pure core | `emit-react.mjs` + golden test; `src/emit.ts` delegates; byte-identical output |
| 2 | Cross-target fidelity test | The ADR-0007 pivot-drift proof against the real DevBrain rig |
| 3 | MCP `target` param | `forgeEmit` branch, server schema/description, tests, 10-tool lock intact |
| 4 | Gate + demo + docs | `check-react-gsap.ps1` as P7, side-by-side demo, README/CHANGELOG/ADR note |

## Risks

| Risk | Mitigation |
|---|---|
| Port introduces silent drift | Byte-for-byte golden against committed `generated/`, written before the port |
| Node TS type-stripping instability | Eliminated — the core is `.mjs`; only the unchanged CLI stays TypeScript |
| React/GSAP leaking into the runtime | The core emits **strings**; neither is imported at emit time. Enforced by the core having no imports beyond `node:*` |
| Scope creep into a third target | Out of scope. ADR-0003 already permits it; this design ships the two that exist |
| Path-based rigs silently failing | Explicit, tested ceiling message (see Known limitation) |
