# Cross-platform gate — design

- **Date:** 2026-07-28
- **Status:** Approved (design phase)
- **Stage:** 2 of the layered-first reframe (harden ingest ✅ → **cross-platform gate** → docs/demo flip
  → hero capture → push)

## Problem

`tools/check-all.ps1` is the project's only gate, and it is PowerShell-only. For a JS-ecosystem project
about to be published, that is the single biggest barrier to an outside contributor: they clone, read
CONTRIBUTING.md, and the first instruction requires a shell they may not have.

The barrier is not evenly distributed across the gate. P4-determinism, P5, P6 and P7 already just loop
`node <name>.test.mjs` — those rows are PowerShell only by accident of where they live. The real work is
four checkers, ~620 lines, that lean on PowerShell's `[xml]` + XPath:

| Script | Lines | What it actually guards |
|---|---|---|
| `tools/check-flat-svg.ps1` | 91 | flat.svg root contract, rect-only geometry, one `<g data-color>` per colour, rects inside declared bounds, coverage reaching those bounds, rect count under 2000 (proof greedy meshing collapsed runs) |
| `tools/check-segmented.ps1` | 71 | segmented.svg part vocabulary and fixed order, pivots inside canvas, and the cross-file invariant that part rects sum exactly to flat.svg's rect count |
| `tools/check-buildable-slice.ps1` | 376 | the big one — file manifest, no root `package.json`, Manual Part SVG structure, `rigged.json` schema v2, CSS/demo content, then the same suite again against `generated/`, plus showcase reference integrity |
| `tools/check-orchestrator.ps1` | 80 | runtime exports present, demo wiring, states sourced from `rigged.json`, no stray TODO markers, and it shells out to `node` for the runtime test |

### The finding that reshapes this stage

The handoff calls the port "mostly mechanical". It is not, for one reason: the **P3 land-rover-emit**
row invokes `tools/emit-svg-css.ps1` — **527 lines, and a product script**, wired into `mf.ps1`'s `emit`
verb and documented in CONTRIBUTING.md. Porting it means porting a product feature.

But it does not need porting, because **it is a duplicate**. `tools/rig-editor/emit.js` already produces
CSS, animated SVG and demo HTML in zero-dependency pure ESM, and `mcp/tools.mjs` already imports it
(`emitAnimatedSvg`, `emitShowcaseHtml`). The repo has had two emitters for the same target; the gate has
been gating the PowerShell one while the MCP and the browser editor ship the JavaScript one.

That is this repo's named failure mode pointed at itself: the artifact under test is not the artifact
that ships.

## Decisions

Both taken by the owner on 2026-07-28.

1. **The land-rover cross-asset row runs the Node emitter.** `emit-svg-css.ps1` keeps working for
   `mf emit` and gains the same self-marked `LEGACY / batch-only` header that `vectorize-pixel.ps1` and
   `segment-parts.ps1` already carry. The gate then proves the emitter that actually ships, and the
   PowerShell one becomes explicitly unmaintained rather than silently ungated.
2. **Zero-dependency. No XML library, no `package.json` anywhere under `tools/gate/`.**
   *(Initially decided the other way — `@xmldom/xmldom` + `xpath` — and reversed the same day.)*

   The reversal reason is not cost, it is coherence: **the gate is the thing that asserts the
   zero-dependency property.** `check-buildable-slice` exists partly to prove no root `package.json`
   crept in. An assertor that itself requires `npm install` undermines the claim it exists to defend,
   and the dependency boundary — deps permitted in `mcp/`, `tests/`, `tools/emit-react-gsap/`; forbidden
   in `runtime/`, `tools/rig-editor/`, and now the gate — is load-bearing in the README badge and the
   ADRs.

   The XML surface is also smaller than "620 lines" suggests: `rigged.json` assertions are `JSON.parse`,
   CSS and demo-HTML assertions are string matching. Only flat-svg, segmented, and part of
   buildable-slice need element scanning, and **stage 1 already built a zero-dep scanner for exactly
   this shape of work** — `topLevelGroups()` in `tools/rig-editor/layer-ingest.js`, which is pure ESM,
   node-tested, and now hardened against comments and non-rendered subtrees. `tools/rig-editor/` is
   itself zero-dependency, so importing from it keeps the gate zero-dependency.

   Consequence worth stating plainly: CONTRIBUTING.md's *"No `npm install` and no build step are needed
   to run the core pipeline or the gate"* **stays true**, and no auto-install machinery is needed.
