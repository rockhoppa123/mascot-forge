# Cold-Start & Honesty Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the cold-start dead-end and stop the engine asserting things it hasn't detected, so an agent that follows the documented flow gets a working mascot instead of a hard failure and a ghost with legs.

**Architecture:** Four point fixes to existing pure modules (`tools/rig-editor/segment.js`, `mcp/tools.mjs`) plus a docs-honesty pass. No new modules, no new deps, no new MCP tools. The naming fix exploits machinery that already exists — `partId(hint, fallback)` in `segment.js:44` already carries an honest *geometric* hint alongside the anatomical fallback, and a per-asset `parts-spec.json` already overrides it authoritatively.

**Tech Stack:** Node ESM (no build), `node:assert/strict` (no framework), PowerShell gate scripts, Playwright e2e (dev-dep only).

**Source:** the 2026-07-25 final playtest. Cold-started the documented flow on 3 unseen assets — `forge_start_from_image → forge_propose → forge_emit` failed **3 of 3** with `rig has no animation in any state`, while `forge_propose` reported `advisory: (none)`.

## Investigation already done (do not redo)

- **DevBrain's golden names come from `assets/devbrain/parts-spec.json`**, which maps `hint → id` (`largest-blob → part-body`, `below-body-left → part-leg-left`, …). `partId(hint, fallback)` returns the spec's id when a hint matches, else the fallback. **Therefore changing the fallbacks cannot affect any asset that ships a parts-spec** — the DevBrain buildable-slice goldens and the e2e suite (which loads the committed `devbrain-segmented.svg`) are unaffected. Verified by reading `segment.js:44` and the spec.
- `segment.js` already has a neutral `part-1..N` fallback for the "only the body matched" case (`segment.js:~107`). It is not being changed; the anatomical fallbacks are the defect.
- The only test that encodes the anatomical fallbacks is `tools/rig-editor/segment-quality.test.mjs:56-64` ("mascot silhouette -> semantic part names"). Task 1 updates it deliberately.
- **Pre-cleared, do not chase:** `mcp/regions-preview.test.mjs` and the e2e specs mention `part-eyes`/`part-leg-left`, but as *literal fixtures* or as ids loaded from the committed DevBrain `segmented.svg` (parts-spec-driven) — not from the default vocab. `grep` over `docs/gallery/` found no references to the auto names. Nothing outside `segment-quality.test.mjs` needs editing; if a golden does move, STOP and report rather than updating it.

## Global Constraints

_Every task's requirements implicitly include these — copied verbatim from the project's standing rules._

