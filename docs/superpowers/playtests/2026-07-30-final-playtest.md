# Final cold-start playtest — mascot-forge

**Date:** 2026-07-30 · **Repo state:** `main` == `origin/main`, tracked tree clean, `5c02c39`
**Baseline (measured, raw output read):** `node tools/gate/check-all.mjs` → `RESULT: PASS` (P1–P7 green) ·
`pwsh -NoProfile -File tools/check-e2e.ps1` → `30 passed (9.4s)`

> **Provenance caveat, stated up front — this weakens the finding.** The owner was asked for five real
> Figma/Illustrator/Inkscape exports before any asset was chosen, and answered "source them yourself".
> The inputs were therefore selected on the tool's own side, which is exactly the bias the handoff
> warned about. It is *mitigated, not eliminated*: every asset was taken from third-party software
> already installed on this machine, authored by people who have never heard of mascot-forge, and
> picked mechanically by a structural scan over 29,013 SVGs bucketed by the handoff's awkward cases —
> not by eye, and not authored here.
>
> A second caveat: this session was interrupted twice (subagent monthly spend limit, then a process
> restart). Both Opus reviewer subagents died on the spend limit; the playtest and output/UI assessment
> below were done inline by the controller (Opus). Every prior-session finding was **re-measured from
> scratch** before being carried into this report — nothing here is inherited on trust.

## The assets, and where each came from

Selected by `scan-svgs.mjs` over `C:\Program Files`, `Program Files (x86)`, `AppData\Local`, `OneDrive`,
`Downloads`, `Dev`, `Documents`. 7 of 8 layered, 1 raster path retested separately — the headline claim
is layered, so the weight is deliberate.

| # | file | provenance | case it covers |
|---|---|---|---|
| A1 | `param_crosshatch.svg` | Bambu Studio (installed app), Inkscape-authored | 9 transformed top-level groups + `mask` |
| A2 | `sca_upgrade_sign.svg` | Adobe Acrobat DC onboarding art | `circle` present; relative path data |
| A3 | `sca_thanksforsubscribing.svg` | Adobe Acrobat DC onboarding art | nested groups (27 `<g>`, depth 4) |
| A4 | `PCBEditStop/64x64.svg` | Autodesk Fusion 360 | 5 `<clipPath>` + 5 `<use>`; absolute path data |
| A5 | `markers.svg` | Steam library cache, app 570 (Dota 2, Valve) | 143 layers; **nested `<defs>`** |
| A6 | `figma-cursors.svg` | Open Design plugin asset, Figma-derived | transformed groups, real authored names |
| A7 | `printer_thumbnail.svg` | Bambu Studio | **46 rendering layers** (usability probe) |
| A8 | `conditionalFormattingDialogIcons.svg` | Microsoft Power BI Desktop | 28 layers inside 84 `<symbol>`s |

---

## 1. Does the product do what it claims?

### Finding 1 (Critical) — the MCP layered parser computes wrong geometry on real exports