3. **The four `.ps1` checkers are deleted** once ported. They have no product role — nothing but the
   gate calls them — and four unmaintained duplicates of 620 lines of assertions is drift bait.

## Non-goals

- **Porting `emit-svg-css.ps1`.** Decision 1 makes it unnecessary. It stays, marked legacy.
- **Porting the legacy batch scripts.** `vectorize-pixel.ps1` (System.Drawing, genuinely Windows-only)
  and `segment-parts.ps1` are already self-marked "do not add features here" and are outside the gate's
  call graph entirely.
- **Touching `mf.ps1`.** The PowerShell CLI keeps working exactly as it does today.
- **Changing what any check asserts.** This is a port. A check that is wrong stays wrong, and gets
  fixed separately — otherwise a behaviour change hides inside a translation diff.
- **Moving any golden.** `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` stay
  byte-for-byte.
- **Adding an MCP tool.** Locked at 10.
- **`check-e2e.ps1`.** Playwright already runs through npm; that shim is out of scope.

## Architecture

```
tools/gate/                  NO package.json. Imports node: builtins + tools/rig-editor siblings only.
  svg-scan.mjs               small shared element/attr scanner (~40 lines) over the existing
                             topLevelGroups(); the only "XML" facility the checkers get
  check-all.mjs              canonical gate. Same ordered-array shape as check-all.ps1.
  check-flat-svg.mjs         ported
  check-segmented.mjs        ported
  check-buildable-slice.mjs  ported
  check-orchestrator.mjs     ported
  emit-land-rover.mjs        NEW — cross-asset proof via the Node emitter
tools/check-all.ps1          reduced to a shim -> node tools/gate/check-all.mjs
tools/emit-svg-css.ps1       + LEGACY/batch-only header; otherwise untouched
tools/check-flat-svg.ps1     DELETED
tools/check-segmented.ps1    DELETED
tools/check-buildable-slice.ps1  DELETED
tools/check-orchestrator.ps1     DELETED
```

### Why `check-all.ps1` survives as a shim

Every doc, the CONTRIBUTING gate line, this repo's progress ledger, and a good deal of muscle memory
assert on the exact string `RESULT: PASS (all pipeline checks green)` produced by that path. Deleting it
would break all of that for no gain. As a shim it keeps every existing instruction true while the real
gate becomes `node tools/gate/check-all.mjs`.

Both entry points must print byte-identical summary output.

### CI is where "cross-platform" actually gets proven

Without this section the stage is unfalsifiable: a Node gate that only ever runs on the author's Windows
box is not demonstrably cross-platform.

`.github/workflows/ci.yml` currently pins the gate to `windows-latest`, with this justification in a
comment:

> The full pipeline gate includes vectorize-pixel.ps1, which uses System.Drawing (Windows-only), so the
> gate runs on windows-latest

**That is false.** `tools/check-all.ps1` contains zero references to `vectorize-pixel.ps1` — that script
is reachable only through `mf forge`, never through the gate. CI has been pinned to Windows for a reason
that does not hold, and the comment has been carrying the belief forward.

So: **the gate job moves to `ubuntu-latest`.** That is the acceptance test for this entire stage, and it
is binary. Two smaller corrections in the same file: the step is named "Full pipeline gate (P1–P5)" when
it has been P1–P7 since the react-gsap work landed, and the invocation becomes
`node tools/gate/check-all.mjs`.

A Windows matrix entry stays, because `mf.ps1` and the legacy batch path remain Windows-only and a
regression there should still surface. The point is that Linux becomes the *default* proof, not that
Windows stops being checked.

### Reference cleanup: live instructions vs. historical record

Deleting four scripts referenced ~50 times needs a policy, or the cleanup either misses live
instructions or vandalises the project's history.

**Update — these instruct a reader what to do today:**

- `README.md:149` — the repo tree listing names all four scripts.
- `docs/buildable-slice/README.md:85` and `:102` — prose plus a literal "run this" command.
- `docs/technical-proposal.md:216`.
- `CONTRIBUTING.md` — see below, it needs more than a name swap.
- `tools/check-all.ps1` — becomes the shim regardless.