- Runtime (`runtime/`) AND browser editor (`tools/rig-editor/`) stay **ZERO-dependency, pure ESM, NO build step**. New deps only in `mcp/`.
- **MCP tool count is a locked contract: 10 tools** (`mcp/protocol.test.mjs`). Do not add or remove tools; extend existing responses only.
- Golden round-trips (`tools/rig-editor/exporter.test.mjs`), the buildable-slice checks, and `mcp/smiley-golden.test.mjs` stay green.
- `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` are goldens — **do not regenerate or edit**.
- SVG+CSS remains the DEFAULT Output Target; React+GSAP is opt-in.
- Tests use `node:assert/strict`, no framework, mirroring existing `*.test.mjs`.
- **Gate after EVERY task:** `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → must print `RESULT: PASS` (P1–P7). Re-run `pwsh -NoProfile -File tools/check-e2e.ps1` (expect 20 passed) after any `tools/` or editor change.
- One logical change per commit; end each commit body with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Match the existing terse comment style. Change only what the task calls for.

## Files touched (by task)

| Task | Fix | Primary file(s) | Test file(s) | e2e re-run? |
|---|---|---|---|---|
| 1 | Honest naming | `tools/rig-editor/segment.js` | `tools/rig-editor/segment-quality.test.mjs` | yes |
| 2 | Cold-start advisory | `mcp/tools.mjs` | `mcp/tools.test.mjs` | no |
| 3 | Tear warning | `mcp/tools.mjs` | `mcp/tools.test.mjs` | no |
| 4 | Docs honesty | `README.md`, `docs/adr/0007-*.md`, `CHANGELOG.md` | — (docs) | no |

Tasks 1–3 are independent; 4 documents 1–3 and runs last.

---

### Task 1: Name unspec'd parts by geometry, not anatomy

**Files:**
- Modify: `tools/rig-editor/segment.js` (the five `partId(...)` fallback arguments, ~lines 82-98; `DEFAULT_VOCAB` line 12; `PART_COLOURS` lines 14-15)
- Test: `tools/rig-editor/segment-quality.test.mjs` (update case 5, append a new case)

**Interfaces:**
- Consumes: `partId(hint, fallback)` — returns the parts-spec's id when `hint` is mapped, else `fallback`.
- Produces: with **no** parts-spec, proposed ids describe *position*, not anatomy. With a parts-spec, ids are unchanged (spec wins).

**Root cause:** the geometry heuristic infers "below the body ⇒ leg", "above the body ⇒ antenna", "colour island in the upper body ⇒ eyes". On a ghost that produced `part-leg-right` (bbox covering nearly the whole image) and `part-antenna` (the top of its head); on a T-Rex it labelled the head `part-eyes`. The geometry is a real signal; the anatomical *name* is an unearned assertion that misleads an agent into rigging limbs the subject does not have.

**Naming scheme** (positional, reads as "rename me"):

| Hint | Old fallback | New fallback |
|---|---|---|
| `largest-blob` | `part-body` | `part-body` (**unchanged** — largest mass is defensible for any subject, and it maps to the `core` role) |
| `below-body-left` | `part-leg-left` | `part-lower-left` |
| `below-body-right` | `part-leg-right` | `part-lower-right` |
| `above-body` | `part-antenna` | `part-upper` |
| `colour-island-upper` | `part-eyes` | `part-island-1` / `part-island-2` |

The two eye candidates currently share one id (`part-eyes`); positional names must be distinct per blob, so index them.

- [ ] **Step 1: Update the stale test case and add the new guarantee**

In `tools/rig-editor/segment-quality.test.mjs`, replace case 5 (line ~56-64) with:

```js
ok("mascot silhouette -> POSITIONAL part names (no unearned anatomy)", () => {
  const parts = partsOf([
    { x: 10, y: 10, w: 20, h: 20, fill: "#ccc" }, // body
    { x: 12, y: 30, w: 4, h: 10, fill: "#333" },  // blob below
    { x: 18, y: 2, w: 4, h: 8, fill: "#3c3" },    // blob above
    { x: 14, y: 14, w: 2, h: 2, fill: "#000" },   // colour island
  ], 48);
  // geometry is a real signal; "leg"/"antenna"/"eyes" is not. Without a parts-spec the segmenter
  // must describe WHERE a blob is, never WHAT it is — an agent renames it by vision.
  assert.deepEqual(parts.map((p) => p.id), ["part-body", "part-lower-left", "part-upper", "part-island-1"]);
});

