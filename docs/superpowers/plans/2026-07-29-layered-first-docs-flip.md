# Layered-First Docs Flip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the documentation lead with layered SVG — and make that lead honest, by first committing an example asset and a test that proves the whole user loop works with it.

**Architecture:** Evidence before claims. Tasks 1-2 create the artifact the docs will point at and the test that keeps it working; Tasks 3-5 move the documentation onto it. The order is the point: a flip written first would be a promise with nothing behind it.

**Tech Stack:** Hand-authored SVG, Playwright e2e, Markdown. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-07-29-layered-first-docs-flip-design.md](../specs/2026-07-29-layered-first-docs-flip-design.md)

## Global Constraints

- **NEVER create a root `package.json`.** The gate asserts its absence.
- **MCP tool count is locked at exactly 10.** This plan adds none.
- `runtime/`, `tools/rig-editor/` and `tools/gate/` stay **zero-dependency**, pure ESM.
- `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` are **byte-for-byte goldens**. If one moves, STOP and report.
- **Gate after every task:** `node tools/gate/check-all.mjs` → `RESULT: PASS`.
- **E2E:** 24 today; **25** after Task 2. No other movement.
- **Do not delete any tracked file.** Do not push.
- Commit bodies end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Docs may be flipped, but not made to overclaim.** Every limit in "Honest limits" below must survive into the shipped docs.

## Domain Orientation

`mascot-forge` turns artwork into an owned, animated SVG mascot. Two input paths:

- **Raster + auto-segmentation** — a PNG is vectorised then auto-segmented. A 2026-07-25 cold-start playtest failed on 3 of 3 unseen assets (a ghost grew invented "legs"; a T-Rex's head was labelled "eyes"). `docs/research/landscape.md` §5 records that automatic 2D rigging is unsolved research, so this ceiling is not closeable by effort.
- **Layered SVG** — a Figma/Illustrator/Inkscape export where each top-level `<g>` is already a named part. Perfect part semantics for free, because a human named the layers.

The owner decided on 2026-07-25 to lead with layered. Stages 1 and 2 did the engineering. This stage moves the docs — after closing the evidence gap that would otherwise make the move dishonest.

## Honest limits — these must appear in the shipped docs

Not footnotes. These are the difference between a reframe and an overclaim:

1. The **agent/MCP path is `rect` + `path` only.** `mcp/tools.mjs:199-204` hard-fails on `circle`/`ellipse`/`polygon`/`polyline`/`line`. The browser editor handles all seven.
2. The **`mf.ps1` CLI has no layered entry at all.** Layered input goes through the browser editor or MCP.
3. The example asset is **hand-authored to the same rules**, not a captured real-world export.
4. Layered's evidence is **parser correctness plus a proven user loop** — *not* the cold-start playtest that discredited raster. State what is proven, not what is implied.

---

### Task 1: The example layered asset (+ prove it on the agent path)

**Files:**
- Create: `assets/example-layered/robot.svg`
- Modify: `mcp/tools.test.mjs` (its existing layered test)

**Interfaces produced:** the committed path `assets/example-layered/robot.svg`, referenced by Tasks 2, 3 and 4.

**Why this asset is load-bearing:** every later task points at it. Its constraints are not stylistic:

- **`rect` and `path` only.** No `circle`/`ellipse`/`polygon`/`polyline`/`line` — the MCP path rejects those outright, and an example that only worked in the browser would break the promise the new headline makes to agent users.
- **No `transform` attribute anywhere** — stage 1's guard refuses those by layer name.
- **Meaningfully-named top-level `<g>` layers.** The layer name becomes the part id via `sanitizeId` (`"Left Arm"` → `part-left-arm`).
- **Realistic, not a minimal repro.** Several layers, a plausible viewBox, real geometry.

- [ ] **Step 1: Author the asset**

Create `assets/example-layered/robot.svg`. Use exactly this — the geometry is chosen so every part has a sensible pivot and the file reads like something a designer would export:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220" width="200" height="220">
  <!-- Hand-authored example of a LAYERED export (Figma/Illustrator/Inkscape shape).
       Each top-level <g> is one part; its name becomes the part id. rect + path only, and
       no transform attributes — see docs/guides/exporting-layers.md for why. -->
  <g id="Antenna">
    <path d="M100 26 L100 8" stroke="#8892a6" stroke-width="4" fill="none"/>
    <rect x="94" y="0" width="12" height="12" rx="2" fill="#ff6b57"/>
  </g>
  <g id="Head">
    <rect x="62" y="26" width="76" height="58" rx="10" fill="#cfd6e4"/>
    <rect x="76" y="46" width="48" height="20" rx="6" fill="#243044"/>
  </g>
  <g id="Body">
    <rect x="70" y="88" width="60" height="70" rx="8" fill="#aab4c8"/>
    <path d="M84 104 L116 104 L116 118 L84 118 Z" fill="#5b6478"/>
  </g>
  <g id="Left Arm">
    <path d="M70 96 L52 96 L46 140 L58 142 L64 106 Z" fill="#8892a6"/>
  </g>
  <g id="Right Arm">
    <path d="M130 96 L148 96 L154 140 L142 142 L136 106 Z" fill="#8892a6"/>
  </g>
  <g id="Left Leg">
    <rect x="80" y="158" width="16" height="50" rx="4" fill="#6c7791"/>
  </g>
  <g id="Right Leg">
    <rect x="104" y="158" width="16" height="50" rx="4" fill="#6c7791"/>
  </g>
</svg>
```


- [ ] **Step 2: Prove it ingests on BOTH paths before anything depends on it**

```bash
node -e "import('file:///C:/Users/student1/Dev/mascot-forge/tools/rig-editor/layer-ingest.js').then(async (m)=>{const fs=await import('node:fs');const t=fs.readFileSync('assets/example-layered/robot.svg','utf8');const r=m.parseLayered(t);console.log('parts:',[...new Set(r.elements.map(e=>e.part))]);console.log('elements:',r.elements.length);console.log('any null bbox (would break MCP):',r.elements.some(e=>!e.bbox));})"
```

Expected: seven parts (`part-antenna`, `part-head`, `part-body`, `part-left-arm`, `part-right-arm`, `part-left-leg`, `part-right-leg`), and **`any null bbox: false`**.

A `true` there means the file contains a shape the MCP path cannot measure — fix the asset, not the checker.

Then the real agent-path entry:

```bash
node -e "import('file:///C:/Users/student1/Dev/mascot-forge/mcp/tools.mjs').then(async (m)=>{const r=m.startFromLayeredSvg({path:'assets/example-layered/robot.svg'});console.log('session:',!!r.session,'viewBox:',r.viewBox);console.log('parts:',r.parts.map(p=>p.id||p));})"
```

Expected: a session, the viewBox, and the same seven parts. If it throws, read the message — it will name exactly what the asset violates.

- [ ] **Step 3: Repoint the MCP test at the committed asset**

`mcp/tools.test.mjs` has a layered test driven by an inline SVG string (search for `startFromLayeredSvg`). Change it to read `assets/example-layered/robot.svg` from disk instead.

Keep the existing assertions and add one: the parts list equals the seven expected ids, in document order. That is what turns "the asset happens to work today" into "the asset is guarded".

Do **not** delete the inline-string test if it covers something the asset does not (e.g. `data-*` metadata round-tripping) — add alongside, and say which you did and why.

- [ ] **Step 4: Verify**

```bash
node mcp/tools.test.mjs
```
```bash
node tools/gate/check-all.mjs
```

Expected: tests pass; gate `RESULT: PASS`.

- [ ] **Step 5: Commit**

```bash
git add assets/example-layered/robot.svg mcp/tools.test.mjs
git commit -m "feat(assets): committed layered-SVG example, proven on the agent path"
```

- [ ] **Step 6: Report back**

Both Step 2 outputs verbatim (especially `any null bbox`), what you changed in `mcp/tools.test.mjs` and whether you kept the inline test, the gate's final line, and `git status --short`.

---

### Task 2: The e2e that proves the user loop

**Files:**
- Create: `tests/e2e/drop-layered.spec.mjs`

**Interfaces consumed:** `assets/example-layered/robot.svg` from Task 1.

**Template to mirror:** `tests/e2e/drop-rig.spec.mjs`. It is the PNG equivalent of this test and does exactly what is missing for layered — real `page.setInputFiles("#file", …)`, role assignment through the UI, a real `download` event. Read it first and follow its shape closely, so the two input paths are visibly held to the same standard and a reviewer can diff them.

**Why this is not redundant with existing layered tests:** `layered-transform.spec.mjs` and `handoff-rig.spec.mjs` call `window.__rigEditor.loadLayeredSvg()` directly via `page.evaluate`. They prove the *ingest* and that the two ingest paths agree. Nothing proves a human dropping a *file* reaches a *download*.

- [ ] **Step 1: Write the test**

```js
import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The layered-first product claim under test: a designer drops their Figma/Illustrator export and gets
// an animated SVG back, no terminal. Mirrors drop-rig.spec.mjs (the PNG equivalent) on purpose — the
// two input paths should be held to the same standard, and the diff between these files should be
// only what genuinely differs. The other layered suites call loadLayeredSvg() directly via evaluate;
// this one drives the real #file input through to a real download event.
const PAGE = "/tools/rig-editor/index.html";
const ROBOT = fileURLToPath(new URL("../../assets/example-layered/robot.svg", import.meta.url));

test("drop a layered SVG → each named layer becomes a part", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", ROBOT);
  // loadLayeredSvg is synchronous once the file is read; the parts list is the completion signal.
  await expect(page.locator("#parts li")).toHaveCount(7);
  // the LAYER NAMES survived into part ids — the whole reason this path beats auto-segmentation
  await expect(page.locator("#parts")).toContainText("part-left-arm");
  expect(errors, "no uncaught page errors during intake").toEqual([]);
});