**Leave, and do not rewrite — these are dated records of what was true when written:**

- `docs/plans/*` and `docs/research/*` — completed implementation plans and their originating prompts.
- `docs/superpowers/plans/*` — including this project's own earlier plans.
- `.superpowers/sdd/progress.md` and its task briefs.
- `docs/adr/0008-rigged-json-schema-v2-lock.md:43` — an ADR describing what enforced the lock at the
  time. The enforcement moves; the decision does not. Changing an ADR's decision is a stop-and-ask, and
  this is not that — but neither is it worth editing. Leave it.

The rule matches how the stage-1 spec and plan were handled when a later finding contradicted them:
annotate or leave, never silently rewrite.

`mf.ps1` needs no change: its `check` verb calls `tools/check-all.ps1`, which survives as the shim.

### CONTRIBUTING.md

Line 12 — *"No `npm install` and no build step are needed to run the core pipeline or the gate"* —
**stays true** under the zero-dependency decision, and is worth keeping true.

Line 7 — *"**PowerShell 7+** (`pwsh`) — the pipeline tools are PowerShell"* — needs softening: after this
stage the *gate* is Node and needs no `pwsh` at all. PowerShell drops from a prerequisite to an optional
one, needed only for the `mf.ps1` batch path. That distinction is the entire contributor-facing point of
this stage and should be the first thing a reader learns.

### The land-rover cross-asset proof

The existing row copies three fixtures to a temp dir and runs the PowerShell emitter against a *second*
real asset, proving the emitter is not hardcoded to DevBrain. The Node replacement keeps that purpose
and drops the copying, which existed only to give the PowerShell script a writable working directory.

`spikes/03-second-asset/` already holds `land-rover-rigged.json` and `generated/land-rover-manual-part.svg`.
`emit.js` consumes a rigged.json object directly, so no model reconstruction is needed:

```
read land-rover-rigged.json + land-rover-manual-part.svg
  -> emitCss(rig) / emitAnimatedSvg(rig, manualSvg) / emitDemoHtml(rig, animatedSvg, "land-rover")
  -> write into fs.mkdtempSync(path.join(os.tmpdir(), "mf-lr-"))
  -> assert the outputs are real, not empty
  -> rm the temp dir
```

"Real, not empty" means: the CSS names every part id from the rigged.json and contains a keyframes
block; the animated SVG carries the part groups; the demo HTML is non-trivial. A row that only asserted
exit 0 would pass on an emitter that returned empty strings.

## The porting risk, and how it is actually managed

Re-expressing 620 lines of assertions in another language is precisely where a check quietly stops
checking. Reading the diff cannot detect that — a check that asserts nothing looks identical to a check
that asserts everything.

**Every ported checker therefore takes an optional target argument**, so it can be aimed at a *copy* of
the artifacts rather than only the committed ones:

- `check-flat-svg.mjs [flatSvgPath]` — the `.ps1` already had `-FlatPath`; keep the capability.
- `check-segmented.mjs [segmentedPath] [flatPath]`
- `check-buildable-slice.mjs [--root <dir>]`
- `check-orchestrator.mjs [--root <dir>]`

That enables the real verification: **a mutation matrix**. For each ported checker, the implementer
copies the artifacts to a temp dir, applies a specific mutation, points the checker at the copy, and
records that it fails with the expected message. Committed artifacts are never touched, so no golden can
move.

Each checker's mutation set is enumerated in the plan. Examples of the shape:

| Checker | Mutation | Must fail with |
|---|---|---|
| flat-svg | change `viewBox` to `0 0 191 192` | viewBox contract |
| flat-svg | add a `<path>` | zero-path rule |
| flat-svg | duplicate a `<g data-color>` | duplicate colour group |
| flat-svg | shrink one rect so coverage no longer reaches bounds | coverage extent |
| segmented | reorder two parts | fixed vocabulary order |
| segmented | delete one `<rect>` from a part | partRects ≠ flatRects |
| buildable-slice | drop a file from `generated/` | exact-set assertion |
| buildable-slice | create a root `package.json` | zero-dependency guard |
| buildable-slice | set `version: 3` in rigged.json | schema v2 lock |
| orchestrator | remove `export function createMascot` | required export |
| orchestrator | insert a `TODO` marker | leftover-marker scan |