ok("no unspec'd proposal asserts anatomy", () => {
  const parts = partsOf([
    { x: 10, y: 10, w: 20, h: 20, fill: "#ccc" },
    { x: 12, y: 30, w: 4, h: 10, fill: "#333" },
    { x: 24, y: 30, w: 4, h: 10, fill: "#334" },
    { x: 18, y: 2, w: 4, h: 8, fill: "#3c3" },
    { x: 14, y: 14, w: 2, h: 2, fill: "#000" },
    { x: 20, y: 14, w: 2, h: 2, fill: "#001" },
  ], 48);
  const anatomy = /leg|antenn|eye|arm|tail|mouth|ear|head|wing/i;
  for (const p of parts) {
    assert.ok(!anatomy.test(p.id), `proposed id '${p.id}' asserts anatomy the segmenter cannot know`);
  }
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `node tools/rig-editor/segment-quality.test.mjs`
Expected: FAIL — ids are still `part-leg-left`, `part-antenna`, `part-eyes`.

- [ ] **Step 3: Change the fallbacks** — in `tools/rig-editor/segment.js`:

Line 12, replace `DEFAULT_VOCAB`:
```js
// Positional, not anatomical: without a parts-spec the segmenter knows WHERE a blob sits, never WHAT
// it is. Naming a ghost's head-top "part-antenna" invents anatomy and misleads the rigging agent.
const DEFAULT_VOCAB = ["part-body", "part-lower-left", "part-lower-right", "part-upper", "part-island-1", "part-island-2"];
```

Lines 14-15, rekey `PART_COLOURS`, keeping the existing colour values in the same order. **Keep the `part-moustache` entry** — verified: no `partId("below-eyes", …)` call exists, so `part-moustache` is reachable only when a parts-spec names it (DevBrain's spec lists it), and a spec id must still resolve to a colour:
```js
  "part-body": "#c9ced1", "part-lower-left": "#ff7f0e", "part-lower-right": "#1f77b4",
  "part-upper": "#2ca02c", "part-island-1": "#d62728", "part-island-2": "#9467bd",
  "part-moustache": "#9467bd", "part-leg-left": "#ff7f0e", "part-leg-right": "#1f77b4",
  "part-antenna": "#2ca02c", "part-eyes": "#d62728",
```
The old anatomical keys stay because a **parts-spec** (DevBrain's) still produces them — they are now spec-only ids, no longer defaults. Dropping them would leave the DevBrain preview uncoloured.

Lines ~87-98, the four fallback arguments:
```js
  if (legBlobs.length >= 1) legBlobs[0].part = partId("below-body-left", "part-lower-left");
  if (legBlobs.length >= 2) legBlobs[legBlobs.length - 1].part = partId("below-body-right", "part-lower-right");
```
```js
  for (const a of rest.filter((b) => b.part === null && b.minY < body.minY))
    a.part = partId("above-body", "part-upper");
```
```js
  eyeCandidates.slice(0, 2).forEach((e, i) => { e.part = partId("colour-island-upper", `part-island-${i + 1}`); });
```

**Note on the pivot rule at line ~136:** it special-cases `id === "part-antenna"` for a base-centre pivot. That rule is keyed to the *antenna* concept, which now only exists when a parts-spec names it — which is exactly right, so leave the string as `"part-antenna"`. Confirm by reading the surrounding block that no other branch depends on a renamed id.

- [ ] **Step 4: Run it, verify it passes**

Run: `node tools/rig-editor/segment-quality.test.mjs`
Expected: PASS — all 11 cases (10 existing + 1 appended).

- [ ] **Step 5: Prove the DevBrain golden is untouched**

Run: `node tools/rig-editor/segment.test.mjs && node tools/rig-editor/loader.test.mjs && pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-segmented.ps1`
Expected: PASS, and `check-segmented` still reports `parts : 5 (part-body, part-leg-left, part-leg-right, part-antenna, part-eyes)` — proving the parts-spec still wins.

- [ ] **Step 6: Full gate + e2e + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1   # RESULT: PASS
pwsh -NoProfile -File tools/check-e2e.ps1                            # 20 passed
git add tools/rig-editor/segment.js tools/rig-editor/segment-quality.test.mjs
git commit -m "fix(segment): name unspec'd parts by position, not invented anatomy"
```

---

### Task 2: `forge_propose` and `forge_status` must not be silent about an unriggable rig

**Files:**
- Modify: `mcp/tools.mjs` (`forgePropose` ~line 234, `forgeStatus`)
- Test: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Produces: when no part carries an animatable role, `forgePropose(...)` and `forgeStatus(...)` both return a non-null `advisory` naming the exact next call. The existing silhouette advisory still fires and is not replaced.

**Root cause:** `parseSegmented` yields every part with `role: "passive"` (role is the agent's judgment, by design — ADR-0002). `DEFAULT_PRESET` has no `passive` entry, so `planFor` recommends `null` for every part, so `forgeEmit`'s auto-fill fills nothing and validation fails with `rig has no animation in any state`. `forge_propose` — the designated human checkpoint — reported `advisory: (none)` while every part was inert. The failure is only discovered one tool call later.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```js
// COLD-START GUARD: a freshly-proposed rig has no roles (role is the agent's judgment), so nothing
// can animate and forge_emit hard-fails. propose/status are the checkpoints BEFORE that failure —
// they must say so and name the fix, not report "(none)" while every part is inert.
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4 });
  const prop = forgePropose({ session: s.session });
  assert.ok(prop.plan.every((p) => !p.recommended), "precondition: a fresh proposal recommends nothing");
  assert.ok(prop.advisory, "propose must not be silent when nothing can animate");
  assert.match(prop.advisory, /role/i, "the advisory names roles as the fix");
  assert.match(prop.advisory, /set_part|assign_region/, "the advisory names the tool to call");

  const st = forgeStatus({ session: s.session });
  assert.ok(st.advisory, "status must not be silent either");
  assert.match(st.advisory, /role/i, "status advisory names roles as the fix");

  // and once a role IS assigned, the advisory clears and emit succeeds
  setPart({ session: s.session, partId: prop.plan[0].id, role: "core" });
  const after = forgePropose({ session: s.session });
  assert.equal(after.advisory, null, "advisory clears once something can animate");
  assert.equal(forgeEmit({ session: s.session, assetName: "coldstart" }).ok, true, "emit now succeeds");
}

// the two advisories COMPOSE: a silhouette input with no roles must surface both problems, not just
// whichever check runs first (regression guard for the compose logic in forgePropose).
{
  const mono = startFromImage({ base64: monoPngBase64(), colors: 2 });
  const a = forgePropose({ session: mono.session }).advisory;
  assert.ok(a, "a silhouette with no roles gets an advisory");
  assert.match(a, /silhouette|single-colour|one region|whole-body/i, "the silhouette problem is stated");
  assert.match(a, /role/i, "the no-role problem is ALSO stated");
}
```

`monoPngBase64` is the existing single-colour helper used by the silhouette-advisory test already in this file — reuse it; if it is named differently, use whatever that test uses rather than defining a new one.

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — `propose must not be silent when nothing can animate` (`advisory` is `null`).

- [ ] **Step 3: Add the shared advisory helper** — in `mcp/tools.mjs`, above `forgePropose`:

```js
// The cold-start dead-end: a fresh proposal is all-passive, so nothing animates and forge_emit fails
// validation. Say so at the checkpoint that comes BEFORE the failure, and name the exact next call.
function noRoleAdvisory(model) {
  const ids = Object.keys(model.parts()).filter((id) => model.rectsOf(id).length > 0);
  const withRole = ids.filter((id) => (model.parts()[id].role || "passive") !== "passive");
  if (withRole.length) return null;
  return `No part has a role yet, so nothing will animate and forge_emit will fail. Roles are yours to ` +
    `judge from the image — the segmenter only proposes regions. Assign one with set_part ` +
    `({ partId, role }) or assign_region ({ box, partId, role }): core = the main body (breathes), ` +
    `limb = an arm/leg (walks, hinges at its joint), accent = a small mover (blinks/pulses), ` +
    `passive = stays still. At minimum give one part 'core'.`;
}
```

- [ ] **Step 4: Wire it into both tools** — in `forgePropose`, replace the advisory line so the silhouette advisory and the no-role advisory compose (silhouette first, since it changes the whole approach):

```js
  const silhouette = grade.grade === "silhouette"
    ? `${grade.recommendation} For now, rig it as ONE whole-body part (Simple tier: a single 'idle' with breathe/sway) rather than carving fake limbs from a single-colour shape.`
    : null;
  const noRole = noRoleAdvisory(s.model);
  const advisory = [silhouette, noRole].filter(Boolean).join(" ") || null;
```

In `forgeStatus`, add `advisory` to its returned object:

```js
  return { parts: partList(s.model), rigStatus: rigStatus(s.model), ungroupedRects: ungrouped, advisory: noRoleAdvisory(s.model) };
```

(Read `forgeStatus`'s existing return statement first and preserve every field it already returns — only add `advisory`.)

- [ ] **Step 5: Run it, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS.

- [ ] **Step 6: Surface it in the tool descriptions** — in `mcp/server.mjs`, append to `forge_propose`'s description:

```
Returns `advisory` when the rig cannot animate yet (no roles assigned) — read it out and act on it before forge_emit.
```

- [ ] **Step 7: Verify the 10-tool lock, then gate + commit**

```bash
cd mcp && node protocol.test.mjs && node server.test.mjs   # all ten tools
cd .. && pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add mcp/tools.mjs mcp/server.mjs mcp/tools.test.mjs
git commit -m "fix(mcp): propose/status warn when no role is assigned instead of failing at emit"
```

---

### Task 3: Warn when an animated part overlaps an inert one

**Files:**
- Modify: `mcp/tools.mjs` (`forgePropose`)
- Test: `mcp/tools.test.mjs` (append)

**Interfaces:**
- Produces: `forgePropose(...).tearRisks` — an array of `{ a, b, overlap }` for pairs where one part will animate and the other will not, and their bboxes overlap by more than 50% of the smaller box. Empty array when clean.

**Root cause:** during the playtest a rig with a passive "legs" part overlapping an animated cape by 83% tore visibly — the cape swung while geometry sitting on top of it stayed put. Nothing warns. This is precisely the "wrong pieces connected/disconnected" class the user reported.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```js
// TEAR RISK: if an animated part and an INERT part share most of their box, the moving one visibly
// separates from the still one. Surface it at the checkpoint rather than letting the human discover
// it by watching the mascot come apart. Built from an explicit layered SVG so the overlap is exact
// and the assertion can name the pair — a synthetic PNG's segmentation is not precise enough to
// assert against, and "it returned an array" would pass even if detection never fired.
{
  const rig =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<g id="mover"><rect x="10" y="10" width="60" height="60" fill="#a11"/></g>' +
    '<g id="stiller"><rect x="20" y="20" width="40" height="40" fill="#1a1"/></g>' +   // fully inside mover
    '<g id="faraway"><rect x="80" y="80" width="15" height="15" fill="#11a"/></g>' +   // no overlap
    '</svg>';
  const s = startFromLayeredSvg({ svg: rig });
  setPart({ session: s.session, partId: "mover", role: "core" });      // will animate (breathe)
  setPart({ session: s.session, partId: "stiller", role: "passive" }); // stays put -> tears
  setPart({ session: s.session, partId: "faraway", role: "passive" });

  const risks = forgePropose({ session: s.session }).tearRisks;
  assert.equal(risks.length, 1, `exactly one tear risk expected, got ${JSON.stringify(risks)}`);
  const pair = [risks[0].a, risks[0].b].sort();
  assert.deepEqual(pair, ["part-mover", "part-stiller"], "the overlapping animated/inert pair is named");
  assert.ok(risks[0].overlap > 0.9, `stiller sits fully inside mover, so overlap ~1 (got ${risks[0].overlap})`);
  assert.ok(!JSON.stringify(risks).includes("faraway"), "a non-overlapping part is not flagged");

  // and when nothing is inert, there is nothing to tear against
  setPart({ session: s.session, partId: "stiller", role: "accent" });
  assert.deepEqual(forgePropose({ session: s.session }).tearRisks, [],
    "two ANIMATED overlapping parts are not a tear risk — they move together");
}
```

`startFromLayeredSvg` is already imported at the top of `mcp/tools.test.mjs`; verify before adding it. Part ids are auto-prefixed with `part-`, hence `part-mover` in the assertion.

- [ ] **Step 2: Run it, verify it fails**

Run: `cd mcp && node tools.test.mjs`
Expected: FAIL — `tearRisks` is `undefined`.

- [ ] **Step 3: Implement** — in `mcp/tools.mjs`, add above `forgePropose`:

```js
// A part that animates while geometry overlapping it stays put visibly tears apart. Compare each
// pair's bbox overlap as a fraction of the SMALLER box, so a small part sitting inside a big one counts.
function tearRisksFor(model, plan) {
  const willMove = new Set(plan.filter((p) => p.recommended).map((p) => p.id));
  const ids = Object.keys(model.parts()).filter((id) => model.rectsOf(id).length > 0);
  const box = (id) => bboxOf(model.rectsOf(id));
  const out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    if (willMove.has(ids[i]) === willMove.has(ids[j])) continue;   // both move or both still: no tear
    const a = box(ids[i]), b = box(ids[j]);
    const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
    const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const frac = (ox * oy) / Math.max(1e-6, Math.min(a.w * a.h, b.w * b.h));
    if (frac > 0.5) out.push({ a: ids[i], b: ids[j], overlap: Math.round(frac * 100) / 100 });
  }
  return out;
}
```

`bboxOf` is already imported in `mcp/tools.mjs` from `../tools/rig-editor/pivot.js` — verify the import line before use rather than adding a duplicate.

Add to `forgePropose`'s return object: `tearRisks: tearRisksFor(s.model, plan)` (the `plan` local already exists — it is passed to the returned `plan` field; reuse it rather than recomputing `planFor`).

- [ ] **Step 4: Run it, verify it passes**

Run: `cd mcp && node tools.test.mjs`
Expected: PASS.

- [ ] **Step 5: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): forge_propose flags animated/inert overlap that would tear visibly"
```

