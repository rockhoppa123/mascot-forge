# Cross-Platform Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `node tools/gate/check-all.mjs` the canonical regression gate, running green on Linux CI, with no PowerShell and no dependencies — so an outside contributor can clone and verify the project with the toolchain they already have.

**Architecture:** Four PowerShell checkers are ported to zero-dependency ESM under `tools/gate/`, sharing a small `svg-scan.mjs` built on the product's own `topLevelGroups()` scanner. The one gate row that shelled out to a PowerShell *product* script is repointed at the equivalent Node emitter, which is what actually ships. `check-all.ps1` survives as a thin shim so every existing instruction keeps working.

**Tech Stack:** Pure ESM, zero dependencies, no build step, no test framework. `node:` builtins only.

**Spec:** [docs/superpowers/specs/2026-07-28-cross-platform-gate-design.md](../specs/2026-07-28-cross-platform-gate-design.md)

## Global Constraints

Each has broken this repo before.

- **NEVER create a root `package.json`.** The gate itself asserts its absence.
- **`tools/gate/` gets NO `package.json` and NO dependencies.** It may import `node:` builtins and siblings under `tools/rig-editor/` (which is itself zero-dependency). Nothing else. The gate is what asserts this repo has no dependencies; it cannot acquire any.
- **MCP tool count is locked at exactly 10** (`mcp/protocol.test.mjs`). This plan adds none.
- **`docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` are byte-for-byte goldens.** If one moves, STOP and report. Never regenerate to make a check pass. **Mutation testing in this plan always runs against a temp copy, never a committed file.**
- **This is a PORT.** Do not fix, improve, or extend any assertion. A check that is wrong stays wrong and is reported as a follow-up. A behaviour change hidden inside a translation diff is unreviewable.
- Tests use `node:assert/strict`, no framework.
- Commit bodies end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **Do not push.** Deleting tracked files is pre-approved **only** for the four files named in Task 6.

## Domain Orientation

`mascot-forge` turns artwork into a rigged, animated SVG mascot. The pipeline has numbered phases, and the gate has one row per phase:

- **P1 flat-svg** — a PNG becomes `devbrain-flat.svg`: colour-clustered `<rect>` geometry, one `<g data-color>` per colour.
- **P2 segmented** — that flat SVG is regrouped into named parts: `<g data-part="part-body">`.
- **P3 slice** — the "buildable slice": a hand-authored Manual Part SVG + `rigged.json` (schema v2) + emitted CSS/demo, plus the same suite re-run against `generated/` to prove the emitter reproduces the fixture.
- **P4 orchestrator** — `runtime/mascot-state.js` binds rig states to live data.
- **P5/P6/P7** — node test loops for the rig editor, the MCP server, and the React+GSAP target. Already Node; only their invocation moves.

## File Structure

| File | Change |
|---|---|
| `tools/gate/svg-scan.mjs` | Create — shared zero-dep element/attribute reader |
| `tools/gate/check-flat-svg.mjs` | Create — port of `tools/check-flat-svg.ps1` |
| `tools/gate/check-segmented.mjs` | Create — port of `tools/check-segmented.ps1` |
| `tools/gate/check-buildable-slice.mjs` | Create — port of `tools/check-buildable-slice.ps1` |
| `tools/gate/check-orchestrator.mjs` | Create — port of `tools/check-orchestrator.ps1` |
| `tools/gate/emit-land-rover.mjs` | Create — cross-asset emitter proof, replacing the `emit-svg-css.ps1` row |
| `tools/gate/check-all.mjs` | Create — canonical gate |
| `tools/check-all.ps1` | Modify — reduced to a shim |
| `tools/emit-svg-css.ps1` | Modify — LEGACY header only |
| `.github/workflows/ci.yml` | Modify — gate job to `ubuntu-latest`, stale step name |
| `.github/workflows/e2e.yml` | Modify — reconcile the `mcp` job |
| `mcp/package.json` | Modify — `test` script, `engines`, `version` |
| `CONTRIBUTING.md`, `README.md`, `docs/buildable-slice/README.md`, `docs/technical-proposal.md` | Modify — live references |
| `tools/check-flat-svg.ps1`, `tools/check-segmented.ps1`, `tools/check-buildable-slice.ps1`, `tools/check-orchestrator.ps1` | **Delete** (Task 6, pre-approved) |

## How port fidelity is proven

Reading a diff cannot tell a faithful port from a checker that asserts nothing — both print PASS. So:

1. **Every ported checker takes a target-path argument**, so it can be aimed at a copy.
2. **Every task ends with a mutation matrix run.** Copy the artifacts to a temp dir, break one thing, point the checker at the copy, record the failure message. A mutation that does not fail means that assertion did not survive the port.
3. **Task 5 runs both gates side by side** while the `.ps1` checkers still exist, and compares per-row outcomes. This is a free real equivalence test and is why deletion waits until Task 6.

---

### Task 1: `svg-scan.mjs` + port P1 flat-svg

**Files:**
- Create: `tools/gate/svg-scan.mjs`, `tools/gate/check-flat-svg.mjs`
- Read (source of truth for the port): `tools/check-flat-svg.ps1` (91 lines)

**Interfaces produced** (Tasks 2 and 3 depend on these exact names):
```js
export function rootTag(svgText): string            // the raw "<svg ...>" opening tag
export function attrOf(tagText, name): string|undefined
export function elements(svgText, tag): string[]    // raw tag text of every <tag ...>, any depth
export function countElements(svgText, tags: string[]): number
export { topLevelGroups }                            // re-exported from ../rig-editor/layer-ingest.js
```

- [ ] **Step 1: Write `svg-scan.mjs`**