**Claim contradicted.** README honest-limit 4: "*the layered parser is correct*". README headline: "*the
layers you already named in Figma become an animated web component*". `docs/guides/exporting-layers.md`
names only shape *types* and *transforms* as the MCP path's limits — grep for `absolute|relative|path
data` returns **zero** mentions of path-data form.

**Measured.** Same file, two ingest paths: `parseLayered()` (node/MCP text parser) vs the browser's real
geometry (`getBBox`). Harness `out/playtest/parser-vs-truth.html`, re-run and re-measured this session:

| asset | parser parts | real DOM layers | bboxes matching truth (±0.5) | worst error (user units) |
|---|---|---|---|---|
| `assets/example-layered/robot.svg` (control) | 7 | 7 | **7 / 7** | 0.00 |
| A4 (Fusion, **absolute** path data) | 1 | 1 | 1 / 1 | 0.00 |
| A2 (Adobe) | 10 | 10 | **0 / 10** | **259.21** |
| A3 (Adobe) | 9 | 9 | **0 / 9** | **176.52** |
| A7 (Bambu, 46 layers) | 46 | 46 | **16 / 46** | **124.05** |

Concrete rows (canvas is `0 0 240 240` for A2/A3, `0 0 160 160` for A7):
- A3 `cloud` — parser `(-20.33, -24.33, 230.19 × 163.20)`; truth `(143.98, 80.84, 94.53 × 58.17)`.
- A2 `steps` — parser `(-182.96, -146.93, 395.50 × 364.42)`; truth `(24.63, 96.61, 192.86 × 105.21)`.
- A7 `part-layer-4` — parser `(18.08, 17.77, 37.31 × 37.66)`; truth `(47.73, 17.77, 7.70 × 1.23)`.

Negative origins mean the parser places parts substantially **outside the canvas**.

**Root cause (confirmed in source, self-documented).** `tools/rig-editor/path-bbox.js:2-6` — the
function regex-scrapes every number out of `d` and pairs them positionally, with the comment
"*Assumes ABSOLUTE commands (VTracer's default output); relative-command input would need a command
walker.*" So relative commands (`c`, `q`, `l`, `m`), single-value `h`/`v` (which shift the pairing of
every later number), and arc radii/flags all become fake coordinates. VTracer emits absolute, so the
**raster** path is unaffected. Figma, Illustrator and Inkscape emit relative by default — precisely the
input the layered headline invites.

**Why nothing caught it.** The only layered fixture is `assets/example-layered/robot.svg`, hand-authored
with `rect`s and absolute paths — it matches truth 7/7. Honest-limit 3 ("hand-authored, not a captured
real-world export") has turned into a live defect. Recurring failure mode 1, "claims outrun the code".

**Severity.** `forge_emit` returns `ok=true` and writes a mascot; nothing warns. Pivots are derived from
these bboxes, so parts hinge in the wrong place and can sit off-canvas. Silent wrong output.

**FIXED in this session** (owner approved the real fix over the cheaper refusal). `pathBBox` is now a
command walker: it keeps a current point, converts relative commands, handles single-value `h`/`v` and
implicit repeated parameter sets, and measures arcs **exactly** via endpoint-to-centre parameterisation
(SVG spec F.6.5/F.6.6) instead of reading radii and flags as coordinates. Re-measured against DOM truth
in a **fresh Chromium** (the in-app browser served a cached pre-fix module and would have shown a false
negative):

| asset | before | after | worst error before → after |
|---|---|---|---|
| A2 (Adobe, 120 arcs) | 0 / 10 | **8 / 10** | 259.21 → **0.94** |
| A3 (Adobe, 161 arcs) | 0 / 9 | **7 / 9** | 176.52 → **0.94** |
| A7 (Bambu, 0 arcs, 1478 cubics) | 16 / 46 | **46 / 46** | 124.05 → **0.07** |
| A4 / robot.svg (controls) | 1/1, 7/7 | 1/1, 7/7 | 0.00 → 0.00 |

The residual sub-unit gap on A2/A3 is the *pre-existing, documented* superset behaviour (bezier control
points are included as-is), not misplacement: every part now lands on-canvas, and no part is off by
more than 0.94 user units on a 240x240 canvas. `node tools/gate/check-all.mjs` → `RESULT: PASS` and the
smiley/robot byte-for-byte goldens are still fresh, because VTracer emits absolute data and correct
absolute handling is unchanged. New coverage: relative/`h`/`v`/implicit-repeat/`z`-restart cases, exact
semicircle and full-circle arc boxes, and a negative control proving the sweep flag changes the box.

### Finding 2 (High) — nested `<defs>` leaks phantom parts

**Claim contradicted.** `docs/guides/exporting-layers.md` rule 6, stated unconditionally: anything inside
`<defs>`, `<clipPath>`, `<mask>`, `<symbol>` or `<marker>` is stripped "*… they never turn into a
phantom part*" (line 62).

**Measured.** A5 (`markers.svg`, Valve) has exactly one child of `<svg>`: a `<defs>`. The browser reports
**0 top-level layers** and `viewBox: null` — it renders nothing. The MCP path ingests it happily:
**12 parts**, `set_part` succeeds 12/12, `forge_emit` → `ok=true`. The emitted file then renders 12 white
shapes (one off-canvas, one at negative coordinates) — a "mascot" built entirely from art that never draws.

**Root cause (confirmed).** `tools/rig-editor/layer-ingest.js:79` — `NON_RENDERED` matches
`<defs …>[\s\S]*?</defs>` non-greedily, so with a `<defs>` inside a `<defs>` the outer match ends at the
*inner* close and everything after leaks into the layer scan. The comment at lines 73-78 predicts this
exact behaviour and justifies it as "*an honest, disclosed ceiling rather than a depth-aware scanner
built against a defect nobody has reproduced from a real export*". **It is now reproduced from a real
third-party export shipped inside Steam**, and the public doc states the guarantee with no ceiling attached.

**FIXED in this session.** The lazy regex is replaced by `stripNonRendered()`, a depth-aware scanner
that tracks same-tag nesting so only the **outermost** tag's matching close ends a span; self-closing
instances are still consumed alone, and an unclosed tag still strips nothing (old behaviour on malformed
input). Re-measured: A5 now yields **0 parts / 0 elements** in node *and* 0 in the browser, matching the
browser's 0 top-level layers, so the MCP path refuses it via the existing "no drawable shapes found"
error (`mcp/tools.mjs:198`) instead of emitting a mascot from art that never draws. Two regression tests
added to `layer-ingest.test.mjs`: a `<g>` after a nested `</defs>` must not become a layer, and a file
whose only child is `<defs>` must yield no art. Rule 6 now holds as written.

### Finding 3 (Medium) — class-styled sources emit as black silhouettes

**Claim contradicted.** README: `forge_emit` writes "*a self-contained animated SVG*"; the pitch is your
art, as code you own.

**Measured.** A3's emitted mascot references `cls-1 … cls-5` with **zero** `<style>` definitions and
**zero** `fill` attributes on any of its 38 shapes. Rendered in the browser, all 9 parts compute to
`fill: rgb(0, 0, 0)` — nine black silhouettes. Adobe (and Illustrator generally) style layers via a
`<style>` block in the source; ingest captures element markup but not the stylesheet it depends on, so
"self-contained" is true of geometry only. A5/A7 keep their fills because those files use inline
`fill` attributes (A7: 45 × `#D8D8D8`, 1 × `black`; A5: 12 × `#fff`). Control `robot.svg` keeps all five
of its real colours.

