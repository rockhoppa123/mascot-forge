# React+GSAP Output Target — MCP-Reachable & Tested Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make React+GSAP a first-class, gate-tested Output Target reachable from the MCP agent path, and prove for the first time that it and SVG+CSS rotate every part around the identical absolute point.

**Architecture:** Extract the existing TypeScript emitter's logic into a pure ESM core (`tools/emit-react-gsap/emit-react.mjs`) that takes a rig + SVG in memory and returns generated file contents as strings. The existing TS CLI becomes a thin wrapper over that core, and `mcp/tools.mjs` imports it directly — the same way it already imports `tools/rig-editor/*.js`. This mirrors `tools/rig-editor/emit.js`, which is already shared between the live preview and the export so the two cannot drift.

**Tech Stack:** Node ESM (no build step), `node:assert/strict` (no test framework), PowerShell gate scripts, TypeScript only in the unchanged CLI wrapper.

**Design spec:** [`docs/superpowers/specs/2026-07-25-react-gsap-mcp-target-design.md`](../specs/2026-07-25-react-gsap-mcp-target-design.md)

## Global Constraints

_Every task's requirements implicitly include these._

- **No new dependency anywhere.** The core must import nothing beyond `node:*`. React/GSAP/Vite stay dependencies of the demo app only.
- **The runtime and browser editor stay ZERO-dependency, pure ESM, NO build step.**
- **MCP tool count is a locked contract at 10** (`mcp/protocol.test.mjs:43` asserts the sorted name list). Add a *parameter*, never a tool.
- **SVG+CSS remains the default Output Target**; React+GSAP is opt-in (ADR-0007).
- Tests use `node:assert/strict`, no framework, mirroring the existing `*.test.mjs` files.
- **Byte-for-byte golden:** `tools/emit-react-gsap/generated/*` must be reproducible exactly. Compare with line endings normalised (`.replace(/\r\n/g, "\n")`) — the working tree is CRLF, generated output is LF.
- **Gate after EVERY task:** `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → must print `RESULT: PASS`.
- One logical change per commit; end each commit body with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Match the existing terse comment style. Change only what the task calls for.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `tools/emit-react-gsap/emit-react.mjs` | **Create.** Pure core: rig + SVG in, generated file contents out. No I/O, no env. | 1 |
| `tools/emit-react-gsap/emit-react.test.mjs` | **Create.** Golden + unit tests for the core. | 1 |
| `tools/emit-react-gsap/src/emit.ts` | **Modify.** Becomes a thin CLI: read files → call core → write files. | 1 |
| `tools/emit-react-gsap/cross-target-pivot.test.mjs` | **Create.** The ADR-0007 cross-target pivot-fidelity proof. | 2 |
| `mcp/tools.mjs` | **Modify.** `forgeEmit` gains the `target` parameter. | 3 |
| `mcp/server.mjs` | **Modify.** `forge_emit` schema + description gain `target`. | 3 |
| `mcp/tools.test.mjs` | **Modify.** Append MCP target-parameter tests. | 3 |
| `tools/check-all.ps1` | **Modify.** Add the P7 row. | 4 |
| `tools/emit-react-gsap/demo/main.tsx` | **Modify.** Side-by-side both-targets panel. | 4 |
| `README.md`, `CHANGELOG.md`, `mcp/README.md` | **Modify.** Document the new target parameter. | 4 |

---

### Task 1: Extract the pure ESM core

**Files:**
- Create: `tools/emit-react-gsap/emit-react.mjs`
- Create: `tools/emit-react-gsap/emit-react.test.mjs`
- Modify: `tools/emit-react-gsap/src/emit.ts` (whole file becomes a CLI wrapper)

**Interfaces:**
- Produces: `emitReactGsap({ riggedJson, manualSvg, rigLabel, svgLabel }) -> Record<string, string>`
  - `riggedJson` — a parsed schema-v2 rig object (NOT a JSON string).
  - `manualSvg` — the Manual Part SVG source as a string.
  - `rigLabel` — provenance string cited in generated headers. Default `"docs/buildable-slice/devbrain-rigged.json"`.
  - `svgLabel` — provenance string cited in the generated README. Default `"devbrain-manual-part.svg"`.
  - Returns an object keyed by filename: `"Mascot.tsx"`, `"mascotRig.ts"`, `"mascotMarkup.ts"`, `"README.md"`.
  - Throws `Error` with a `React+GSAP emitter failed: …` prefix on invalid input.
- Also exports (needed by Task 2): `computeBBoxes(svg, partIds) -> Record<string, {minX,minY,maxX,maxY}>`

**Why the defaults matter:** they reproduce the committed golden byte-for-byte. Do not change the default strings.

- [ ] **Step 1: Confirm the golden is currently reproducible**

Run:
```bash
cd tools/emit-react-gsap && node --experimental-strip-types src/emit.ts && cd ../.. && git diff --ignore-cr-at-eol --numstat tools/emit-react-gsap/generated/
```
Expected: the emitter prints `Emitted React+GSAP Mascot to …` and `git diff --numstat` prints **nothing** (zero content drift). Then restore the tree:
```bash
git checkout -- tools/emit-react-gsap/generated/
```
If the diff is NOT empty, STOP and report — the golden is stale and the port cannot be verified.

- [ ] **Step 2: Write the failing golden test**

Create `tools/emit-react-gsap/emit-react.test.mjs`:

```js
// Golden test for the React+GSAP Output Target core. The committed generated/ files ARE the
// contract: the extracted pure core must reproduce them byte-for-byte from the same rig inputs.
// Run: `node tools/emit-react-gsap/emit-react.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { emitReactGsap } from "./emit-react.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const slice = join(here, "..", "..", "docs", "buildable-slice");
const norm = (s) => s.replace(/\r\n/g, "\n"); // working tree is CRLF; emitted output is LF