test("dropped layered SVG → assign a role + preset in-browser → export downloads a self-contained SVG", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", ROBOT);
  await expect(page.locator("#parts li")).toHaveCount(7);

  await page.locator("#parts li").first().click();
  await expect(page.locator("#partedit")).toBeVisible();
  await page.selectOption("#role", "limb");
  await page.selectOption("#preset-active", "spin");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportanim"),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(errors, "no uncaught page errors during export").toEqual([]);
});
```

Adjust selectors only if the real DOM differs — check `tools/rig-editor/index.html` rather than guessing, and report any adjustment you made.

- [ ] **Step 2: Verify it fails for the right reason first**

Temporarily point `ROBOT` at a non-existent path and run the suite. Expected: the new tests fail on the missing file, not silently pass. Restore the path. This is a cheap guard against a test that would pass without loading anything.

- [ ] **Step 3: Run the suite**

```bash
pwsh -NoProfile -File tools/check-e2e.ps1
```

Expected: **25 passed** (24 before, this adds one spec file with two tests… report the real number and reconcile it. If the file's two tests take it to 26, say so and state that as the new expected count rather than deleting a test to hit a number.)

- [ ] **Step 4: Gate + commit**

```bash
node tools/gate/check-all.mjs
```
```bash
git add tests/e2e/drop-layered.spec.mjs
git commit -m "test(e2e): drop a layered SVG through the real UI to a download"
```

- [ ] **Step 5: Report back**

The Step 2 negative-control result, the exact e2e total, any selector you had to adjust and why, and the gate's final line.

---

### Task 3: The Figma/Illustrator export guide

**Files:**
- Create: `docs/guides/exporting-layers.md`

**Interfaces consumed:** `assets/example-layered/robot.svg` (link to it as the worked example).

Under the layered-first direction this guide *is* the onboarding path — it is what stands between a designer and their first successful rig.

- [ ] **Step 1: Gather the scattered guidance it replaces**

Read these before writing, so the guide consolidates rather than competes:

- `docs/gallery/README.md:28-33, 42-44` — colour separation advice
- `tools/rig-editor/README.md:19-24` — the one-line recommendation
- `docs/launch/README.md:41-42` — the most technically precise existing text, buried in an owner checklist
- `tools/rig-editor/layer-ingest.js:52-57` — `transformErrorMessage`, the **only** place the corrective action currently exists, and it is a runtime string no doc surfaces

- [ ] **Step 2: Write the guide**

It must cover, with the transform rule **first** because it is the most likely first-run failure for a real Figma export:

| Rule | Why |
|---|---|
| **Flatten or expand transformed groups before export** | Any `transform` in a layer's subtree is refused, by layer name. Figma: right-click → Flatten selection. Illustrator: Object → Expand |
| Each **top-level `<g>` is one part**; name it meaningfully | The layer name becomes the part id (`"Left Arm"` → `part-left-arm`) |
| Nesting is fine | A layer owns every drawable in its subtree, at any depth |
| `data-*` only on the top-level `<g>` | Nested groups contribute geometry, never metadata or a part of their own |
| **Avoid `circle`/`ellipse`/`polygon` for the agent path** | MCP rejects them outright; the browser editor handles them. Convert to paths, or use the editor |
| Clip paths and masks are ignored safely | Stripped before layer selection; they never become phantom parts |

Include the worked example (`assets/example-layered/robot.svg`), a "what a good export looks like" snippet, and a short troubleshooting section keyed by the **actual error messages** a user will see — quote them from `layer-ingest.js` and `mcp/tools.mjs:199-204` so searching the error text finds the guide.

State honest limit #3: the example is hand-authored to these rules, not a captured real-world export.

- [ ] **Step 3: Verify every claim against the code**

For each rule in your table, name the file:line that implements it. If you cannot find one, the rule is folklore — remove it or fix it. Put this mapping in your report.

- [ ] **Step 4: Commit**

```bash
git add docs/guides/exporting-layers.md
git commit -m "docs: add the Figma/Illustrator layer-export guide"
```

- [ ] **Step 5: Report back**

The rule → file:line mapping from Step 3, and any rule you dropped as unverifiable.

---

### Task 4: Flip the README

**Files:**
- Modify: `README.md`

This is the load-bearing task. `README.md:8-12` is the single most important sentence in the repo.

- [ ] **Step 1: Flip the four raster-leading positions**

1. **Headline (`README.md:8-12`)** — currently *"Hand a flat image to your AI agent; it rigs the parts by vision and hands you back an animated web component you own."* Rewrite so layered leads: a designer's named layers become an owned, animated, data-bindable component. Keep the "you own it" claim — that is the real differentiator and it is true. Keep the sentence roughly as short as it is now.
2. **Executive framing (`README.md:45-49`)** — currently opens *"takes a flat raster image (PNG, pixel-art first)"*. Lead with layered; keep raster as the labelled fallback.
3. **Pipeline diagram (`README.md:97-113`)** — currently `image.png → P1 Vectorize → P2 Segment → P3 Emit`, which implies vectorise-then-segment is mandatory. Show the layered path entering at the rig step and **skipping P1/P2**, with the raster path as the second, labelled-fallback branch.
4. **Quickstart (`README.md:224-259`)** — currently entirely raster. The first thing a newcomer is told to do becomes: drop `assets/example-layered/robot.svg` into the rig editor. Link the export guide from Task 3.

- [ ] **Step 2: Add the honest limits**

All four from the top of this plan, in user-facing prose, not a footnote. In particular fix the internal inconsistency at `README.md:220-222`, where the "Honest scope" callout sits directly under the layered alt-entry paragraph and reverts to raster-only framing.

- [ ] **Step 3: Do not delete the raster path**

It is a real, working, documented fallback with a genuine use (no layered source exists). Demote it, label it, keep it accurate.

- [ ] **Step 4: Verify every surviving claim**

Re-read the whole README and check each factual claim against the code. Report anything you found that was already wrong — the exploration flagged that `docs/launch/README.md:10`'s "Premium input path… full fidelity" is narrower than it sounds; expect similar.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(README): lead with layered SVG; raster becomes a labelled fallback"
```