---

### Task 4: Documentation honesty pass

**Files:**
- Modify: `README.md` (headline framing; the Output Target weight claim)
- Modify: `docs/adr/0007-output-target-verdict-both-svg-css-default.md` (add a measured-payload note)
- Modify: `CHANGELOG.md`

**No code, no test.** The gate still runs to confirm nothing else drifted.

**Measured evidence to use (from the 2026-07-25 playtest, gzip):** smiley 1 KB · ghost 4 KB · **DevBrain (flagship) 44 KB** (500 KB raw, 7,555 `<rect>`s of pixel-art RLE).

- [ ] **Step 1: Correct the weight claim** — ADR-0007 sells SVG+CSS as "~0 KB JS runtime (CSS ~1.2 KB gzip …)". That is true of the *runtime* but omits the payload, and it sits directly beside a criticism of Lottie's 60 KB runtime — which is amortised across a whole page, whereas mascot-forge ships its geometry per mascot. Add to ADR-0007's Consequences:

```markdown
- **Payload, measured (2026-07-25).** The ~0 KB runtime figure covers the CSS only. The emitted SVG
  geometry is the real payload and scales with pixel complexity: smiley 1 KB gzip, ghost 4 KB gzip,
  DevBrain **44 KB gzip** (500 KB raw, 7,555 `<rect>`s from scanline RLE). So SVG+CSS is not
  automatically *lighter* than Lottie for a complex pixel-art asset — a Lottie player is amortised
  across a page while our geometry is per-mascot. The defensible claim is **ownership and zero runtime
  dependency**, not smallest bytes. Curve-based output (the opt-in VTracer engine) is the lever if
  payload matters; measure before claiming.
```