A mutation that does *not* produce a failure means the assertion did not survive the port. This is the
acceptance criterion for the port, not "the gate still says PASS" — the gate saying PASS is exactly
what a checker with no teeth also produces.

### Two porting traps found in advance

1. **`check-buildable-slice.ps1` contains hardcoded Windows path literals** — `Join-Path $repoRoot
   "docs\buildable-slice"` and `"tools\emit-svg-css.ps1"`, plus an inverse `$ref -replace "/", "\"`.
   These work only because PowerShell accepts `\` as a separator on Windows. A naive port that keeps the
   string produces a filename containing a literal backslash on POSIX. Every path must be built with
   `path.join(root, "docs", "buildable-slice")` — separate segments, never an embedded separator.
2. **`rigged.json` carries an absolute author-machine `source.path`**
   (`C:\Users\dev\Dev\DevBrain\public\mascot\default.png`) which the current checker asserts
   exactly. That assertion is *already* wrong for any other contributor and would fail on a fresh clone
   elsewhere. It is out of scope to fix here (see Non-goals: this is a port), but the ported checker
   must preserve the behaviour and the plan must flag it as a follow-up — porting it silently would
   bake a machine-specific path into the new gate as though it were intended.

## Also in scope, small: MCP packaging hygiene

`mcp/package.json`'s `test` script chains four test files while the gate's P6 row runs six, omitting
`regions-preview` and `smiley-golden`.

Research into MCP server conventions found this is worse than a local inconvenience: **`.github/workflows/e2e.yml`
has its own `mcp` job that runs `cd mcp && npm ci && npm test`** — so CI itself runs the weak four-test
chain. And the omitted `smiley-golden.test.mjs` is precisely the test `mcp/README.md` cites as its proof
that the guided loop works end-to-end. Someone reading the README, running `npm test`, and seeing green
would be citing a test that did not execute.

Corrected in passing, which fixes the CI job for free since it just calls `npm test`:

```json
"test": "node tools.test.mjs && node server.test.mjs && node protocol.test.mjs && node vectorize-vtracer.test.mjs && node regions-preview.test.mjs && node smiley-golden.test.mjs"
```

Two more one-line additions from the same research, both conventions every published server follows and
neither carrying risk:

- `"engines": { "node": ">=20" }` — matches what CI already pins; nothing currently tells a fresh cloner.
- `"version": "0.1.0"` — absent entirely, while `server.mjs:17` hardcodes a version string for the
  protocol identity. Two sources of truth, one of them missing.

**Deliberately NOT in this stage** — reported for a separate decision, because each needs judgment rather
than transcription: per-tool `annotations` (`readOnlyHint`/`destructiveHint`, which influence host
auto-approval and so can be actively wrong), `outputSchema`/`structuredContent` adoption across all ten
tools, and a README note that `mcp/` imports from `../tools/*` and therefore cannot be copied out of the
repo standalone — the research's top fresh-clone trap.

## Acceptance

- `node tools/gate/check-all.mjs` prints the same per-row summary and exactly
  `RESULT: PASS (all pipeline checks green)`.
- `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` still works and prints the same.
- Every mutation in the matrix produces a failure in the ported checker, demonstrated and recorded.
- Fail-fast on the first non-zero row is preserved.
- The four `.ps1` checkers are gone, and every **live** reference to them is updated per the policy
  above — verified by a repo-wide grep whose only remaining hits are dated records.
- CONTRIBUTING.md no longer lists PowerShell as a prerequisite for the gate; its no-`npm install` claim
  is still accurate and still stated.
- **`.github/workflows/ci.yml`'s gate job runs green on `ubuntu-latest`.** This is the stage's binary
  acceptance test — everything else is means.
- `tools/gate/` contains no `package.json` and imports nothing outside `node:` builtins and
  `tools/rig-editor/` siblings.
- `cd mcp && npm test` runs all six MCP tests.
- `tools/emit-svg-css.ps1` carries a LEGACY header and still runs under `mf emit`.
- No root `package.json`. MCP tool count 10. Goldens byte-unchanged. `runtime/` and
  `tools/rig-editor/` still import nothing outside `node:` and siblings.
- `check-e2e.ps1` → 24 passed, unchanged.
- A fresh clone runs the gate in one command, with no install step of any kind.