```js
// svg-scan.mjs — the only "XML" facility the gate gets, and deliberately a small one.
//
// Zero-dependency by design, not by thrift: the gate is what ASSERTS this repo has no dependencies
// (check-buildable-slice guards the absence of a root package.json), so an assertor that itself needed
// `npm install` would undermine the claim it exists to defend.
//
// Group structure reuses topLevelGroups() from the product's own layer-ingest — pure ESM, node-tested,
// and hardened in the 2026-07-26 stage against comments and non-rendered subtrees. The checkers need
// only a few element-level reads on top of that.
import { topLevelGroups } from "../rig-editor/layer-ingest.js";

export function rootTag(svgText) {
  const m = svgText.match(/<svg\b[^>]*>/);
  if (!m) throw new Error("no <svg> root element found");
  return m[0];
}

export function attrOf(tagText, name) {
  const m = tagText.match(new RegExp(`\\b${name}="([^"]*)"`));
  return m ? m[1] : undefined;
}

// Raw tag text of every <tag …> at ANY depth, self-closing or not. Attribute values containing '>'
// would confuse this, exactly as they would the product's own tokenizer — the gate's inputs are
// generated by this repo and never contain one.
export function elements(svgText, tag) {
  return svgText.match(new RegExp(`<${tag}\\b[^>]*?\\/?>`, "g")) || [];
}

export function countElements(svgText, tags) {
  return tags.reduce((n, t) => n + elements(svgText, t).length, 0);
}

export { topLevelGroups };
```

- [ ] **Step 2: Confirm `topLevelGroups` suits flat.svg before porting against it**

```bash
node -e "import('./tools/gate/svg-scan.mjs').then(async (s)=>{const fs=await import('node:fs');const t=fs.readFileSync('docs/buildable-slice/generated/devbrain-flat.svg','utf8');const g=s.topLevelGroups(t);console.log('groups:',g.length,'first attrs:',JSON.stringify(g[0]&&g[0].attrs.slice(0,60)));console.log('rects in first:',s.elements(g[0].inner,'rect').length);})"
```

Expected: a group count matching the number of distinct colours, `attrs` containing `data-color`, and a non-zero rect count. **If the colour groups turn out not to be top-level, STOP and report** — the helper design needs revisiting before any assertion is ported onto it.

- [ ] **Step 3: Port the checker**

Write `tools/gate/check-flat-svg.mjs`. Signature: `node tools/gate/check-flat-svg.mjs [flatSvgPath]`, defaulting to `docs/buildable-slice/generated/devbrain-flat.svg`, resolved against the repo root when relative — mirroring the `.ps1`'s `-FlatPath` parameter.

Port **every** assertion below. Read `tools/check-flat-svg.ps1` for exact messages and keep them recognisable; a contributor who hits a failure should be able to find the old message in git history.

| # | Assertion | `.ps1` line |
|---|---|---|
| 1 | file exists | 23 |
| 2 | root element is `<svg>` | 33 |
| 3 | `viewBox === "0 0 192 192"` | 34 |
| 4 | `width === "192"`, `height === "192"` | 35-36 |
| 5 | `data-render-method === "quantized-color-rle"` | 37 |
| 6 | `data-source-bounds` matches `^\d+,\d+,\d+,\d+$` | 40 |
| 7 | bounds describe a non-empty box (`minX<maxX`, `minY<maxY`) | 43 |
| 8 | zero `<path>` | 46 |
| 9 | zero `<circle>`/`<ellipse>`/`<polygon>`/`<polyline>` | 47 |
| 10 | at least one colour group | 51 |
| 11 | every group's `data-color` matches `^#[0-9a-f]{6}$` (lowercase) | 58 |
| 12 | no duplicate colour group | 59 |
| 13 | every group has ≥1 `<rect>` | 63 |
| 14 | every rect's `fill` equals its group's colour | 65 |
| 15 | every rect has width ≥1 and height ≥1 | 68 |
| 16 | every rect lies inside `data-source-bounds` (note the `+1`: bounds are inclusive pixel indices) | 70 |
| 17 | geometry's top-left **reaches** the bounds origin | 80 |
| 18 | geometry's extent **reaches** the bounds extent (again `-1`) | 81 |
| 19 | rect total ≥ 1 | 85 |
| 20 | rect total < 2000 (proof greedy meshing collapsed runs) | 86 |

Exit 0 on success after printing the same three summary lines (`colours`, `rects`, `bounds`). Throw on failure, so a non-zero exit falls out of the uncaught exception — matching every other check in this repo.

- [ ] **Step 4: Run it against the real artifact**

```bash
node tools/gate/check-flat-svg.mjs
```

