# Handoff — mascot-forge final playtest (the last item before the project is complete)

**Written:** 2026-07-29 · **Repo:** `C:\Users\student1\Dev\mascot-forge` · **Branch:** `main`, clean
**State:** merged and **pushed** — `main` == `origin/main`, 0 unpushed. Public repo:
`https://github.com/rockhoppa123/mascot-forge`

## Starting state (verify, don't assume)

```bash
cd mcp && npm ci && cd ..      # once per clone — P5 and P6 use these deps
node tools/gate/check-all.mjs  # expect: RESULT: PASS (all pipeline checks green)
```
```bash
pwsh -NoProfile -File tools/check-e2e.ps1   # expect: 30 passed
```

## What this session is for

**One job: a genuine cold-start playtest, then a verdict on whether the product does what it says.**
Four stages of engineering just shipped (layered ingest hardened, gate made cross-platform, docs flipped
to layered-first, hero demo replaced). Nothing more is planned. This session decides whether the project
is finished or whether the claims still outrun the code.

Do **not** start new feature work. If you find something broken, fix it *only* if it contradicts a
published claim; otherwise report it.

## What the product claims (this is what you are testing against)

Read `README.md` first — it is the contract. In summary:

- Hand your agent a **layered SVG** (Figma/Illustrator/Inkscape export, each top-level `<g>` a named
  part) and get back an **animated web component you own** — editable SVG/CSS or React+GSAP, no binary
  runtime.
- Animation **states bind to live app data** (`runtime/mascot-state.js`). That binding is the stated
  differentiator, not merely that a mascot moves.
- **Two independent entry points:** the MCP server (agent-driven) and the browser rig editor
  (`tools/rig-editor/index.html`), which ingests layers without the MCP.
- **Raster + auto-segmentation is a labelled fallback**, not the headline.

**The four honest limits the docs commit to.** Verify each is still true, and that nothing new
overclaims:

1. The agent/MCP path is **`rect` + `path` only** — `circle`/`ellipse`/`polygon`/`polyline`/`line` are
   rejected. The browser editor handles all seven.
2. `mf.ps1` (the CLI) has **no layered entry at all**.
3. `assets/example-layered/robot.svg` is **hand-authored**, not a captured real-world export.
4. Layered's evidence is **parser correctness plus a proven user loop** — *not* the adversarial
   cold-start playtest that discredited raster. **This session is what closes that gap.**

## The five test assets — read this before choosing them

A cold-start playtest is only valid if **the tool's author did not choose inputs that suit the tool.**
If you generate five assets yourself, you will unconsciously produce five files the ingest already
handles, and the result proves nothing.

**Preferred:** ask the owner for five real exports (Figma/Illustrator/Inkscape) before you begin. That is
the only input class that tests the actual claim.

**If the owner supplies nothing,** be explicit in the report that this weakens the finding, then source
five genuinely varied assets and *say where each came from*. Cover deliberately awkward cases, because
the honest limits above predict where it breaks:

- one with a **transformed group** (Figma emits these constantly) — must be refused **by layer name**
- one using **`circle`/`ellipse`/`polygon`** — must work in the editor, must fail cleanly on MCP
- one with **nested groups** several levels deep — must flatten
- one with **`<defs>`/`<clipPath>`** — clip shapes must not become phantom parts
- one **large / many-layered** (20+ layers, or a big path count) — a performance and usability probe

**The headline is layered, so weight the test toward layered.** Five raster PNGs would test the
*fallback*. Test raster too — it is still documented and must still work — but do not let it dominate.

## What to assess

**1. The workflows, end to end, as a stranger.**
- MCP path: `forge_start_from_layered_svg` → `set_part` → `forge_status` → `forge_emit`. Does the guided
  `rig_mascot` prompt actually guide? Are error messages actionable *by someone who has not read the
  source*?
- Browser editor: drop a file, assign roles/pivots/presets, export. Where does a newcomer get stuck?
- CLI: `pwsh ./mf.ps1 forge <asset>` → editor → `pwsh ./mf.ps1 emit <asset>` → `mf check`.
- The fresh-clone experience: does `docs/guides/exporting-layers.md` actually get a designer from their
  file to a working rig?

**2. The output quality.** Not "did it emit" — *is the result good*. Open every emitted mascot and judge:
do the parts articulate sensibly, are pivots in the right place (a limb should hinge at its joint, not
its centre), does the motion read as intended, does it survive `prefers-reduced-motion`?

**3. UI quality of the surfaces that ship.** The rig editor (`tools/rig-editor/index.html`), the hero
(`docs/buildable-slice/layered-live-demo.html`), the showcase (`docs/buildable-slice/showcase.html`), and
the GitHub repo page itself as a first-time visitor sees it. There is no separate marketing website —
the README plus those pages *are* the front door.

**4. Public-repo readiness.** The repo is already public. Sweep for anything unprofessional or leaking:
credentials, absolute machine paths, personal chatter, stray files, broken links or embeds, stale
instructions, docs contradicting each other. A previous sweep cleared credentials and moved two strays;
assume it was not exhaustive.

