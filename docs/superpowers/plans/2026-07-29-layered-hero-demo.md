# Layered Hero Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a hero that was a dangling reference to a nonexistent GIF with a live demo page that is generated from the committed layered asset, gated twice, and works whether or not anyone ever records a video of it.

**Architecture:** Mirror the structure that already stopped this exact rot for the raster hero — a no-live-agent generator, a committed artifact, and a freshness golden that rebuilds from the same recipe and demands a byte match. Add a behavioural e2e on top, because a fresh artifact can still be visually broken.

**Tech Stack:** Pure ESM, existing MCP tools, Playwright. No new dependencies.

**Spec:** [docs/superpowers/specs/2026-07-29-layered-hero-demo-design.md](../specs/2026-07-29-layered-hero-demo-design.md)

## Global Constraints

- **NEVER create a root `package.json`.** The gate asserts its absence.
- **MCP tool count is locked at exactly 10.** This plan adds none — it *calls* the existing tools.
- **`mcp/build-smiley-demo.mjs` and `docs/buildable-slice/mcp-smiley/*` must be byte-unchanged.** They are gated goldens for the raster hero, which stays exactly as it is.
- `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` remain byte-for-byte goldens. If one moves, STOP and report.
- **Never commit a regenerable artifact without its gate in the same commit.** That is the precise failure this stage exists to undo.
- **The agent captures no GIF or screenshot.** They time out in this environment. Recording stays an owner step.
- Gate after every task: `node tools/gate/check-all.mjs` → `RESULT: PASS`.
- E2E is **26** today; Task 2 adds one spec file — report the true count.
- Do not delete any tracked file. Do not push.
- Commit bodies end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Domain Orientation

`mascot-forge` turns artwork into an owned, animated SVG mascot whose animation states bind to live app data. Stages 1-3 hardened the layered-SVG ingest, made the gate cross-platform, and flipped the docs to lead with layered input.

The hero demo is the first thing a visitor sees. Today `docs/buildable-slice/mcp-live-demo.html` is the "live-data hero" — but it is built from a **PNG through the raster path**, the path now demoted. And the README embedded `docs/hero-mcp-live.gif`, **a file that never existed**, until stage 3 removed the dangling embed.

`mcp/smiley-golden.test.mjs` exists because the raster hero's artifact was regenerable but ungated and rotted two feature waves behind the engine — shipping a scale origin 7 units below a 5-unit-tall part, so every blink yanked the eyes 12% of the frame down the face. That test is the model to copy.

---

### Task 1: The generator, the artifact, and its freshness gate

**Files:**
- Create: `mcp/build-robot-demo.mjs`, `mcp/robot-golden.test.mjs`
- Create (generated, committed): `docs/buildable-slice/layered-robot/*`
- Modify: `tools/gate/check-all.mjs` (P6 row)

**These ship in ONE commit.** Committing the artifact before its gate — even briefly — recreates the exact ungated-artifact condition this stage exists to eliminate.

**Interfaces produced:** `export function buildRobot({ outDir })`, consumed by `robot-golden.test.mjs` and by Task 2's page.

- [ ] **Step 1: Read the model you are mirroring**

`mcp/build-smiley-demo.mjs` — note its shape: it imports the real tools (`startFromImage`, `setPart`, `forgeEmit`) rather than reimplementing anything, and exports `buildSmiley({ outDir })` so the golden test can rebuild from the identical recipe.

`mcp/smiley-golden.test.mjs` — note that freshness is asserted by rebuilding into a **gitignored `out/` inside the repo**, not the OS temp dir, because `safePath()` refuses paths outside the project root.

- [ ] **Step 2: Write `mcp/build-robot-demo.mjs`**

Same shape as the smiley generator, but driving the **layered** entry point. Import `startFromLayeredSvg`, `setPart` and `forgeEmit` from `./tools.mjs` — call them, never reimplement rig or emit logic.

Source: `assets/example-layered/robot.svg` (committed in stage 3, proven on both ingest paths).

Rig plan — every preset below is real; verified against `presetsFor(role, state)`:

| Part | Role | Bone | Presets |
|---|---|---|---|
| `part-body` | `core` | `body` | idle: `breathe` |
| `part-head` | `accent` | `head` | idle: `glance`, alert: `nod` |
| `part-antenna` | `accent` | `antenna` | idle: `twitch`, alert: `pulse` |
| `part-left-arm` | `limb` | `arm-left` | active: `walk` |
| `part-right-arm` | `limb` | `arm-right` | active: `walk-mirror` |
| `part-left-leg` | `limb` | `leg-left` | active: `walk-mirror` |
| `part-right-leg` | `limb` | `leg-right` | active: `walk` |

Legs are deliberately opposite their same-side arms — that is what makes a gait read as walking rather than hopping. All three states (`idle`, `active`, `alert`) get at least one animated part, which the validator requires; a state with zero recipes warns.

Export `buildRobot({ outDir = DEFAULT_OUT_DIR } = {})` and give the file a `main`-style invocation so `node mcp/build-robot-demo.mjs` regenerates the committed artifact, exactly as the smiley one does.