Expected: passes, and the `colours` / `rects` / `bounds` values are **identical** to what the PowerShell version prints:

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-flat-svg.ps1
```

Compare the three numbers explicitly and record both outputs. Differing numbers mean the port counts something different.

- [ ] **Step 5: POSIX-safety audit (cheap, and catches the Task 6 failure early)**

Every path this gate builds must work on Linux, but nothing runs on Linux until Task 6. Catch it now:

```bash
grep -n '\\\\' tools/gate/*.mjs
```

Expected: **no output**. Any backslash in a path literal is a bug — Node treats `"docs\\buildable-slice"` as a single filename on Linux. Build paths as separate `path.join(root, "docs", "buildable-slice")` segments.

Run this same audit at the end of every subsequent port task.

- [ ] **Step 6: Mutation matrix — the actual proof**

Copy the artifact to a temp dir, mutate the copy, aim the checker at it. **Never mutate the committed file.**

Write the driver to a **file** — not an inline `node -e`. The nested quoting in a one-liner does not survive Git Bash on Windows, and this is the step that must not fail for mechanical reasons.

Save as `<scratchpad>/mutate-flat-svg.mjs` (use the session scratchpad directory, not the repo — this is a verification tool, not gate surface, and must not be committed):

```js
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const REPO = "C:/Users/dev/Dev/mascot-forge";
const SRC = join(REPO, "docs/buildable-slice/generated/devbrain-flat.svg");
const CHECKER = join(REPO, "tools/gate/check-flat-svg.mjs");
const orig = readFileSync(SRC, "utf8");

// Each mutation must break exactly one assertion. If a row reports NO-TEETH, that assertion did not
// survive the port — the checker is weaker than the PowerShell it replaced.
const mutations = {
  viewBox:      (t) => t.replace('viewBox="0 0 192 192"', 'viewBox="0 0 191 192"'),
  renderMethod: (t) => t.replace("quantized-color-rle", "something-else"),
  addPath:      (t) => t.replace("</svg>", '<path d="M0 0 L1 1"/></svg>'),
  badFill:      (t) => t.replace(/fill="#[0-9a-f]{6}"/, 'fill="#ffffff"'),
  badBounds:    (t) => t.replace(/data-source-bounds="[^"]*"/, 'data-source-bounds="0,0,1,1"'),
  emptyBounds:  (t) => t.replace(/data-source-bounds="[^"]*"/, 'data-source-bounds="5,5,5,5"'),
  dupColour:    (t) => {
    const g = t.match(/<g data-color="(#[0-9a-f]{6})"[^>]*>/);
    return t.replace("</svg>", `${g[0]}<rect x="${0}" y="0" width="1" height="1" fill="${g[1]}"/></g></svg>`);
  },
};

const dir = mkdtempSync(join(tmpdir(), "mf-mut-"));
let noTeeth = 0;
for (const [name, fn] of Object.entries(mutations)) {
  const f = join(dir, `${name}.svg`);
  writeFileSync(f, fn(orig));
  try {
    execFileSync("node", [CHECKER, f], { stdio: "pipe" });
    console.log(`NO-TEETH  ${name}`);
    noTeeth++;
  } catch (e) {
    const msg = String(e.stderr || e.stdout).split("\n").find((l) => /failed|Error/.test(l)) || "";
    console.log(`caught    ${name}  ::  ${msg.trim().slice(0, 90)}`);
  }
}
rmSync(dir, { recursive: true, force: true });
console.log(noTeeth === 0 ? "ALL MUTATIONS CAUGHT" : `FAILED: ${noTeeth} assertion(s) did not survive the port`);
```

Run it:

```bash
node "<scratchpad>/mutate-flat-svg.mjs"
```

Expected final line: `ALL MUTATIONS CAUGHT`. Anything else means fix the checker before committing. **This file is the template Tasks 2, 3 and 4 reuse** — they copy it and swap `SRC`, `CHECKER`, and the `mutations` table. Keep it.

Record the complete output in your report.

- [ ] **Step 7: Commit**

```bash
git add tools/gate/svg-scan.mjs tools/gate/check-flat-svg.mjs
git commit -m "feat(gate): zero-dep svg-scan helper + port P1 flat-svg to Node"
```

Confirm `git status --short` shows only your two new files — no golden, no stray mutation artifact.

- [ ] **Step 8: Report back**

Your reviewer sees only what you write. Include: the Step 2 probe output; both Step 4 outputs side by side; the Step 5 audit result; the **complete** Step 6 mutation output ending in `ALL MUTATIONS CAUGHT`; `git status --short`; and the path where you saved the mutation driver, since later tasks reuse it.

---

### Task 2: Port P2 segmented

**Files:**
- Create: `tools/gate/check-segmented.mjs`
- Read: `tools/check-segmented.ps1` (71 lines)

**Interfaces consumed:** `svg-scan.mjs` from Task 1 — `rootTag`, `attrOf`, `elements`, `countElements`, `topLevelGroups`.

Signature: `node tools/gate/check-segmented.mjs [segmentedPath] [flatPath]`, defaulting to `docs/buildable-slice/generated/devbrain-segmented.svg` and `.../devbrain-flat.svg`.

- [ ] **Step 1: Port every assertion**

| # | Assertion | `.ps1` line |
|---|---|---|
| 1 | both files exist (segmented, and flat as coverage baseline) | 21-22 |
| 2 | root is `<svg>`; `viewBox === "0 0 192 192"` | 28-29 |
| 3 | `data-render-method === "ccl-color-threshold"` | 30 |
| 4 | ≥1 `<g data-part>` | 35 |
| 5 | every `data-part` is in the vocabulary `part-body, part-leg-left, part-leg-right, part-antenna, part-eyes, part-moustache` | 41 |
| 6 | no duplicate part | 42 |
| 7 | every part has `data-pivot` matching `^-?\d+(\.\d+)?,-?\d+(\.\d+)?$` | 47 |
| 8 | every pivot lies within 0..192 on both axes | 50 |
| 9 | every part has ≥1 `<rect>` | 53 |
| 10 | parts appear in **fixed vocabulary order**, not document or hash order | 58 |
| 11 | `part-body` is present | 61 |
| 12 | part rect count **exactly equals** flat.svg's total rect count | 67 |

Assertion 10 is the subtle one: the expected order is the vocabulary filtered to the parts actually present, compared as a joined string. Assertion 12 is the cross-file invariant that makes this check worth having — it proves segmentation regrouped all geometry without losing or inventing any.

Print the same two summary lines (`parts` with the ordered list, `rects`).

- [ ] **Step 2: Run and compare against the PowerShell output**

```bash
node tools/gate/check-segmented.mjs
```
```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-segmented.ps1
```

Expected: both pass; the part list, its **order**, and the rect count match exactly. Record both.

- [ ] **Step 3: POSIX-safety audit**

```bash
grep -n '\\' tools/gate/*.mjs
```

Expected: no output.

- [ ] **Step 4: Mutation matrix**

Copy Task 1's driver (its path is in the Task 1 report) to `<scratchpad>/mutate-segmented.mjs`, then change `SRC`, `CHECKER`, and the `mutations` table. This checker reads **two** files, so the driver must write both into the temp dir and pass both paths:
`execFileSync("node", [CHECKER, mutatedSegmented, flatCopy])`.

Required mutations, each of which MUST fail:

| Mutation | Guards assertion |
|---|---|
| change `viewBox` to `0 0 192 191` | 2 |
| change `data-render-method` to anything else | 3 |
| rename one `data-part` to `part-nonsense` | 5 |
| duplicate a part group | 6 |
| change a `data-pivot` to `999,999` | 8 |
| change a `data-pivot` to `abc` | 7 |
| **swap two part groups' document order** | 10 |
| delete one `<rect>` from a part | 12 |
| add one `<rect>` to a part | 12 |
| remove the `part-body` group | 11 |

The order swap is the one most likely to be lost in translation, because a naive port that collects parts into an object and compares sets will pass it. Verify that one deliberately.

Expected final line: `ALL MUTATIONS CAUGHT`.

- [ ] **Step 5: Commit**

```bash
git add tools/gate/check-segmented.mjs
git commit -m "feat(gate): port P2 segmented to Node"
```

Confirm `git status --short` shows only your new file.

- [ ] **Step 6: Report back**

Both Step 2 outputs, the Step 3 audit, the complete mutation output ending in `ALL MUTATIONS CAUGHT`, explicit confirmation the order-swap mutation was caught, and `git status --short`.

---

### Task 3: Port P3 buildable-slice

This is the largest checker (376 lines) and the one guarding the most contracts. Budget accordingly.

**Files:**
- Create: `tools/gate/check-buildable-slice.mjs`
- Read: `tools/check-buildable-slice.ps1`

**Interfaces consumed:** `svg-scan.mjs` from Task 1.

Signature: `node tools/gate/check-buildable-slice.mjs [--root <dir>]`, defaulting to the repo root. `--root` is what lets the mutation matrix aim at a copied tree.

- [ ] **Step 1: Read the source and write down its structure before porting**

Do not port linearly. First list the check groups in your report:

1. Required files/dirs exist.
2. `generated/` contains **exactly** a fixed set of 6 filenames — no extras, no missing.
3. **No root `package.json`** (the zero-dependency guard).
4. Manual Part SVG structure: `id="mascot"`, viewBox, `data-state="idle"`, `data-render-method="source-pixel-rle"`, exact `data-source-bounds="21,77,170,177"`, an `#rig-root` node, zero `<path>`, >100 rects, and part-specific rect-count sanity.
5. Every semantic part id carries `class="part"` plus `data-origin` / `data-pivot-x` / `data-pivot-y`.
6. `rigged.json` schema v2: `version === 2`, `source.kind`, `source.path`, `source.metadata`, states sequence, bones declared before referenced, parts↔bones↔SVG cross-references, exactly 6 animation recipes with required v1 fields, then v2 fields (`ease`, `repeat`, `yoyo`, `channels`, `reducedChannel`) with channel-offset monotonicity and `[0,1]` endpoints.
7. CSS content: `transform-box: fill-box`, reduced-motion media query, per-part selectors/origins/keyframes reproduced from `rigged.json`.
8. Demo HTML content: query-param reading, reduced-motion support, per-state buttons.
9. **The same suite again against `generated/`** — this is what proves the emitter reproduces the fixture.
10. `showcase.html` reference integrity: every `generated*/….svg|css` path it fetches exists on disk.

**Port the ten groups in four sub-steps, running `node tools/gate/check-buildable-slice.mjs` after each.** Do not write all 376 lines and then debug the whole thing — a failure in group 9 is unfindable in a 400-line first run.

- [ ] **Step 2a: Groups 1-3** — file/dir existence, the exact-6 `generated/` set, no root `package.json`. Run it; the checker should now pass on those three and do nothing else.
- [ ] **Step 2b: Groups 4-5** — Manual Part SVG structure and per-part attributes. Run it.
- [ ] **Step 2c: Group 6** — the whole `rigged.json` schema-v2 block. This is the largest single group; do it alone. Run it.
- [ ] **Step 2d: Groups 7-10** — CSS content, demo HTML content, the repeat suite against `generated/`, showcase reference integrity. Run it.

Group 9 deserves care: it re-runs the same assertions against a second directory. Factor it as a function taking a directory rather than copy-pasting the block, or the two copies will drift exactly as the two emitters did.

- [ ] **Step 3: Honour the two known traps**

**Trap 1 — Windows path literals.** The source contains `Join-Path $repoRoot "docs\buildable-slice"` (line 74), `"tools\emit-svg-css.ps1"` (line 85), and an inverse `$ref -replace "/", "\"` (line 373). These work only because PowerShell accepts `\` as a separator on Windows. Build **every** path as separate segments — `path.join(root, "docs", "buildable-slice")` — never with an embedded separator. A string like `"docs\\buildable-slice"` in Node is a single filename containing a backslash on Linux, and this task's whole point is that it runs on Linux.