- [ ] **Step 6: Report back**

The old and new headline side by side, how you redrew the pipeline diagram, where the four honest limits landed, and any pre-existing incorrect claim you found.

---

### Task 5: The satellite docs

**Files:**
- Modify: `mcp/README.md`, `docs/README.md`, `docs/product-discovery.md`, `docs/technical-proposal.md`

- [ ] **Step 1: `mcp/README.md`**

`mcp/README.md:29-31` makes `forge_start_from_image` step 1 of the guided loop with layered as a parenthetical. Swap the emphasis: layered leads, image is the fallback. State honest limit #1 (rect + path only) **at the tool description**, not only in a limits list — that is where an agent author will read it.

- [ ] **Step 2: `docs/README.md`**

It designates `product-discovery.md` and `technical-proposal.md` as "Start here". Both are raster-framed and predate ADR-0011. Repoint "Start here" at the current story — the README and the new export guide — and describe the other two as the historical record they are.

- [ ] **Step 3: Banner the two dated docs**

Add a short dated note at the top of `docs/product-discovery.md` and `docs/technical-proposal.md`: written before ADR-0011, the product now leads with layered SVG, see the README and the export guide. **Do not rewrite their bodies.** They are records of what was understood at the time — the same annotate-never-rewrite rule stages 1 and 2 used on their own specs and plans.