### Findings 4 — claims that hold up (verified, not assumed)

| claim | verdict | evidence measured this session |
|---|---|---|
| Named layers become named parts, no vision | **holds** (identity) | A3: 27 `<g>` depth-4 → 9 parts, matching the browser's 9 top-level layers. A7: 92 `<g>` → 46 parts. Names come from real authored layers. |
| Honest-limit 1 — MCP is `rect`+`path` only; editor handles all seven | **holds, both directions** | A2 refused on MCP: "*handles rect + path layers; 1 element(s) are circle/ellipse/polygon … Rig this in the browser editor*". Same file in the editor: **10 parts**, stage renders `path` **and** `circle`, no error, no warning. |
| Transformed groups refused **by layer name** | **holds** | A1 names `"g5","g8"…"g29"`; A6 names `"cursor-designer","cursor-engineer","cursor-pm"`. Message includes the Figma (right-click → Flatten) and Illustrator (Object → Expand) fix actions. |
| `<clipPath>`/`<use>` produce no phantom parts | **holds** (non-nested) | A4: 5 clipPaths, 5 `<use>` → 1 part, bbox exact vs DOM truth. |
| `<symbol>` sprite sheets refused accurately | **holds** | A8: 28 layers inside 84 `<symbol>`s → "*no drawable shapes found — need top-level `<g>` layers containing shapes*". Accurate, and the stripping worked. |
| **Animation states bind to live app data** (the stated differentiator) | **holds** | Hero `layered-live-demo.html`, seeked via `getAnimations()`/`pause()`/`currentTime` with `getComputedTiming().duration`: idle → 3 anims (`breathe`/`twitch`/`glance`), max real drift **2.45px** @1800ms; active → 4 anims (`walk`, `walk-mirror` on both arms and legs), **15.30px** @520ms; alert → 2 anims (`pulse`/`nod`), **12.32px** @900ms. Distinct animation sets per state, found mid-cycle at `data-state="alert"` with no buttons. |
| Raster fallback still works | **holds** | Gate P1/P2 green; 3 e2e `drop-rig` specs pass; `mcp-live-demo.html` measured: 5 parts, idle 1.54px @1800ms, active 6.66px @520ms, alert 1.92px @420ms. |
| Honest-limit 2 — `mf.ps1` has no layered entry | **holds** | Read the dispatcher: `forge`/`emit`/`check` only, both bound to `source.png` → `-segmented.svg`. No layered branch exists. |
| Honest-limit 3 — `robot.svg` is hand-authored | **holds, and is load-bearing** | It is the only layered fixture and the only file that matches DOM truth 7/7. That is why Finding 1 shipped. |
| `prefers-reduced-motion` survives emit | **holds** | Present in every emitted mascot (A3/A4/A5/A7) and in both live demos. |

**Honest-limit 4 is now closed, and the answer is negative.** The docs said layered had not been through
an adversarial cold-start playtest. It has now, and it produced one Critical and one High defect on real
third-party exports.