**Verified scope of the README edit:** `README.md` makes **no** byte-size claim of its own — its only size figure is Rive's "~200 KB WASM canvas runtime" at line ~72, inside the *ownership* argument. So do not invent a size section. Make one surgical change: that bullet currently lets a reader infer a size win, so append a clause keeping it about ownership:

```markdown
  `.riv` file played by a ~200 KB WASM canvas runtime. You don't own the animation as
  editable code. (Size is not the argument — our own payload is the emitted SVG geometry and scales
  with the art; see [ADR-0007](../../adr/0007-output-target-verdict-both-svg-css-default.md). Ownership is.)
```

- [ ] **Step 2: Correct the autonomy framing** — the headline reads "**Hand a flat image to your AI agent and get back an animated web component you own.**" The playtest showed the auto-proposal cannot emit: roles are the agent's judgment. Adjust the headline sentence so it promises assisted rigging, not autopilot — keep it punchy, e.g.:

```markdown
**Hand a flat image to your AI agent; it rigs the parts by vision and hands you back an animated web
component you own.** The agent identifies the parts and rigs them through the mascot-forge **MCP**
(it supplies the semantics — the segmenter only proposes regions); you get editable
**SVG/CSS or React+GSAP** whose animation **states bind to your app's live data** — no binary runtime,
no black box.
```