**Trap 2 — the absolute author-machine path.** The checker asserts `source.path` equals exactly
`C:\Users\dev\Dev\DevBrain\public\mascot\default.png`. That assertion **already cannot pass on anyone else's clone**. Port it **verbatim anyway** — this is a port, and silently relaxing it would hide a behaviour change inside a translation diff. Then flag it prominently in your report as a follow-up. Do not fix it here.

Note also that line 85 references `tools/emit-svg-css.ps1`; check whether that is an existence assertion. If it is, it must survive — the script still exists after this plan (it is marked legacy in Task 5, not deleted).

- [ ] **Step 4: Run and compare**

```bash
node tools/gate/check-buildable-slice.mjs
```
```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-buildable-slice.ps1
```

Expected: both pass, with matching summary output. Record both.

- [ ] **Step 5: POSIX-safety audit**

```bash
grep -n '\\' tools/gate/*.mjs
```

Expected: no output. This checker is where Trap 1 lives, so this audit matters most here.

- [ ] **Step 6: Mutation matrix against a copied tree**

Copy Task 1's driver to `<scratchpad>/mutate-slice.mjs`. Instead of mutating a single file, it copies the subtree the checker reads (`fs.cpSync(src, dest, { recursive: true })`), applies one mutation inside the copy, and runs `execFileSync("node", [CHECKER, "--root", copyRoot])`.