const riggedJson = JSON.parse(readFileSync(join(slice, "devbrain-rigged.json"), "utf8"));
const manualSvg = readFileSync(join(slice, "devbrain-manual-part.svg"), "utf8");

const files = emitReactGsap({ riggedJson, manualSvg });

// every generated artifact is reproduced exactly
for (const name of ["Mascot.tsx", "mascotRig.ts", "mascotMarkup.ts", "README.md"]) {
  const golden = readFileSync(join(here, "generated", name), "utf8");
  assert.equal(norm(files[name]), norm(golden), `${name} must match the committed golden byte-for-byte`);
}
assert.deepEqual(Object.keys(files).sort(), ["Mascot.tsx", "README.md", "mascotMarkup.ts", "mascotRig.ts"],
  "the core emits exactly the four generated artifacts");

// the core is pure: no filesystem writes, callable twice with identical output
const again = emitReactGsap({ riggedJson, manualSvg });
assert.deepEqual(again, files, "the core is deterministic and side-effect free");

// schema guard: a non-v2 rig is rejected with an actionable message
assert.throws(() => emitReactGsap({ riggedJson: { ...riggedJson, version: 1 }, manualSvg }),
  /version 2/, "a non-v2 rig is rejected");

// geometry ceiling (ADR-0011): a part with no <rect> geometry cannot be bounded
assert.throws(
  () => emitReactGsap({
    riggedJson: { ...riggedJson, parts: [{ id: "part-ghost", origin: "50% 50%", pivot: { x: 1, y: 1 } }] },
    manualSvg: '<svg viewBox="0 0 10 10"><g id="part-ghost"><path d="M0 0h4v4z" fill="#a"/></g></svg>',
  }),
  /no <rect> geometry/,
  "a path-only part fails with the documented geometry ceiling"
);