- [ ] **Step 3: Generate the artifact and look at what came out**

```bash
node mcp/build-robot-demo.mjs
```

Then inspect it — do not just trust exit 0:

```bash
node -e "const fs=require('node:fs');const d='docs/buildable-slice/layered-robot';for(const f of fs.readdirSync(d)){const t=fs.readFileSync(d+'/'+f,'utf8');console.log(f, t.length+'b');}"
```

Then check the thing that actually broke last time — pivots:

```bash
node -e "
const fs=require('node:fs');
const svg=fs.readFileSync('docs/buildable-slice/layered-robot/robot-svg-css.generated.svg','utf8');
for(const m of svg.matchAll(/#(part-[a-z-]+)\s*\{\s*transform-origin:\s*([^;]+);/g)){
  const [,id,origin]=m; const pcts=origin.match(/-?\d+(\.\d+)?%/g)||[];
  const wild=pcts.some(p=>{const v=parseFloat(p); return v<-25||v>125;});
  console.log((wild?'WILD ':'ok   ')+id, origin.trim());
}
"
```

Adjust the filename if the emitter names it differently. **Any `WILD` row means a pivot outside -25..125% of its own box — that is the smiley bug's signature.** Stop and report rather than committing it.

- [ ] **Step 4: Write `mcp/robot-golden.test.mjs`**

Mirror `mcp/smiley-golden.test.mjs`:

1. **Freshness** — rebuild via `buildRobot()` into a gitignored `out/` path inside the repo and assert every committed file matches the fresh build byte-for-byte (normalising CRLF the way the smiley test does).
2. **Pivot sanity** — assert no emitted part origin falls outside -25..125% of its own box. This is the assertion that would have caught the original rot.

Head the file with why it exists, as the smiley test does. A future reader should not have to guess.

- [ ] **Step 5: Wire it into the gate**

In `tools/gate/check-all.mjs`, add `robot-golden` to the **P6 mcp** row's test list. Keep the list's existing order convention.

- [ ] **Step 6: Prove the gate actually fails without the artifact being fresh**

Temporarily change one committed artifact file (add a space to the CSS), run:

```bash
node mcp/robot-golden.test.mjs
```

Expected: **FAIL** on the freshness assertion. Then regenerate (`node mcp/build-robot-demo.mjs`) and confirm it passes. Record both outputs. A freshness gate that cannot detect a stale artifact is decoration — and this is the one assertion whose absence caused the original incident.

- [ ] **Step 7: Verify and commit**

```bash
node tools/gate/check-all.mjs
```
```bash
git status --short
```

`git status` must show your new files and **nothing under `docs/buildable-slice/mcp-smiley/`**.

```bash
git add mcp/build-robot-demo.mjs mcp/robot-golden.test.mjs docs/buildable-slice/layered-robot tools/gate/check-all.mjs
git commit -m "feat(demo): no-live-agent layered build + committed artifact, freshness-gated"
```

- [ ] **Step 8: Report back**

The Step 3 file listing and the pivot check in full, the Step 6 fail-then-pass evidence verbatim, the gate's final line, and `git status --short` proving the smiley artifact is untouched.

---

### Task 2: The hero page and the e2e that proves it animates

**Files:**
- Create: `docs/buildable-slice/layered-live-demo.html`, `tests/e2e/layered-hero.spec.mjs`

**Interfaces consumed:** the artifact from Task 1.

- [ ] **Step 1: Read the page you are mirroring**

`docs/buildable-slice/mcp-live-demo.html` is the existing live-data hero. Note how it binds state to a simulated feed via `runtime/mascot-state.js` — that binding is the product's real differentiator, and the new page must keep it. Only the mascot's *source and provenance* change.

- [ ] **Step 2: Write the page**

It must:

- Load the Task 1 artifact.
- Bind states to a simulated live feed, cycling `idle → active → alert`, the same shape as the existing hero.
- Say plainly, in visible copy, that this mascot came from **named layers in a hand-authored layered SVG** (`assets/example-layered/robot.svg`) — the provenance is the point of the demo, not decoration.
- Link the export guide (`docs/guides/exporting-layers.md`) so a visitor who wants to try it knows how to prepare their own file.

Keep it self-contained and dependency-free, like its sibling.

- [ ] **Step 3: Write the e2e — and measure motion, not existence**

`tests/e2e/layered-hero.spec.mjs`. Asserting that elements exist would pass on a completely frozen page, which is exactly how the previous hero shipped broken.

This repo's established technique: **seek animations deterministically** rather than sampling on a timer, because timer sampling misses short keyframe windows.