Every row below MUST fail. **There is no escape hatch here** — this checker guards more contracts than the other three combined, and an unproven row is an unguarded contract. If the copy is awkward to assemble, solve it; if you genuinely cannot, report BLOCKED rather than skipping rows.

| Mutation | Guards |
|---|---|
| delete one file from `generated/` | exact-set (2) |
| add a stray file to `generated/` | exact-set (2) |
| create a root `package.json` in the copied tree | zero-dep guard (3) |
| change the Manual Part SVG's `data-source-bounds` | (4) |
| add a `<path>` to the Manual Part SVG | (4) |
| remove `class="part"` from one part group | (5) |
| set `"version": 3` in `rigged.json` | schema lock (6) |
| delete one animation recipe (leaving 5) | recipe count (6) |
| set a channel offset outside `[0,1]` | channel bounds (6) |
| make channel offsets non-monotonic | monotonicity (6) |
| remove `transform-box: fill-box` from the CSS | (7) |
| remove the reduced-motion media query | (7) |
| point a `showcase.html` reference at a missing file | (10) |

Expected final line: `ALL MUTATIONS CAUGHT`.

- [ ] **Step 7: Verify no committed file moved**

```bash
git status --short
```

Expected: only your new file. If any golden appears, **STOP and report** — a mutation escaped the temp dir.

- [ ] **Step 8: Commit**

```bash
git add tools/gate/check-buildable-slice.mjs
git commit -m "feat(gate): port P3 buildable-slice to Node"
```

- [ ] **Step 9: Report back**

The Step 1 structure list, both Step 4 outputs, the Step 5 audit, the complete Step 6 mutation output ending in `ALL MUTATIONS CAUGHT`, `git status --short`, and the Trap 2 follow-up flagged explicitly. Also state how you factored group 9 — the repeated suite — since that is where drift would hide.

---

### Task 4: Port P4 orchestrator + the land-rover cross-asset proof

**Files:**
- Create: `tools/gate/check-orchestrator.mjs`, `tools/gate/emit-land-rover.mjs`
- Read: `tools/check-orchestrator.ps1` (80 lines), `tools/rig-editor/emit.js`

**Interfaces consumed:** nothing from Tasks 1-3 — this checker reads JS/JSON/HTML as text, not SVG structure.

#### 4a — `check-orchestrator.mjs`

Signature: `node tools/gate/check-orchestrator.mjs [--root <dir>]`.

- [ ] **Step 1: Port every assertion**

| # | Assertion | `.ps1` line |
|---|---|---|
| 1 | 5 required files exist: `runtime/mascot-state.js`, its `.test.mjs`, the orchestrator demo HTML, the React hook `.ts`, `rigged.json` | 29-31 |
| 2 | core contains each of: `export function createMascot`, `setState`, `bind`, `getState`, `destroy`, `export function pollJson`, `export function fromEvents` | 35-38 |
| 3 | core contains `dataset.state` | 39 |
| 4 | `rigged.json` declares ≥1 state | 44 |
| 5 | demo imports `../../runtime/mascot-state.js`, calls `createMascot`, references `devbrain-svg-css.generated.svg`, calls `.bind(` | 48-51 |
| 6 | demo contains the states array literal **built from `rigged.json`** — `["idle", "active", "alert"]` formatted exactly as `[" + '"' + join('", "') + '"' + "]` | 52-53 |
| 7 | hook contains `useMascotState` and `runtime/mascot-state.js` | 57-58 |
| 8 | no root `package.json` | 61 |
| 9 | none of core/test/demo/hook contains `TODO`, `TBD`, or `FIXME` | 64-69 |
| 10 | `node <runtime test>` exits 0 **and** its stdout contains `all assertions passed` | 72-76 |

Assertion 10 becomes `spawnSync("node", [testPath], { encoding: "utf8" })` — check `.status === 0` and `.stdout.includes(...)`. This is the one assertion that gets *simpler* in Node.

Assertion 6's literal is derived from `rigged.json` at runtime, not hardcoded — keep it that way, it is what ties the demo to the rig.

- [ ] **Step 2: Run and compare**

```bash
node tools/gate/check-orchestrator.mjs
```
```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-orchestrator.ps1
```

Both pass, same summary. Record both.

- [ ] **Step 3: Mutation matrix** (temp copy + `--root`)

Copy Task 1's driver to `<scratchpad>/mutate-orchestrator.mjs`; it copies the files the checker reads into a temp root and runs `execFileSync("node", [CHECKER, "--root", copyRoot])`. Expected final line: `ALL MUTATIONS CAUGHT`.

| Mutation | Guards |
|---|---|
| remove `export function createMascot` from the core copy | 2 |
| remove `dataset.state` | 3 |
| insert `// TODO` into the core copy | 9 |
| change the demo's states literal to `["idle"]` | 6 |
| break the demo's `createMascot` reference | 5 |
| create a root `package.json` in the copy | 8 |
| point the runtime-test path at a script that exits 1 | 10 |

#### 4b — `emit-land-rover.mjs`