## 2. What is missing vs the docs — and what works but is undocumented

**Claimed or implied, but not true:**
- Correct layered geometry on real Figma/Illustrator/Inkscape exports (Finding 1).
- Rule 6's unconditional no-phantom-parts guarantee (Finding 2).
- "Self-contained" emitted SVG for class-styled sources (Finding 3).

**Works but undocumented:**
- The **browser editor is the only correct path for real exports** — it measures `getBBox`, so it is
  immune to Finding 1. The docs sell the MCP path as the recommended one ("Layered SVG (recommended)")
  and treat the editor as the fallback for exotic shapes. On today's code the ranking should be reversed
  for anything Figma-shaped.
- The two entry points **disagree on part IDs for the same file**: MCP gives `part-cloud`, `part-steps`;
  the editor gives `part-cloud1`, `part-steps6`, `part-layer-15` (dedupe suffixes from a different id
  source). Nothing documents that a rig started in one path is not id-compatible with the other.

**Not tested — stated plainly rather than reasoned about:**
- The `rig_mascot` guided prompt was **not** assessed as a stranger reading it cold; only that it
  registers and scripts the flow (`server.test.mjs`, `protocol.test.mjs`, both green).
- `target: "react-gsap"` was not exercised on these eight assets (gate P7 covers it on goldens only).
- MCP elicitation against a real host client (gate covers the in-memory capable-client path only).
- No screenshots or GIFs — screenshots do not composite in this environment, by design of the harness.

## 3. Output and UI quality

**Emitted mascots** (measured in-browser, per part: rendered bbox, computed fill, `transform-origin`):

| asset | parts | renders | colour | geometry |
|---|---|---|---|---|
| A3 | 9 | yes | **all black** (5 undefined class refs) | wrong (0/9 match truth) |
| A4 | 1 | yes | correct (`rgb(90,199,126)`) | exact |
| A5 | 12 | yes — **but the source draws nothing** | white | 1 part off-canvas, 1 at negative coords |
| A7 | 46 | yes | correct (`#D8D8D8` ×45, black ×1) | wrong (30/46 mismatch) |
| robot (control) | 7 | yes | 5 real colours | exact |

Each emitted file carries one `@keyframes` per part, a `transform-origin` per part, `[data-state]`
selectors and a `prefers-reduced-motion` block — the emitter's own contract is sound. The failure is
upstream, in the geometry it is handed. On the control asset the motion reads correctly: legs and arms
walk mirrored, the body breathes at 2.45px, the antenna pulses on alert.

**Pages that ship.** `showcase.html`: `lang="en"`, one `<h1>`, clean `h1→h2→h2` order, both `<img>`s have
`alt`, both inline SVGs carry a title/label, 4 animations running, reduced-motion honoured, **zero**
low-contrast text (WCAG AA, computed against resolved ancestor backgrounds). `layered-live-demo.html`:
mounts 7 named parts, cycles states with no buttons. Both read as a product page, not a test harness.

**Rig editor** — the one surface with real gaps (none of these contradict a published claim, so they are
reported, not fixed):
- **0 `:focus`/`:focus-visible` rules** in the editor's CSS across 21 controls — keyboard focus relies
  entirely on the UA default outline.
- **0 `prefers-reduced-motion` rules** — the editor previews animation continuously, and a
  reduced-motion user has no way to damp it, even though every *emitted* file respects the query.
- **0 `aria-live` regions** — validation and status messages are not announced.
- 2 unlabelled text inputs (`#splitname`, `#newname`).
- Good: `lang`, one `<h1>`, real landmarks (`header`/`main`/`aside`/`footer`), zero low-contrast text,
  and the file input is keyboard-reachable (that regression guard still holds).

**Usability probe (A7, 46 layers).** Ingest handled it without complaint and `set_part` succeeded 46/46,
but 44 of the 46 layers are anonymous, so the part list reads `part-layer-1 … part-layer-46`. A stranger
gets no purchase on which layer is which — the "your named layers become parts" promise degrades to
numbering when the export has no names. Worth a doc sentence, not a code change.

## 4. Public-repo readiness

A `security-review`-methodology sweep ran to completion and is checkpointed at
`out/playtest/security-sweep.md`. I spot-verified its most serious claim directly:
`mcp/tools.mjs:367` builds output filenames as `join(dir, \`${assetName}-mascot.svg\`)` where `dir` is
`safePath()`-confined but the **joined result is never re-validated**, and `assetName` is an
unconstrained `z.string()`. Proof artifacts from the attempt sit at `out/playtest/TRAVERSAL-PROOF-mascot.svg`
— one directory *above* the per-asset session dirs every legitimate emit wrote into.