- [ ] **Step 4: Full verification**

```bash
node tools/gate/check-all.mjs
```
```bash
pwsh -NoProfile -File tools/check-e2e.ps1
```

Expected: `RESULT: PASS`; the e2e count Task 2 established.

- [ ] **Step 5: Check the repo no longer contradicts itself**

```bash
grep -rn "flat raster image\|Hand a flat image\|takes a flat" --include=*.md . | grep -v node_modules | grep -v "docs/plans/\|docs/research/\|docs/superpowers/\|\.superpowers/\|docs/adr/\|docs/internal/"
```

Every remaining hit should be either an intentional description of the fallback or a dated record. Report the list and your judgement on each.

- [ ] **Step 6: Commit**

```bash
git add mcp/README.md docs/README.md docs/product-discovery.md docs/technical-proposal.md
git commit -m "docs: point the satellite docs at the layered-first story"
```

- [ ] **Step 7: Report back**

The Step 5 grep output with your per-hit judgement, and confirmation the two dated docs' bodies are unchanged (`git diff --stat` should show only the banner lines).

---

## Acceptance

- `assets/example-layered/robot.svg` ingests cleanly through **both** the browser editor and `forge_start_from_layered_svg`, proven by tests rather than inspection.
- `tests/e2e/drop-layered.spec.mjs` drives that file through the real `#file` input to a real download.
- `README.md`'s headline, framing, pipeline diagram and quickstart lead with layered; raster is present, accurate and labelled a fallback.
- `docs/guides/exporting-layers.md` exists and leads with the transform rule.
- All four honest limits appear in user-facing docs.
- `product-discovery.md` and `technical-proposal.md` carry dated banners; bodies unchanged.
- Gate `RESULT: PASS`; e2e at the count Task 2 established; goldens unmoved; no root `package.json`; MCP tools 10.