Replaces the `P3 land-rover-emit` row, which today copies three fixtures to a temp dir and shells out to `tools/emit-svg-css.ps1`. Its purpose is a **cross-asset proof**: the emitter is not hardcoded to DevBrain. That purpose is preserved; the emitter changes to the one that actually ships.

- [ ] **Step 4: Confirm the inputs exist and the emitter accepts them**

```bash
node -e "const fs=require('node:fs');const r=JSON.parse(fs.readFileSync('spikes/03-second-asset/land-rover-rigged.json','utf8'));console.log('states:',r.states,'parts:',(r.parts||[]).map(p=>p.id));console.log('manual svg bytes:',fs.statSync('spikes/03-second-asset/generated/land-rover-manual-part.svg').size)"
```

If either path is wrong, find the real one before writing the script — do not guess. Report what you found.

- [ ] **Step 5: Write it**

```js
// emit-land-rover.mjs — cross-asset proof: the SVG+CSS emitter is not hardcoded to DevBrain.
//
// Replaces the old gate row that shelled out to tools/emit-svg-css.ps1. That PowerShell script is a
// SECOND implementation of this same target, kept for `mf emit`; tools/rig-editor/emit.js is the one
// the MCP and the browser editor actually ship. The gate should prove the emitter that ships.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { emitCss, emitAnimatedSvg, emitDemoHtml } from "../rig-editor/emit.js";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const base = join(root, "spikes", "03-second-asset");
const rig = JSON.parse(readFileSync(join(base, "land-rover-rigged.json"), "utf8"));
const manualSvg = readFileSync(join(base, "generated", "land-rover-manual-part.svg"), "utf8");

const css = emitCss(rig);
const animated = emitAnimatedSvg(rig, manualSvg);
const demo = emitDemoHtml(rig, animated, "land-rover");

// Assert the output is REAL, not merely produced. A row that only checked the exit code would pass on
// an emitter that returned empty strings — which is exactly how a silently-broken emitter ships.
const partIds = rig.parts.map((p) => p.id);
for (const id of partIds) {
  if (!css.includes(id)) throw new Error(`land-rover emit: CSS is missing part '${id}'`);
  if (!animated.includes(id)) throw new Error(`land-rover emit: animated SVG is missing part '${id}'`);
}
if (!/@keyframes/.test(css)) throw new Error("land-rover emit: CSS contains no @keyframes");
if (demo.length < 500) throw new Error(`land-rover emit: demo HTML is implausibly small (${demo.length} bytes)`);

// Write to a temp dir so the emit path is exercised end to end, then discard — the gate must leave no
// artifact behind, and nothing here is a golden.
const out = mkdtempSync(join(tmpdir(), "mf-lr-"));
try {
  writeFileSync(join(out, "land-rover-svg-css.generated.css"), css);
  writeFileSync(join(out, "land-rover-svg-css.generated.svg"), animated);
  writeFileSync(join(out, "land-rover-svg-css.generated-demo.html"), demo);
  console.log(`land-rover cross-asset emit passed. parts: ${partIds.length}, css: ${css.length}b, svg: ${animated.length}b`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
```

Adjust the `rig.parts` access if Step 4 showed a different shape. Do not invent a shape.

- [ ] **Step 6: Verify it has teeth**

Temporarily make `emitCss` return `""` (edit, run, revert), and confirm the script fails. Record the message. A cross-asset proof that cannot fail is decoration.

- [ ] **Step 7: POSIX-safety audit, then run both**

```bash
grep -n '\\' tools/gate/*.mjs
```

Expected: no output.

```bash
node tools/gate/check-orchestrator.mjs && node tools/gate/emit-land-rover.mjs
```
```bash
git add tools/gate/check-orchestrator.mjs tools/gate/emit-land-rover.mjs
git commit -m "feat(gate): port P4 orchestrator; cross-asset emit proof via the shipping emitter"
```

- [ ] **Step 8: Report back**

Step 4's probe output, both Step 2 outputs, the orchestrator mutation matrix ending in `ALL MUTATIONS CAUGHT`, the Step 6 teeth evidence with its actual message, the Step 7 audit, and `git status --short` showing only your two new files.

---

### Task 5: `check-all.mjs`, the shim, and the two-gate equivalence check

**Files:**
- Create: `tools/gate/check-all.mjs`
- Modify: `tools/check-all.ps1`, `tools/emit-svg-css.ps1`

**Interfaces consumed:** all five scripts from Tasks 1-4.

- [ ] **Step 1: Write `check-all.mjs`**

Mirror `tools/check-all.ps1`'s existing shape — an ordered array of `{ name, run }`, fail-fast on the first non-zero, then a ✅/❌ summary. Rows, in this order:

| Row name | Runs |
|---|---|
| `P1 flat-svg` | `tools/gate/check-flat-svg.mjs` |
| `P2 segmented` | `tools/gate/check-segmented.mjs` |
| `P3 slice` | `tools/gate/check-buildable-slice.mjs` |
| `P3 land-rover-emit` | `tools/gate/emit-land-rover.mjs` |
| `P4 orchestrator` | `tools/gate/check-orchestrator.mjs` |
| `P4 determinism` | `runtime/mascot-state.test.mjs` |
| `P5 rig-editor` | each of `model, loader, pivot, presets, validator, exporter, select, vectorize, segment, segment-quality, path-bbox, layer-ingest, emit, grade` under `tools/rig-editor/` |
| `P6 mcp` | each of `tools, server, protocol, vectorize-vtracer, regions-preview, smiley-golden` under `mcp/` |
| `P7 react-gsap` | each of `emit-react, cross-target-pivot` under `tools/emit-react-gsap/` |

Copy those file lists from `tools/check-all.ps1` lines 36, 45 and 54 rather than retyping them — a dropped entry is a silently weakened gate.