Verify the surrounding "Honest scope" note still reads consistently after the edit.

- [ ] **Step 3: CHANGELOG** — add under `## [Unreleased]` → `### Fixed`:

```markdown
- **Cold-start dead-end + unearned anatomy (2026-07-25 playtest)** — a fresh proposal assigns no
  roles, so `forge_propose` recommended nothing and `forge_emit` hard-failed with "rig has no
  animation in any state" (reproduced on 3 of 3 unseen assets) while the checkpoint reported
  `advisory: (none)`. `forge_propose` and `forge_status` now return an advisory naming the exact next
  call. The segmenter also stopped asserting anatomy it cannot detect: without a per-asset
  `parts-spec.json` it names regions by **position** (`part-lower-left`, `part-upper`, `part-island-1`)
  instead of `part-leg-left`/`part-antenna`/`part-eyes` — it had labelled a ghost's head-top an
  "antenna" and a T-Rex's head "eyes". Assets shipping a parts-spec (DevBrain) are unaffected: the
  spec's vocabulary still wins. `forge_propose` additionally reports `tearRisks` where an animated
  part overlaps an inert one, the defect class that makes a mascot visibly come apart.
```

- [ ] **Step 4: Gate + commit**

```bash
pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1
git add README.md docs/adr/0007-output-target-verdict-both-svg-css-default.md CHANGELOG.md
git commit -m "docs: correct the payload-weight and autonomy claims; log the cold-start fixes"
```