| severity | count | items |
|---|---|---|
| High | 4 | path-traversal write (`mcp/tools.mjs:367`); unescaped `assetName` → HTML (`tools/rig-editor/emit.js:54`); ingested markup embedded verbatim, `on*` handlers not stripped (`tools/rig-editor/exporter.js:126`); same taint reaching `dangerouslySetInnerHTML` in **generated, shippable** React (`tools/emit-react-gsap/emit-react.mjs:76-91` → `:302`) |
| Medium | 2 | 22 broken relative links: `docs/plans/*.md` (16, missing `../`) and `docs/research/*-prompt.md` (6, missing `plans/`) |
| Low | 3 | personal path default `spikes/03-second-asset/prep-source.ps1:2` (`C:\Users\dev\Downloads\…`); one internal broken link; README's ADR table stops at 0009 while the repo has 11 |
| Info | 1 | maintainer email public in `CITATION.cff`/`CODE_OF_CONDUCT.md`/`SECURITY.md` — standard OSS, confirm intentional |

No credentials, tokens, `eval`, stray/backup files, or private hostnames. README's own 34 relative links
all resolve. The four High items matter only for a less-than-fully-trusted MCP caller, but item 4 ships
into a downstream app's bundle, which raises it above "local dev tool" risk.

## 5. The call — is this project complete?

**Not yet — but the two defects that made it "no" are now fixed and measured.**

As found, the headline failed silently on 3 of the 4 real layered exports that reached emit, and the one
honest limit the docs offered as reassurance (a hand-authored fixture) is exactly what hid it. Findings 1
and 2 were fixed in this session with the owner's approval, re-measured against DOM truth, and both the
gate (`RESULT: PASS`) and the browser e2e (`30 passed`) are green with the goldens untouched. What remains
is short and none of it is silent-wrong-output.

**Shortest list that would make it complete:**

1. ~~Fix `pathBBox` for relative path data~~ — **DONE** this session: command walker + exact arc
   measurement. A7 46/46, A2 8/10, A3 7/9, worst residual 0.94 user units (was 259.21).
2. ~~Make non-rendered stripping depth-aware~~ — **DONE** this session: `stripNonRendered()`; A5 yields
   0 parts, rule 6 holds as written.
3. **Carry source styling into emit** — still open. Inline resolved fills, or copy the source `<style>`
   into the exported SVG — or state in the docs that class-styled sources lose their colours. Today A3
   emits nine pure-black silhouettes and `forge_emit` reports success (Finding 3).
4. **Add one real third-party export to the gate as a fixture** with a bbox-vs-truth assertion. The unit
   tests added here cover the parsing rules, but nothing in the gate yet ingests a genuine
   Figma/Illustrator/Inkscape file — that absence is what let Finding 1 ship, and it is what would stop
   it recurring.
5. **Constrain `assetName`** to a safe charset and re-validate the joined path before `writeFileSync`;
   **sanitize ingested markup** (`on*` attributes, `javascript:` URLs) once at ingest so every emitter
   inherits it. Four High findings, one of which ships into a downstream app's bundle.
6. **Docs cleanup:** the 22 broken links, the ADR table stopping at 0009, the personal path default in
   `prep-source.ps1`, and the fact that `exporting-layers.md` still says nothing about path-data form
   (now harmless, since the parser handles both, but the guide's rule list is what a designer reads).

Item 3 is the last remaining published-claim contradiction. Item 4 is what stops the class of defect
recurring. Items 5–6 are public-repo hygiene, not product truth. With 3 and 4 done, this project is
complete; 5 and 6 are the difference between complete and polished.

---

### Verification notes

Every number above was measured, not inferred. Animation was measured by seeking
(`getAnimations()` → `pause()` → `currentTime` at 0 / 25% / 50%) using
`effect.getComputedTiming().duration`, never `getTiming().duration`, and by tracking bbox
width/height as well as x/y. Geometry truth is the browser's `getBBox()` on the same bytes the parser
read. Harnesses: `out/playtest/parser-vs-truth.html`, `out/playtest/output-quality.html`,
`out/playtest/transcript-mcp.txt` (MCP tool chain over all 8 assets),
`out/playtest/security-sweep.md`. Gate and e2e results are from raw command output read from disk this
session; tracked files are unmodified since that run.