Every row is `spawnSync("node", [absolutePath], { stdio: "inherit" })`; a row fails when `status !== 0`.

**The output must be byte-identical to the PowerShell gate's**, because docs, CI, and this repo's ledger all assert on it:

```
--- <row name> ---        (per row, before running it)

==== check-all summary ====
  ✅ <row name>
  ...
RESULT: PASS (all pipeline checks green)
  (browser e2e is separate, by design: pwsh -NoProfile -File tools/check-e2e.ps1)
```

and on failure, `RESULT: FAIL` with exit 1. Note the summary uses ✅ / ❌.

- [ ] **Step 2: Reduce `check-all.ps1` to a shim**

Replace its whole body. It must forward the exit code, so `mf.ps1 check` and any CI still using it keep behaving correctly:

```powershell
# check-all.ps1 — thin shim. The gate itself is now Node and cross-platform:
#   node tools/gate/check-all.mjs
# This wrapper stays because `mf.ps1 check`, CONTRIBUTING, and existing muscle memory all invoke it,
# and because its exact "RESULT: PASS" output is asserted by docs and CI. It adds nothing but a forward.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
& node (Join-Path $repoRoot "tools/gate/check-all.mjs")
exit $LASTEXITCODE
```

- [ ] **Step 3: Mark `emit-svg-css.ps1` legacy**

Prepend a header matching the wording style already used by `tools/vectorize-pixel.ps1` and `tools/segment-parts.ps1` (read one of them first and match its voice). It must say: this is the legacy/batch-only PowerShell emitter kept for the `mf emit` path; the canonical emitter is `tools/rig-editor/emit.js`, which is what the MCP, the browser editor, and the gate use; do not add features here — change `emit.js` and mirror if needed.

Change nothing else in the file.

- [ ] **Step 4: THE EQUIVALENCE CHECK — run both gates**

This is the step that makes deleting the `.ps1` checkers safe in Task 6, and it is only possible right now, while both exist.

Run the new gate:

```bash
node tools/gate/check-all.mjs
```

Then run the **old** gate — the pre-shim version, which still drives the four `.ps1` checkers. Recover it from `HEAD` (your shim edit is not committed yet, so `HEAD` still holds the original) and write it **into `tools/`**, not a temp dir, because it resolves its siblings via `$PSScriptRoot`:

```bash
git show HEAD:tools/check-all.ps1 > tools/_old-check-all.ps1 && pwsh -NoProfile -ExecutionPolicy Bypass -File tools/_old-check-all.ps1; rm tools/_old-check-all.ps1
```

The `rm` runs regardless — do not leave that file behind, and do not commit it.

Both must print `RESULT: PASS` and the **same ✅ rows in the same order**. Put the two summaries side by side in your report. If any row differs, STOP — that is a port defect, not a formatting difference.

- [ ] **Step 5: Confirm the gate needs no PowerShell**

```bash
grep -rn "pwsh\|powershell\|\.ps1" tools/gate/
```

Expected: **no output**. If anything matches, the gate has not actually crossed the platform line.

- [ ] **Step 6: Commit**

```bash
git add tools/gate/check-all.mjs tools/check-all.ps1 tools/emit-svg-css.ps1
git commit -m "feat(gate): Node check-all becomes canonical; ps1 reduced to a shim"
```

- [ ] **Step 7: Report back**

Both gate summaries side by side (this is the equivalence evidence — the reviewer cannot reconstruct it later, because Task 6 deletes one of the two gates), the Step 5 grep result, the legacy header you wrote, and `git status --short` confirming no stray `_old-check-all.ps1` survived.

---