---

## Acceptance criteria (what "done" means, and what it does NOT)

Be precise about the claim. These fixes make the cold-start dead-end **diagnosable and self-correcting
for an agent**, not automatic. Roles remain the agent's judgment (ADR-0002); nothing here auto-assigns
them, and a proposal with no roles still cannot emit. The defect being fixed is that the failure was
*silent until one call too late*.

Done means all of:

1. `forge_propose` on a fresh, unrigged session returns a non-null `advisory` that names both the
   problem (nothing will animate) and the exact next call (`set_part` / `assign_region` with a role).
   Covered by Task 2's test.
2. Acting on that advisory — assigning one `core` role and nothing else — makes `forge_emit` succeed.
   Covered by Task 2's test.
3. No proposed part id asserts anatomy when the asset has no `parts-spec.json`. Covered by Task 1's
   `no unspec'd proposal asserts anatomy` test.
4. `check-segmented.ps1` still reports DevBrain's five spec-driven names — proving the parts-spec path
   is untouched. Task 1 Step 5.
5. Gate `RESULT: PASS` (P1–P7) and e2e 20 passed at HEAD.

**Do not describe this in the CHANGELOG or commit messages as "cold start now works" or "auto-rigging
fixed".** The honest phrasing is that the checkpoint now tells the agent what to do instead of failing
silently one step later. Task 4's CHANGELOG text is already worded that way — keep it.

## Self-Review

**Playtest coverage:**
- Cold-start fails 3/3 → Task 2. ✅
- Confidently wrong anatomy naming → Task 1. ✅
- `forge_status` misleading before emit → Task 2 (advisory on both). ✅
- Weight claim omits payload → Task 4. ✅
- Headline oversells autonomy → Task 4. ✅
- Animated/inert tear class → Task 3. ✅
- "Push it" → a user action, deliberately not a task.

**Placeholder scan:** every code step shows exact replacement text and the exact command plus expected result. No TBD/TODO. ✅

**Type/name consistency:** `noRoleAdvisory(model) -> string|null` is defined in Task 2 Step 3 and used in Steps 4 for both tools. `tearRisksFor(model, plan) -> [{a,b,overlap}]` is defined and used in Task 3 Step 3. The new positional ids in Task 1's `DEFAULT_VOCAB`, `PART_COLOURS`, and the four `partId` call sites are the same five strings. ✅

**Risk notes for the executor:**
- Task 1 is the only golden-adjacent change; Step 5 explicitly proves the DevBrain parts-spec still wins before the gate runs. If `check-segmented` reports positional names, STOP — the spec lookup has broken, which is a real regression, not a golden to update.
- Task 2's advisory composes with the existing silhouette advisory rather than replacing it; a silhouette input with no roles must surface both.
- Tasks 1–3 are independent and individually revertable; Task 4 documents them and should land last.