```js
// Seek the part's animation to a known time and measure real displacement. Sampling on a timer misses
// short keyframe windows — that is how the previous hero shipped visibly broken while "passing".
const drift = await page.evaluate(() => {
  const el = document.querySelector("#part-left-arm");
  const anims = el.getAnimations();
  if (!anims.length) return { error: "no animations on part-left-arm" };
  const a = anims[0];
  a.pause();
  a.currentTime = 0;
  const t0 = el.getBoundingClientRect();
  a.currentTime = (a.effect.getTiming().duration) / 2;
  const t1 = el.getBoundingClientRect();
  return { dx: Math.abs(t1.x - t0.x), dy: Math.abs(t1.y - t0.y), rot: t1.width - t0.width };
});
expect(drift.error).toBeUndefined();
expect(drift.dx + drift.dy + Math.abs(drift.rot)).toBeGreaterThan(0.5);
```

Adjust the part id and the state that animates it to match what the page actually renders — `part-left-arm` animates in `active`, so the page may need to be in that state first. Report any adjustment.

Assert as well that switching state changes which animation is running, since that is the live-data claim.

- [ ] **Step 4: Negative control**

Break it deliberately: in a scratch copy, remove the animation (or point the selector at a part with no preset) and confirm the test fails. A motion assertion that passes on a frozen page is worthless. Record the failure, then restore.

- [ ] **Step 5: Run and commit**

```bash
pwsh -NoProfile -File tools/check-e2e.ps1
```

Report the true count (26 before this task).

```bash
node tools/gate/check-all.mjs
```
```bash
git add docs/buildable-slice/layered-live-demo.html tests/e2e/layered-hero.spec.mjs
git commit -m "feat(demo): layered live-data hero page, proven to animate"
```

- [ ] **Step 6: Report back**

The measured drift numbers, the negative-control failure, the true e2e count, any selector or state you adjusted, and the gate's final line.

---

### Task 3: Point the README and CONTRIBUTING at it

**Files:**
- Modify: `README.md`, `CONTRIBUTING.md`

- [ ] **Step 1: README hero slot**

The hero slot currently holds a `<!-- HERO SLOT (P-D) … -->` comment (stage 3 removed the dangling embed) and prose pointing at the **raster** demo.

Point it at `docs/buildable-slice/layered-live-demo.html` as the primary demo. Keep `mcp-live-demo.html` referenced as the **raster** example — it is real, working and correctly labelled, and deleting it would be its own dishonesty.

**Embed no image that does not exist.** That is the defect this whole stage started from. The hero slot comment stays, so a future capture has a home.

- [ ] **Step 2: Mention the no-live-agent reproduction**

The README describes `mcp/build-smiley-demo.mjs` as "a runnable, no-live-agent reproduction of the whole raster loop". Add its layered counterpart — `node mcp/build-robot-demo.mjs` — described the same way. That claim is now true for both paths, and it is the strongest single answer to "does this actually work?".

- [ ] **Step 3: CONTRIBUTING capture recipe**

Update the hero capture instructions to point at the new page. Make explicit that capturing is **optional** — the README links a working demo either way. That is the inversion this stage is for: a recording is an upgrade, not a prerequisite.

- [ ] **Step 4: Verify**

```bash
node -e "const fs=require('node:fs'),path=require('node:path');let bad=0;for(const f of ['README.md','CONTRIBUTING.md']){const t=fs.readFileSync(f,'utf8');for(const m of t.matchAll(/\]\(([^)#:]+?)(?:#[^)]*)?\)/g)){const r=m[1].trim();if(/^(https?:|mailto:)/.test(r))continue;if(!fs.existsSync(path.resolve('.',r))){console.log('BROKEN',f,'->',r);bad++;}}}console.log(bad===0?'ALL LINKS RESOLVE':'BROKEN: '+bad);"
```

Expected: `ALL LINKS RESOLVE`. Also grep for any surviving embed of a nonexistent image:

```bash
node -e "const fs=require('node:fs'),path=require('node:path');const t=fs.readFileSync('README.md','utf8');let bad=0;for(const m of t.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)){const r=m[1].trim();if(/^https?:/.test(r))continue;if(!fs.existsSync(path.resolve('.',r))){console.log('BROKEN EMBED ->',r);bad++;}}console.log(bad===0?'NO BROKEN EMBEDS':'BROKEN EMBEDS: '+bad);"
```

Expected: `NO BROKEN EMBEDS`.

```bash
node tools/gate/check-all.mjs
```

- [ ] **Step 5: Commit and report**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: point the hero at the layered live demo"
```

Report both verification outputs and the gate's final line.

---

## Acceptance

- `node mcp/build-robot-demo.mjs` regenerates the committed artifact from `assets/example-layered/robot.svg` with no live agent.
- `mcp/robot-golden.test.mjs` fails on a stale artifact — demonstrated, not assumed — and runs in the gate's P6 row.
- No emitted part pivot falls outside -25..125% of its own box.
- `docs/buildable-slice/layered-live-demo.html` animates, proven by measured displacement under a seeked animation.
- README points at it; **no embedded image references a nonexistent file**; the hero slot comment survives for a future capture.
- `mcp/build-smiley-demo.mjs` and `docs/buildable-slice/mcp-smiley/*` are byte-unchanged.
- Gate `RESULT: PASS`; e2e at the count Task 2 established; MCP tools 10; no root `package.json`.