## Reviewer agents — dispatch at least these two, and give them the claims

**Playtest assessor.** Gets the raw playtest transcript and outputs, and answers one question: *does the
product do what the README says?* Specifically — is anything claimed but missing, and is anything working
but undocumented? It must judge against the README and the four honest limits, not against plausibility.

**Output/UI assessor.** Judges the emitted mascots and the shipped pages on craft: pivot placement,
motion quality, visual hierarchy, accessibility basics, reduced-motion behaviour, and whether the pages
look like a professional product or a developer's test harness. Consider loading the `impeccable` skill
for this.

Both must be told: **screenshots time out in this environment.** Assess visually via `read_page`,
computed CSS through `javascript_tool`, and animation measurement — see below.

## How to verify things here (learned the hard way)

- **Screenshots do not work** — the Browser pane does not composite. Never plan around producing one.
- **Seek animations, don't sample.** `element.getAnimations()` → `pause()` → set `currentTime` to two
  known points → measure `getBoundingClientRect()` drift. Timer sampling misses short keyframe windows.
  Use `effect.getComputedTiming().duration` (a number in ms), **never** `getTiming().duration`, which can
  be `"auto"` and silently makes the measurement zero — a motion test that always passes.
  A rotation moves the bounding box's *size* too, so measure width/height as well as x/y.
- **Serve with `python -m http.server 4178` from the repo root.** `preview_start` reads the
  home-directory launch config, not the repo's.
- `tools/check-e2e.ps1`'s filter argument **does not work** (PowerShell `@args` splatting drops it), so
  it always runs the whole suite.
- `tests/playwright.config.mjs` sets `retries: 1` **globally**, not CI-only, so a ~50%-flaky test still
  reports green locally.

## Repo constraints — each has broken this repo before

- **NEVER create a root `package.json`.** The gate asserts its absence.
- **MCP tool count is locked at exactly 10** (`mcp/protocol.test.mjs`). Extend tool *responses*, never
  add a tool.
- `runtime/`, `tools/rig-editor/` and `tools/gate/` stay zero-dependency, pure ESM, no build step.
- `docs/buildable-slice/generated/*`, `tools/emit-react-gsap/generated/*` and
  `docs/buildable-slice/mcp-smiley/*` are **byte-for-byte goldens**. If one moves, STOP and report.
- Tests use `node:assert/strict`, no framework. Gate must print `RESULT: PASS` after any change.
- Commit bodies end with a `Co-Authored-By:` trailer. **Ask before pushing.**

## Model assignment

Judgement work goes to Opus; mechanical, well-specified work goes to Sonnet. This session's own
whole-branch review found its Critical finding only because it ran on Opus — the ~14 Sonnet task
reviews that preceded it all missed it.

- **Playtest assessor, output/UI assessor, and any adjudication of a reviewer's findings** — **Opus**.
  "Does this match the contract?" and "is this actually good?" are judgement calls, not pattern matches.
- **Driving the tools, capturing transcripts, running the gate, the security/credentials sweep** —
  **Sonnet** is sufficient and cheaper.

## Subagent spend limits — plan around them

Subagents hit the monthly spend limit twice in the session that produced this handoff, mid-task both
times. The second time it left a 510-line file uncommitted, and the work had to be verified inline by
the controller rather than by the dispatched reviewer. Expect this to happen again:

- Checkpoint progress (commit, or at minimum write a report file) after each discrete unit of work, not
  only at the end of a task.
- If a subagent is cut off, do not assume its partial output is wrong or right — verify it yourself
  before either discarding or accepting it.
- If subagents become unavailable entirely, fall back to doing the work inline rather than blocking.

## Known-open items — confirm or close, don't rediscover

- `docs/buildable-slice/generated-land-rover/*` is the one committed emitter output with **no freshness
  gate**. Pre-existing.
- `outputSchema` / `structuredContent` deliberately not adopted on the 10 MCP tools — declaring output
  shapes would freeze formats that changed twice recently, and a too-narrow schema makes clients reject
  valid responses.
- The owner's username remains in dated ADR/plan/research records and in git history. Sanitising docs
  alone would be theatre; a history rewrite is the owner's call.
- The `mf forge` batch path uses `System.Drawing` and is **Windows-only** by design (self-marked legacy).

## Deliverable

A single verdict document at `docs/superpowers/playtests/2026-07-XX-final-playtest.md`:

1. **Does the product do what it claims?** Per claim, with evidence.
2. **What is missing** relative to the docs — and what works but is undocumented.
3. **Output and UI quality**, with specifics, not adjectives.
4. **Public-readiness**: anything that should not be in a public repo.
5. **The call:** is this project complete? If not, the shortest list that would make it so.

Report measured results, not inferred ones. If something could not be tested, say so plainly rather than
reasoning about what it would probably do.