### Task 6: CI to Linux, docs, MCP hygiene, and the deletions

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/workflows/e2e.yml`, `mcp/package.json`, `CONTRIBUTING.md`, `README.md`, `docs/buildable-slice/README.md`, `docs/technical-proposal.md`
- **Delete:** `tools/check-flat-svg.ps1`, `tools/check-segmented.ps1`, `tools/check-buildable-slice.ps1`, `tools/check-orchestrator.ps1` *(pre-approved by the owner — these four only)*

- [ ] **Step 1: Move the gate job to Linux**

`.github/workflows/ci.yml` currently runs on `windows-latest`, justified by this comment:

> The full pipeline gate includes vectorize-pixel.ps1, which uses System.Drawing (Windows-only), so the gate runs on windows-latest

**That justification is false** — `tools/check-all.ps1` has zero references to `vectorize-pixel.ps1`, which is reachable only via `mf forge`. Verify for yourself before editing:

```bash
grep -c "vectorize-pixel" tools/check-all.ps1
```

Rewrite the job to run on `ubuntu-latest`, invoking `node tools/gate/check-all.mjs` directly (no `shell: pwsh`). Also fix the stale step name — it says "Full pipeline gate (P1–P5)" and has been P1–P7 since the react-gsap work.

Add a **second job** on `windows-latest` that runs the same gate through `pwsh ./tools/check-all.ps1`, so the shim and the Windows path stay covered. Name the jobs so the distinction is obvious (e.g. `gate-linux`, `gate-windows-shim`).

Replace the false comment with what is actually true: the gate is pure Node; PowerShell is needed only for `mf.ps1`'s batch path.

- [ ] **Step 2: Fix `mcp/package.json`**

Three edits. The `test` script currently chains 4 of the 6 tests the gate runs — and `.github/workflows/e2e.yml`'s `mcp` job runs `npm test`, so **CI has been running the weaker chain**, skipping `smiley-golden.test.mjs`, the very test `mcp/README.md` cites as its end-to-end proof.

```json
"test": "node tools.test.mjs && node server.test.mjs && node protocol.test.mjs && node vectorize-vtracer.test.mjs && node regions-preview.test.mjs && node smiley-golden.test.mjs"
```

Also add `"version": "0.1.0"` (absent, while `server.mjs:17` hardcodes a version for the protocol identity — two sources of truth, one missing) and `"engines": { "node": ">=20" }` (matching what CI pins; nothing currently tells a fresh cloner).

Verify:

```bash
cd mcp && npm test
```

Expected: six test files run, all pass.

- [ ] **Step 3: Reconcile `e2e.yml`'s `mcp` job**

With Step 2 done, that job's `npm test` now runs the full six. Confirm it is not simply a weaker duplicate of `ci.yml`'s gate — it runs on Ubuntu where `ci.yml` ran on Windows, which *was* its only real value. Now that the gate itself runs on Linux, decide and state your reasoning in the report: keep it as a fast MCP-only signal, or drop it as redundant. Either is defensible; an unexplained choice is not.

- [ ] **Step 4: Update the live documentation**

Per the spec's policy — update instructions, leave dated records alone.

**Update:**
- `CONTRIBUTING.md` line 7: PowerShell drops from a prerequisite to optional, needed only for `mf.ps1`'s batch path. The gate is Node. Line 12's "no `npm install` and no build step" claim **stays** — it is still true and worth keeping.
- `CONTRIBUTING.md` line 40: the gate command becomes `node tools/gate/check-all.mjs`.
- `README.md` line 149: the tree listing names the four deleted scripts.
- `docs/buildable-slice/README.md` lines 85 and 102 — prose plus a literal run-this command.
- `docs/technical-proposal.md` line 216.

**Leave untouched** (dated records of what was true when written): everything under `docs/plans/`, `docs/research/`, `docs/superpowers/plans/`, `.superpowers/`, and `docs/adr/0008-*.md`.

- [ ] **Step 5: RUN THE GATE ON LINUX — the stage's acceptance test**

This is the one step that actually proves the stage did what it set out to do. Everything else is means.
CI cannot verify it here (we are not pushing), but **WSL Ubuntu-24.04 is available on this machine**, so
it can be proven locally before anything is deleted.

```bash
wsl -d Ubuntu-24.04 -- bash -lc "cd /mnt/c/Users/dev/Dev/mascot-forge && node --version && node tools/gate/check-all.mjs"
```

Expected: `RESULT: PASS (all pipeline checks green)`.

Three things to watch, each a real possibility rather than a formality:

- **`node` may not be installed in WSL.** If `node --version` fails, say so in your report and state
  plainly that the Linux proof did not run — do not substitute the Windows result and call it Linux.
  Installing Node inside WSL is acceptable if straightforward; report that you did.
- **Path-separator bugs surface here and nowhere else.** A `"docsuildable-slice"` literal that the
  POSIX audits missed fails here with a confusing ENOENT. That is the audit working late, not a new bug.
- **Line endings.** The repo is checked out with CRLF on Windows. If a checker does exact string
  matching against file content, CRLF-vs-LF can produce a Linux-only failure. If that happens, report it
  — it is a genuine port defect and a genuine cross-platform defect, and it is exactly the class of thing
  this stage exists to find.

If this step fails, **stop and fix before proceeding to deletion.** Do not delete the reference
implementation while the replacement is unproven on the platform it was written for.

- [ ] **Step 6: Delete the four ported checkers**

```bash
git rm tools/check-flat-svg.ps1 tools/check-segmented.ps1 tools/check-buildable-slice.ps1 tools/check-orchestrator.ps1
```

These four only. `emit-svg-css.ps1`, `vectorize-pixel.ps1`, `segment-parts.ps1`, `mf.ps1`, `serve.ps1` and `check-e2e.ps1` all stay.

- [ ] **Step 7: Confirm no live reference survives**

```bash
grep -rn "check-flat-svg\|check-segmented\|check-buildable-slice\|check-orchestrator" --include=*.md --include=*.ps1 --include=*.yml . | grep -v node_modules | grep -v "docs/plans/\|docs/research/\|docs/superpowers/\|.superpowers/\|docs/adr/"
```

Expected: **no output**. Any hit is a live instruction pointing at a deleted file.

- [ ] **Step 8: Full verification**

```bash
node tools/gate/check-all.mjs
```
```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
```
```bash
pwsh -NoProfile -File tools/check-e2e.ps1
```

Expected: gate `RESULT: PASS` from both entry points; e2e **24 passed**, unchanged by this plan.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(gate): CI gate runs on Linux; retire the four PowerShell checkers"
```

- [ ] **Step 10: Report back**

The Step 1 grep proving the CI justification was false; `npm test` output showing six files; your Step 3 decision and reasoning; **the complete Step 5 WSL output including `node --version`** — this is the stage's acceptance evidence and must be quoted verbatim, not summarised; the Step 7 grep (empty); and all three Step 8 results.

---

## Acceptance

- `node tools/gate/check-all.mjs` → `RESULT: PASS (all pipeline checks green)`, no PowerShell involved.
- `pwsh tools/check-all.ps1` → identical output via the shim; `mf.ps1 check` still works.
- **The gate runs green on Linux**, proven locally via WSL Ubuntu-24.04 before merge (Task 6 Step 5), with `ci.yml`'s job moved to `ubuntu-latest` so the same proof runs on every future push. If the WSL run did not happen, the stage is not done — say so rather than inferring it from the Windows result.
- Every mutation in every matrix produced a failure, recorded per task.
- `tools/gate/` has no `package.json` and imports only `node:` builtins and `tools/rig-editor/` siblings.
- The four `.ps1` checkers are gone; no live reference remains; dated records untouched.
- `cd mcp && npm test` runs all six MCP tests.
- Goldens byte-unchanged. No root `package.json`. MCP tool count 10. e2e 24 passed.
- Follow-ups reported, not silently fixed: the absolute `source.path` assertion, and anything else the port surfaced.