console.log("emit-react.test.mjs: golden + purity + guards green.");
```

- [ ] **Step 3: Run it, verify it fails**

Run: `node tools/emit-react-gsap/emit-react.test.mjs`
Expected: FAIL — `Cannot find module './emit-react.mjs'`.

- [ ] **Step 4: Create the core by porting `src/emit.ts`**

Create `tools/emit-react-gsap/emit-react.mjs` by copying `tools/emit-react-gsap/src/emit.ts` and applying these exact mechanical transformations. **Read the current `src/emit.ts` in full first** — it is the source of truth for every string literal, and any transcription error will be caught by the Step 2 golden.

1. **Delete** the file-I/O and environment surface: the `readFileSync/writeFileSync/mkdirSync` import, `here`, `repoRoot`, `sliceDir`, `outDir`, `RIG_PATH`, `SVG_PATH`, `readRig()`, and the trailing bare `main();` call.
2. **Delete all TypeScript type annotations and the `interface` declarations** (`State`, `Channel`, `RigRecipe`, `Rig`, `BBox`). They are compile-time only. Keep every runtime expression byte-identical.
3. **Keep verbatim**, with types stripped: `EMIT_PREFIX`, `fail()`, `computeBBoxes()`, `parseOriginPercent()`, `assertPivotAgreesWithOrigin()`, `namespaceSvg()`, `emitRecipe()`, `buildReducedPoses()`, and the entire `COMPONENT_SOURCE` template literal. **`COMPONENT_SOURCE` must be copied character-for-character** — it is the largest golden surface.
4. **Convert `main()` into the exported core.** Replace its signature and its four `writeFileSync(join(outDir, …), …)` calls with entries on a returned object. Keep every generated string expression exactly as-is, substituting the two provenance literals with the parameters:
   - in `mascotRig.ts`'s header, the literal `docs/buildable-slice/devbrain-rigged.json` becomes `${rigLabel}`
   - in `README.md`, the literal `docs/buildable-slice/devbrain-rigged.json` becomes `${rigLabel}` and `devbrain-manual-part.svg` becomes `${svgLabel}`
   - delete the `mkdirSync` and the trailing `process.stdout.write(...)` line
5. **Export** `emitReactGsap` and `computeBBoxes`.

The resulting shape:

```js
// emit-react.mjs — pure core for the React+GSAP Output Target (ADR-0003/0007). Rig + SVG in,
// generated file CONTENTS out. No filesystem, no env: src/emit.ts owns the CLI, mcp/tools.mjs
// calls this in-process. Imports nothing beyond the language — React/GSAP are demo-app deps.
export function emitReactGsap({
  riggedJson,
  manualSvg,
  rigLabel = "docs/buildable-slice/devbrain-rigged.json",
  svgLabel = "devbrain-manual-part.svg",
} = {}) {
  const rig = riggedJson;
  if (!rig || rig.version !== 2) fail(`expected rigged.json version 2, got ${rig && rig.version}`);
  // ... body of the old main(), unchanged, using `manualSvg` where it read rawSvg from disk ...
  return {
    "mascotMarkup.ts": /* the string the old writeFileSync wrote */,
    "mascotRig.ts": /* ... */,
    "Mascot.tsx": COMPONENT_SOURCE,
    "README.md": /* ... */,
  };
}
```

- [ ] **Step 5: Run the golden test, verify it passes**

Run: `node tools/emit-react-gsap/emit-react.test.mjs`
Expected: PASS — `emit-react.test.mjs: golden + purity + guards green.`

If a golden assertion fails, the diff is a transcription error in the port. Do NOT edit the golden files to match — fix the port.

- [ ] **Step 6: Rewrite `src/emit.ts` as a thin CLI over the core**

Replace the **entire contents** of `tools/emit-react-gsap/src/emit.ts` with:

```ts
/*
 * mascot-forge — React+GSAP Output Target CLI.
 *
 * Thin wrapper: reads the locked rigged.json (schema v2) + the Manual Part SVG from disk, calls the
 * shared pure core, writes the generated files. All emit logic lives in ../emit-react.mjs so this CLI
 * and the MCP (mcp/tools.mjs) cannot drift — the same reason tools/rig-editor/emit.js is shared
 * between the editor's live preview and its export.
 *
 * Run: `npm run emit`  (node strips the TS types; no build step needed to generate).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — pure ESM core, no type declarations by design (zero-dependency, no build step).
import { emitReactGsap } from "../emit-react.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const sliceDir = join(repoRoot, "docs", "buildable-slice");
const outDir = join(here, "..", "generated");

const RIG_PATH = process.env.RIG_PATH ?? join(sliceDir, "devbrain-rigged.json");
const SVG_PATH = process.env.SVG_PATH ?? join(sliceDir, "devbrain-manual-part.svg");

let riggedJson: unknown;
try {
  riggedJson = JSON.parse(readFileSync(RIG_PATH, "utf8"));
} catch (error) {
  throw new Error(`React+GSAP emitter failed: could not read/parse rig at ${RIG_PATH}: ${(error as Error).message}`);
}

const files: Record<string, string> = emitReactGsap({
  riggedJson,
  manualSvg: readFileSync(SVG_PATH, "utf8"),
});

mkdirSync(outDir, { recursive: true });
for (const [name, contents] of Object.entries(files)) writeFileSync(join(outDir, name), contents);

process.stdout.write(`Emitted React+GSAP Mascot to ${outDir}\n`);
```

- [ ] **Step 7: Verify the CLI still reproduces the golden**

Run:
```bash
cd tools/emit-react-gsap && node --experimental-strip-types src/emit.ts && cd ../.. && git diff --ignore-cr-at-eol --numstat tools/emit-react-gsap/generated/
```
Expected: emitter prints its success line; `git diff --numstat` prints **nothing**. Then `git checkout -- tools/emit-react-gsap/generated/`.

- [ ] **Step 8: Full gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS
git add tools/emit-react-gsap/emit-react.mjs tools/emit-react-gsap/emit-react.test.mjs tools/emit-react-gsap/src/emit.ts
git commit -m "refactor(emit-react): extract a pure ESM core the CLI and MCP can share"
```

---

### Task 2: Cross-target pivot-fidelity proof (the ADR-0007 risk)

**Files:**
- Create: `tools/emit-react-gsap/cross-target-pivot.test.mjs`

**Interfaces:**
- Consumes: `computeBBoxes(svg, partIds)` from `./emit-react.mjs` (Task 1), `originToPivot(origin, bbox)` from `../rig-editor/pivot.js`.

**Why this test exists.** ADR-0007 states: *"The biggest fidelity risk for an automated pipeline is the GSAP-vs-CSS pivot computation difference."* The two targets reach a part's rotation centre by different routes:

- **SVG+CSS** ships `transform-origin: X% Y%` with `transform-box: fill-box`. The browser resolves that percentage against the part's **rendered** fill-box.
- **React+GSAP** ships GSAP `svgOrigin: "x y"` — the **absolute** canonical pivot, no percentage involved.

The percentage was computed by `tools/rig-editor/exporter.js` against the **model's** rect bbox, but the browser resolves it against the **rendered** geometry's bbox. Nothing currently forces those two bboxes to agree. This test does, against the real DevBrain rig.

Note `computeBBoxes` returns `{minX,minY,maxX,maxY}` while `originToPivot` expects `{x,y,w,h}` — the test converts between them explicitly.

- [ ] **Step 1: Write the failing test**

Create `tools/emit-react-gsap/cross-target-pivot.test.mjs`:

```js
// ADR-0007's #1 named automation risk, tested: SVG+CSS resolves a part's rotation centre from a
// PERCENTAGE against the rendered fill-box; React+GSAP uses the ABSOLUTE pivot via GSAP svgOrigin.
// If the bbox the percentage was authored against ever diverges from the rendered geometry's bbox,
// the two targets rotate the same part around different points and the rig silently desyncs.
// Run: `node tools/emit-react-gsap/cross-target-pivot.test.mjs`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { computeBBoxes } from "./emit-react.mjs";
import { originToPivot } from "../rig-editor/pivot.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const slice = join(here, "..", "..", "docs", "buildable-slice");

const rig = JSON.parse(readFileSync(join(slice, "devbrain-rigged.json"), "utf8"));
const svg = readFileSync(join(slice, "devbrain-manual-part.svg"), "utf8");

assert.ok(rig.parts.length >= 2, "the fidelity proof must run against a real multi-part rig");

const bboxes = computeBBoxes(svg, rig.parts.map((p) => p.id));

for (const part of rig.parts) {
  const b = bboxes[part.id];
  // computeBBoxes speaks {minX,minY,maxX,maxY}; pivot.js speaks {x,y,w,h}
  const box = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };

  // what the BROWSER will resolve the SVG+CSS percentage to, against the rendered geometry
  const cssResolved = originToPivot(part.origin, box);
  // what GSAP receives directly on the React target
  const gsapAbsolute = part.pivot;

  const tolX = box.w * 0.005; // 0.5% of the part bbox, matching the emitter's internal tolerance
  const tolY = box.h * 0.005;
  assert.ok(
    Math.abs(cssResolved.x - gsapAbsolute.x) <= tolX && Math.abs(cssResolved.y - gsapAbsolute.y) <= tolY,
    `cross-target pivot drift on '${part.id}': SVG+CSS origin '${part.origin}' resolves to ` +
      `(${cssResolved.x.toFixed(2)}, ${cssResolved.y.toFixed(2)}) against the rendered bbox, but ` +
      `React+GSAP rotates around (${gsapAbsolute.x}, ${gsapAbsolute.y}). Both targets must share one point.`
  );
}

// a deliberately corrupted origin MUST be caught — proves the assertion has teeth rather than
// passing vacuously because the tolerance swallows everything.
{
  const [first] = rig.parts;
  const b = bboxes[first.id];
  const box = { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY };
  const drifted = originToPivot("0% 0%", box); // top-left instead of the authored pivot
  const far = Math.abs(drifted.x - first.pivot.x) > box.w * 0.005 ||
              Math.abs(drifted.y - first.pivot.y) > box.h * 0.005;
  assert.ok(far, "the tolerance is tight enough to catch a real drift (guards against a vacuous pass)");
}

console.log(`cross-target-pivot.test.mjs: ${rig.parts.length} parts share one rotation centre across both targets.`);
```

- [ ] **Step 2: Run it, verify it passes and is not vacuous**

Run: `node tools/emit-react-gsap/cross-target-pivot.test.mjs`
Expected: PASS, printing the part count. The final block guarantees the assertion has teeth.

If the *first* loop fails, do NOT loosen the tolerance — a genuine cross-target drift has been found. Report it; that is exactly what this task exists to detect.

- [ ] **Step 3: Full gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS
git add tools/emit-react-gsap/cross-target-pivot.test.mjs
git commit -m "test(emit-react): prove both output targets share one rotation centre (ADR-0007 risk)"
```

---

### Task 3: `forge_emit` gains the `target` parameter

**Files:**
- Modify: `mcp/tools.mjs` (import + `forgeEmit`)
- Modify: `mcp/server.mjs` (`forge_emit` registration)
- Modify: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Consumes: `emitReactGsap({ riggedJson, manualSvg, rigLabel, svgLabel })` from Task 1.
- Produces: `forgeEmit({ session, assetName, outDir, target })` where `target` is `"svg-css"` (default) | `"react-gsap"` | `"both"`.
  - Without `outDir`: adds `reactBytes` (total bytes across the four generated files) to the result.
  - With `outDir`: writes the four files into `<outDir>/react-gsap/` and lists them in `written`.
  - The SVG+CSS artifacts are produced unless `target === "react-gsap"`.
  - An unknown `target` throws. A rig the React target cannot express returns `{ ok: false, error }` with an actionable message.

- [ ] **Step 1: Write the failing tests**

Append to `mcp/tools.test.mjs`:

```js
// forge_emit target parameter: the React+GSAP Output Target (ADR-0007, opt-in) is reachable from
// the agent path. Default stays svg-css so existing callers are untouched.
{
  const mk = () => {
    const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
    assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
    assignRegion({ session: s.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "hand-left", role: "limb" });
    return s.session;
  };

  // default is unchanged — SVG+CSS only, no React artifacts (regression guard for existing callers)
  const dflt = forgeEmit({ session: mk(), assetName: "t1" });
  assert.equal(dflt.ok, true, "default emit still succeeds");
  assert.ok(dflt.svgBytes > 0, "default emits the SVG+CSS target");
  assert.equal(dflt.reactBytes, undefined, "default does NOT emit React+GSAP");

  // react-gsap only
  const react = forgeEmit({ session: mk(), assetName: "t2", target: "react-gsap" });
  assert.equal(react.ok, true, `react-gsap emit succeeds: ${JSON.stringify(react.error || react.validation)}`);
  assert.ok(react.reactBytes > 0, "react-gsap emits the React target");

  // both
  const both = forgeEmit({ session: mk(), assetName: "t3", target: "both" });
  assert.equal(both.ok, true, "both-target emit succeeds");
  assert.ok(both.svgBytes > 0 && both.reactBytes > 0, "both targets are emitted together");

  // an unknown target is rejected loudly rather than silently falling back
  assert.throws(() => forgeEmit({ session: mk(), assetName: "t4", target: "vue" }), /target/i,
    "an unknown target is rejected");

  // with outDir, the React files land in a react-gsap/ subdir and are listed
  const w = forgeEmit({ session: mk(), assetName: "t5", target: "both", outDir: "out/_test_open" });
  assert.equal(w.ok, true, "both-target emit with outDir succeeds");
  assert.ok(w.written.some((f) => /react-gsap[\\/]Mascot\.tsx$/.test(f)), `Mascot.tsx is written: ${w.written}`);
  assert.ok(w.written.some((f) => /t5-mascot\.svg$/.test(f)), "the SVG+CSS artifact is still written");
}
```

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — `react.reactBytes` is `undefined` (the parameter is not implemented yet).

- [ ] **Step 3: Import the core in `mcp/tools.mjs`**

Add alongside the existing `tools/rig-editor` imports near the top of `mcp/tools.mjs`:

```js
import { emitReactGsap } from "../tools/emit-react-gsap/emit-react.mjs";
```

- [ ] **Step 4: Add the `target` branch to `forgeEmit`**

In `mcp/tools.mjs`, change the `forgeEmit` signature and add the React branch. Replace the signature line:

```js
export function forgeEmit({ session, assetName = "mascot", outDir, target = "svg-css" } = {}) {
  if (!["svg-css", "react-gsap", "both"].includes(target)) {
    throw new Error(`unknown target '${target}' — use "svg-css" (default), "react-gsap", or "both"`);
  }
```

Then, immediately **after** the `const advisory = …` line and **before** `const svg = emitAnimatedSvg(…)`, insert the React emit:

```js
  // ADR-0003: one rig contract, two emitters. React+GSAP is opt-in (ADR-0007) and shares the exact
  // riggedJson/manualSvg the SVG+CSS path uses, so the two targets cannot diverge.
  let reactFiles = null;
  if (target !== "svg-css") {
    try {
      reactFiles = emitReactGsap({ riggedJson: out.riggedJson, manualSvg: out.manualSvg, rigLabel: `${assetName} (MCP session)`, svgLabel: `${assetName}-manual-part.svg` });
    } catch (e) {
      // the documented v1 ceiling: React+GSAP needs <rect> geometry (ADR-0011 allows path parts)
      return { ok: false, error: `React+GSAP target: ${e.message}. Re-run with target:"svg-css", which has no geometry restriction.` };
    }
  }
  const reactBytes = reactFiles ? Object.values(reactFiles).reduce((n, s) => n + s.length, 0) : undefined;
```

Then guard the SVG+CSS artifacts so `target: "react-gsap"` skips them. Replace the two lines that build `svg` and `demo` with:

```js
  const wantSvgCss = target !== "react-gsap";
  const svg = wantSvgCss ? emitAnimatedSvg(out.riggedJson, out.manualSvg) : null;
  const demo = wantSvgCss ? emitShowcaseHtml(out.riggedJson, svg, assetName, sourceDataUri) : null;
```

Replace the `if (outDir) { … }` block and the final return with:

```js
  if (outDir) {
    const dir = safePath(outDir); mkdirSync(dir, { recursive: true });
    const files = [];
    if (wantSvgCss) {
      files.push([join(dir, `${assetName}-mascot.svg`), svg], [join(dir, `${assetName}-mascot-demo.html`), demo]);
    }
    if (reactFiles) {
      const rdir = join(dir, "react-gsap"); mkdirSync(rdir, { recursive: true });
      for (const [name, contents] of Object.entries(reactFiles)) files.push([join(rdir, name), contents]);
    }
    for (const [f, c] of files) writeFileSync(f, c);
    const res = { ok: true, validation: v, ...advisory, written: files.map(([f]) => f) };
    if (wantSvgCss) res.open = servedUrl(join(dir, `${assetName}-mascot-demo.html`));
    return res;
  }
  const res = { ok: true, validation: v, ...advisory };
  if (wantSvgCss) { res.svgBytes = svg.length; res.demoBytes = demo.length; }
  if (reactBytes !== undefined) res.reactBytes = reactBytes;
  return res;
}
```

- [ ] **Step 5: Run the MCP tests, verify they pass**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS — all existing assertions plus the new target block.

- [ ] **Step 6: Expose `target` on the MCP tool schema**

In `mcp/server.mjs`, find the `forge_emit` `registerTool` call. Add to its `inputSchema` object:

```js
        target: z.enum(["svg-css", "react-gsap", "both"]).optional(),
```

And append this sentence to its `description` string:

```
Pass `target` to choose the Output Target: "svg-css" (default, dependency-free, portable), "react-gsap" (opt-in React+TS component driven by GSAP timelines — use when the mascot lives in a React app needing mid-tween interrupts), or "both". React+GSAP needs rect-based geometry; a path-based rig returns a clear error naming the ceiling.
```

- [ ] **Step 7: Verify the 10-tool lock still holds**

Run: `cd mcp && node protocol.test.mjs && node server.test.mjs`
Expected: PASS — `all ten tools are advertised over the protocol`. Adding a *parameter* must not change the tool count.

- [ ] **Step 8: Full gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS
git add mcp/tools.mjs mcp/server.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): forge_emit gains a target param so agents can reach React+GSAP"
```

---

### Task 4: Gate coverage, side-by-side demo, docs

**Files:**
- Modify: `tools/check-all.ps1` (add the P7 row)
- Modify: `tools/emit-react-gsap/demo/main.tsx` (side-by-side panel)
- Modify: `README.md`, `CHANGELOG.md`, `mcp/README.md`

**Interfaces:**
- Consumes: the test files from Tasks 1–2 and the `target` parameter from Task 3.

**Note on the gate shape:** P5 and P6 in `check-all.ps1` do not have their own `.ps1` files — they inline a `foreach` over node test files. P7 follows that established pattern rather than adding a new script.

- [ ] **Step 1: Add the P7 gate row**

In `tools/check-all.ps1`, insert this entry into the `$checks` array immediately after the `P6 mcp` block (before the closing `)`):

```powershell
  ,@{
    Name = "P7 react-gsap"   # second Output Target: pure-core golden + the cross-target pivot proof
    Run  = {
      foreach ($t in "emit-react", "cross-target-pivot") {
        & node (Join-Path $repoRoot "tools/emit-react-gsap/$t.test.mjs")
        if ($LASTEXITCODE -ne 0) { break }  # leaves the failing exit code for the summary
      }
    }
  }
```

- [ ] **Step 2: Verify P7 runs and passes**

Run: `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1`
Expected: the summary now lists `P7 react-gsap` and prints `RESULT: PASS (all pipeline checks green)`.

- [ ] **Step 3: Add the side-by-side both-targets panel to the demo**

In `tools/emit-react-gsap/demo/main.tsx`, add this import beside the existing ones:

```tsx
import { MASCOT_SVG, ID_PREFIX } from "../generated/mascotMarkup";
```

Add this component immediately above `function App()`:

```tsx
// ADR-0003 made visible: ONE rig contract, TWO emitters. The React+GSAP <Mascot> and the raw
// generated SVG markup render side by side off the same rig, driven by one shared state control —
// so a pivot or timing divergence between the targets is visible rather than merely asserted.
function SideBySide({ state }: { state: MascotState }) {
  const html = useMemo(
    () => ({ __html: MASCOT_SVG.split(ID_PREFIX).join("sbs-").replace(/data-state="[^"]*"/, `data-state="${state}"`) }),
    [state],
  );
  return (
    <>
      <section className="stage" aria-label="React+GSAP target">
        <Mascot state={state} idPrefix="sbs-react-" />
      </section>
      <aside className="panel">
        <h1>One rig → two targets</h1>
        <p>Left: <strong>React+GSAP</strong> (GSAP timelines, absolute <code>svgOrigin</code> pivots).</p>
        <p>Below: the same rig's <strong>SVG</strong> markup. Both animate off one <code>rigged.json</code>.</p>
        <pre id="probe-sbs">both: {state}</pre>
      </aside>
      <section className="stage" aria-label="Shared rig markup">
        <div className="mascot-stage" dangerouslySetInnerHTML={html} />
      </section>
      <aside className="panel">
        <h1>Shared markup</h1>
        <p>Identical part groups and canonical pivots — the cross-target fidelity the P7 gate proves.</p>
      </aside>
    </>
  );
}
```

Add `useMemo` to the existing `react` import (it currently imports `StrictMode, useState`), and render the panel inside `App`'s `<main>`, immediately before its closing `</main>`:

```tsx
      <SideBySide state={state} />
```

- [ ] **Step 4: Verify the demo builds**

Run: `cd tools/emit-react-gsap && npx tsc --noEmit`
Expected: no type errors. (`node_modules` is already installed in this directory. If `npx tsc` is unavailable, run `npm install` there first — these are dev-only deps confined to this folder.)

- [ ] **Step 5: Document the new target**

In `README.md`, in the numbered MCP guided-path list, extend the `forge_emit` bullet (step 5) to read:

```
5. `forge_status` then `forge_emit` — validate and write a self-contained animated SVG (+ demo HTML) you own.
   Pass `target: "react-gsap"` (or `"both"`) to emit the opt-in React+TS GSAP component instead of/alongside
   the dependency-free SVG+CSS default.
```

In `mcp/README.md`, add `target` to the `forge_emit` row of the tools table with the description: `Output Target: "svg-css" (default) | "react-gsap" | "both"`.

In `CHANGELOG.md`, add under `## [Unreleased]` → `### Added`:

```markdown
- **React+GSAP reachable from the MCP agent path** — `forge_emit` gains a `target` parameter
  (`"svg-css"` default | `"react-gsap"` | `"both"`), implementing ADR-0003's "one rig contract,
  swappable emitter" for the first time on the agent path. The emitter's logic moved into a pure ESM
  core (`tools/emit-react-gsap/emit-react.mjs`) shared by the CLI and the MCP so they cannot drift; the
  committed `generated/` files are its byte-for-byte golden. New **P7** gate stage covers the target,
  which previously had none, and a cross-target pivot-fidelity test proves both Output Targets rotate
  every part around the identical absolute point — the risk ADR-0007 named as the biggest one for an
  automated pipeline, now tested rather than assumed. No new dependency: the core imports only `node:*`.
```

- [ ] **Step 6: Full gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS, including P7
git add tools/check-all.ps1 tools/emit-react-gsap/demo/main.tsx README.md mcp/README.md CHANGELOG.md
git commit -m "feat: P7 gate for the React+GSAP target, side-by-side demo, docs"
```

---

## Self-Review

**Spec coverage:**
- Gap 1 (agent path can't reach the target) → Task 3. ✅
- Gap 2 (no gate coverage) → Task 4 Step 1 (P7). ✅
- Gap 3 (ADR-0007 pivot risk untested) → Task 2. ✅
- Architecture: pure ESM core + CLI wrapper → Task 1. ✅
- Known limitation (path-based rigs) → Task 1 Step 2 (core throws, tested) + Task 3 Step 4 (MCP returns actionable message, tested). ✅
- Golden strategy → Task 1 Steps 1/2/5/7. ✅
- Demo → Task 4 Step 3. ✅
- 10-tool lock → Task 3 Step 7 explicitly verifies it. ✅
- No new dependency → the core imports only `node:*`; Task 3 imports it directly, no subprocess. ✅

**Placeholder scan:** every code step shows the exact content and the exact command with expected output. Task 1 Step 4 is a mechanical port of an existing file rather than transcribed source — deliberate: transcribing 380 lines into the plan invites transcription error, and the Step 2 golden verifies the result byte-for-byte, which is a stronger guarantee than a copied listing. The transformation rules are exhaustive and name every symbol. ✅

**Type/name consistency:** `emitReactGsap({riggedJson, manualSvg, rigLabel, svgLabel})` is defined in Task 1 and consumed identically in Task 3. `computeBBoxes(svg, partIds) -> {minX,minY,maxX,maxY}` is exported in Task 1 and consumed in Task 2, which explicitly converts to `pivot.js`'s `{x,y,w,h}` shape. `target` values are the same three strings in Tasks 3 and 4. `reactBytes`/`written` are named consistently in the Task 3 tests and implementation. ✅

**Risk notes for the executor:**
- Task 1 is the only golden-adjacent change. If Step 5 fails, the port has a transcription error — fix the port, never the golden.
- Task 2 failing on the *first* loop means a genuine cross-target drift exists. Do not loosen the tolerance; report it.
- Tasks are sequential: 2 and 3 both depend on Task 1's core. 4 depends on 1–3.
