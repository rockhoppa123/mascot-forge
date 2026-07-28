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
2. **`@xmldom/xmldom` + `xpath` under `tools/gate/`.** A real DOM with real XPath, so ported assertions
   map close to 1:1 from the PowerShell and are less likely to change meaning in translation. The
   package.json lives in `tools/gate/`, never at the root — `check-buildable-slice`'s own no-root-
   `package.json` guard must keep passing. Accepted cost: the gate needs an install step; mitigated
   below.
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
tools/gate/
  package.json               deps: @xmldom/xmldom, xpath. NOT at repo root.
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

### The install step, mitigated

`check-all.mjs` checks for `tools/gate/node_modules` and runs `npm install` there if absent — the same
pattern `check-e2e.ps1` already uses for `tests/`. A fresh clone therefore still runs one command. This
is the accepted cost of decision 2 and should be stated plainly in CONTRIBUTING.md, not hidden.

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

### CONTRIBUTING.md: one claim becomes false

Line 12 currently reads *"No `npm install` and no build step are needed to run the core pipeline or the
gate."* Decision 2 falsifies the gate half of that sentence — `tools/gate/` has dependencies. The
auto-install removes the *friction* but not the *fact*.

The sentence must be corrected, not quietly left standing: the core pipeline still needs no install; the
gate now installs its own dev dependencies on first run. Line 7 ("the pipeline tools are PowerShell")
also needs softening, since the gate no longer is.

Getting this wrong is precisely the failure mode this repo keeps hitting — a doc asserting something the
code stopped doing.

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
   (`C:\Users\student1\Dev\DevBrain\public\mascot\default.png`) which the current checker asserts
   exactly. That assertion is *already* wrong for any other contributor and would fail on a fresh clone
   elsewhere. It is out of scope to fix here (see Non-goals: this is a port), but the ported checker
   must preserve the behaviour and the plan must flag it as a follow-up — porting it silently would
   bake a machine-specific path into the new gate as though it were intended.

## Also in scope, small

`mcp/package.json`'s `test` script chains four test files while the gate's P6 row runs six — it is
missing `regions-preview` and `smiley-golden`, so `npm test` inside `mcp/` is weaker than the gate and
anyone trusting it is under-testing. Corrected in passing.

Research into MCP server conventions is running separately; any further recommendations from it are
reported for a decision rather than folded in silently, so this stage stays a gate port.

## Acceptance

- `node tools/gate/check-all.mjs` prints the same per-row summary and exactly
  `RESULT: PASS (all pipeline checks green)`.
- `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` still works and prints the same.
- Every mutation in the matrix produces a failure in the ported checker, demonstrated and recorded.
- Fail-fast on the first non-zero row is preserved.
- The four `.ps1` checkers are gone, and every **live** reference to them is updated per the policy
  above — verified by a repo-wide grep whose only remaining hits are dated records.
- CONTRIBUTING.md no longer claims the gate needs no `npm install`.
- `tools/emit-svg-css.ps1` carries a LEGACY header and still runs under `mf emit`.
- No root `package.json`. MCP tool count 10. Goldens byte-unchanged. `runtime/` and
  `tools/rig-editor/` still import nothing outside `node:` and siblings.
- `check-e2e.ps1` → 24 passed, unchanged.
- A fresh clone with no `tools/gate/node_modules` runs the gate successfully in one command.
