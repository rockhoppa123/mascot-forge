# System Audit — 2026-07-05

**Scope:** full pass over runtime/, tools/rig-editor/, mcp/, tests/, gate scripts, and docs.
**Baseline at audit time:** `tools/check-all.ps1` → RESULT: PASS · `tools/check-e2e.ps1` → 17/17 passed · main @ 57e6b94.
**Method:** every Critical/Important claim below was verified against the actual code, and the top three by executable repro (node one-liners against `mcp/tools.mjs` / `layer-ingest.js`, plus a Playwright probe for the suspected canvas-coordinate skew — which was **refuted** and is not listed).

Severity: **C** = Critical (breaks an advertised flow / loses data), **I** = Important (wrong or misleading output, silent degradation), **M** = Minor.

---

## 1. Correctness / accuracy

### C1. Simple tier crashes `forge_emit` whenever a moving part exists
- **Where:** `mcp/tools.mjs:286-288` (auto-fill loop, outside the try/catch) ← `planFor`/`defaultPresetFor` (`tools.mjs:39-70`); second call site `tools/rig-editor/app.js:403-416` (kind onchange).
- **What:** `defaultPresetFor` recommends `["active","walk"]` for a limb / `["alert","pulse"]` for an accent regardless of the rig's **declared** state vocabulary. On a Simple-tier rig (`states: ["idle"]`), `forgeEmit`'s auto-fill calls `model.setPreset("active", …)` → `setPreset: unknown state 'active'` throws.
- **Repro (executed):** `startFromImage({states:["idle"]})` → `assignRegion(role:"limb")` → `forgeEmit` → **THROWS `setPreset: unknown state 'active'`**. The MCP surfaces it as a raw error; the guided flow's Simple tier (design doc 2026-06-27, shipped in 8cf0ea6) is broken for any rig with a limb/accent role — i.e. most rigs.
- **Same root cause in the editor:** load a Simple rig, set role=limb, pick kind=wheel → `kindDefaultPreset` returns `["active","spin"]` → `model.setPreset("active",…)` throws inside the onchange handler (uncaught page error).
- **Also:** `forgePropose`'s `plan.recommended` shows undeclared states (`{state:"active"}`) on a Simple rig — misleading even before the crash.
- **Fix:** make the recommendation vocabulary-aware — clamp `defaultPresetFor`/`planFor`/the editor kind handler to `model.states()` (fall back to an idle-family preset or `null` when the signature state isn't declared) + a regression test with `states:["idle"]` through `forge_emit`.

### I1. `forge_start_from_layered_svg` silently drops all rig metadata and declared states
- **Where:** `mcp/tools.mjs:184` + `193` — `const { viewBox, elements } = parseLayered(text); … toModel({ viewBox, elements })`.
- **What:** `parseLayered` was extended (e445567) to return `parts` (role/kind/bone/pivot/presets) and `states`, and `toModel` applies them — but the MCP tool destructures only `viewBox`+`elements`, so both are discarded. Re-ingesting a self-describing handoff SVG (or any layered SVG carrying `data-*` rig attrs) via the MCP yields a passive, preset-less, standard-states model.
- **Repro (executed):** handoff SVG with `data-states="idle,active,alert,loading"`, `data-role="core"`, `data-pivot`, `data-preset-idle="breathe"` → after `startFromLayeredSvg`: states `["idle","active","alert"]` (loading lost), role `passive`, pivot `null`, preset `undefined`.
- **Fix:** `const { viewBox, elements, parts, states } = parseLayered(text); toModel({ viewBox, elements, parts, states })` + a test mirroring the browser one in `layer-ingest.test.mjs`.

### I2. Unsanitized part ids produce silently dead animations and broken artifacts
- **Where:** `mcp/tools.mjs:79` (`normPartId` only prefixes, never sanitizes); same hole in the editor: `app.js` `#addpart` (:437), `#split` (:525), `#rename` (:419) accept free text.
- **What:** an agent- or user-supplied id like `left arm` lands in the model as `part-left arm` (repro executed). Downstream: `exporter.js` emits `<g id="part-left arm">` (invalid), `emit.js` emits selector `#part-left arm` — parsed as *descendant* selector `#part-left` ` ` `arm`, so the part's animation **never applies**, with no error anywhere. Ids containing `"` also break the handoff SVG attributes (`editorHandoff` does no escaping).
- **Fix:** run every inbound id through `sanitizeId` (already exists in `layer-ingest.js:20`) at the model boundary (MCP `normPartId` + the three editor inputs).

### I3. Node-side layered parser silently loses geometry on nested groups and drops hyphenated/digit state presets
- **Where:** `tools/rig-editor/layer-ingest.js:13` (`GROUP_RE` non-greedy to the *first* `</g>`) and `:61` (`data-preset-([a-z]+)=`).
- **What (repro executed):** a Figma-style nested export `<g id="arm"><g id="hand"><rect A/></g><rect B/></g>` parses to **one element** — rect B (the outer group's own geometry) is silently lost. And `data-preset-phase-2="walk"` parses to `{}` — presets for any state name with a digit/hyphen are dropped. The browser path (`app.js loadLayeredSvg`, DOMParser) handles both correctly, so the two "agreeing" parsers have drifted — exactly the drift the shared-module comment warns against.
- **Impact:** the MCP alt entry (which uses the node parser) can mis-ingest real Figma/Inkscape exports without error; the header only documents un-resolved *transforms*, not nesting loss.
- **Fix (minimum):** detect nested `<g>` in `parseLayered` and throw the same clear "flat exports only" error used for circles; widen the preset regex to `([a-z0-9-]+?)` anchored on `="`. (Full fix: share one extraction routine between node and browser — see §4.)

### I4. Signal-state guidance makes `success` outrank `error` at runtime, docs claim the opposite
- **Where:** `tools/rig-editor/model.js:15` (`SIGNAL_STATES = ["loading","error","success"]`), `mcp/server.mjs:41-42` (tool description example `["idle","active","alert","loading","error","success"]`), `docs/gallery/README.md:131-141`.
- **What:** runtime priority = index in `states` (`mascot-state.js:39`), so the recommended vocabulary gives `success` (index 5) the **highest** priority — a simultaneous `ci_failed` + `deploy_ok` shows the success bounce, not the error shake. The gallery README asserts, next to that exact array: *"vocabulary order = PRIORITY (error outranks success outranks loading)"* — false for the array it annotates. Anyone following the shipped guidance gets inverted alerting semantics.
- **Fix:** reorder the canonical suggestion to `[…, "loading", "success", "error"]` (SIGNAL_STATES, server description, gallery README) — pure guidance/data change, no golden touches; or keep the order and correct the docs (worse: error *should* win).

### M1. `defaultPresetFor` substring heuristics misfire
- `mcp/tools.mjs:43-45`: `/tail/i` matches `part-detail` (wags), `/eye/i` matches `part-eyebrow` (blinks). Fix: word-boundary-ish regexes (`/(^|-)tail/`).

### M2. `applyTweaks`/editor rename onto an existing part id silently merges and clobbers metadata
- `model.js:58-71` `rename` has no collision guard: renaming `a`→`b` when `b` exists overwrites `b`'s meta with `a`'s and merges rects. Fix: throw on collision (or dedupe like `sanitizeId`).

### M3. `pollJson` treats non-2xx as "nothing asserted" only by accident
- `runtime/mascot-state.js:115-129`: no `res.ok` check — a 500 with an HTML body only degrades because `res.json()` throws. Fix: `if (!res.ok) { emit(null); return; }` (explicit, one line).

### M4. Downgrades require another emit tick
- `mascot-state.js` evaluates only on `emit`; with `fromEvents`, a mascot upgraded to `alert` whose source then goes silent stays `alert` forever. Inherent to the event-driven design — but undocumented. Fix: one sentence in the module header + gallery README ("event sources must keep emitting, or use pollJson").

---

## 2. Test-coverage gaps

- **G1 (behind C1):** the reactivity-tier feature has zero behavioral coverage. `server.test.mjs:19` asserts the *prompt text contains "Simple|Standard|Signals"* — wording, not behavior. No test runs `states:["idle"]` through `forge_emit`. This is the named example of an assertion that doesn't prove what its name claims ("rig_mascot scripts the tier question").
- **G2 (behind I1):** `layer-ingest.test.mjs` proves `parseLayered`+`toModel` preserve metadata, but no test covers the **MCP tool** `startFromLayeredSvg` doing so — the seam where it's actually dropped.
- **G3 (behind I2):** nothing tests hostile/odd part ids (spaces, quotes, uppercase) anywhere in the chain.
- **G4:** the marquee e2e (`rig-editor.spec.mjs:27`) only regresses `suppressClick`; **no test asserts which rects a marquee selects** end-to-end in real canvas coordinates (select.js is unit-tested, but the `svgPoint` mapping glue is not — I probed it manually and it's correct today, but it's unguarded).
- **G5:** `pollJson`/`fromEvents` are untested (runtime test covers only the core evaluate loop). A fake `fetch`/EventTarget makes both testable in node with zero deps.
- **G6:** `emit.test.mjs` "equivalence to the canonical golden" is a handful of `includes()` probes; the reduced-motion block and the state-buttonless Simple output are unasserted.
- **G7:** `model.removeState` is unit-tested, but nothing asserts an export after removeState drops that state's animations/CSS (the editor's remove-× → export path).

---

## 3. UX / product gaps

- **U1. The editor's own exports don't round-trip.** `exporter.js serializeSvg` writes `data-bone/data-origin/data-pivot-x/-y` but **no** `data-role`/`data-kind`/`data-preset-*`/root `data-states`; the re-import path (`loadFile` → `loadLayeredSvg`) reads `data-pivot` (a different attr!) and `data-role`. Net: re-opening your own `*-manual-part.svg` or animated SVG in the editor yields a passive rig, `0/N animated` — the exact "editor receives a corpse" failure the 2026-06-27 design fixed for the MCP handoff, still present for the editor's own artifacts. A user cannot save work and resume. **Fix:** emit the same self-describing `data-*` set from `serializeSvg` (additive attrs; goldens assert presence not absence — verify), and teach the loader `data-pivot-x/-y`.
- **U2. Grade over-flags "silhouette", and the guided flow then refuses to carve real parts.** `grade.js:9`: `fills.size <= 2 || maxShare > 0.8`. `maxShare` is the largest single *rect* share — a mascot with a big solid rectangular body (>80% of area) plus clearly separable eyes/mouth in other colours grades `silhouette`, and the `rig_mascot` prompt then hard-steers to whole-body Simple ("do NOT carve limbs"). The reason string ("parts can't be auto-separated") is simply false for such inputs. **Fix:** `silhouette` only when `fills.size <= 2`; `fills>=3 && maxShare>0.8` → `borderline` with an accurate reason.
- **U3. README undersells/misdescribes the headline path.** The MCP section (`README.md:185-197`) says "the agent runs this loop (**six tools**)" and lists the M1-era chain — `forge_propose`, `forge_apply_tweaks`, `forge_review`, the `rig_mascot` guided prompt, and the reactivity tiers (the product's differentiators per the design docs) are absent. First-contact readers see a smaller product than what shipped.
- **U4. Regions-preview labels clip at the top edge.** `regions-preview.mjs:22` puts the label at `y = b.y - 1`; a part touching the viewBox top renders its id outside the SVG (clipped). Minor: clamp to `max(b.y-1, 4)`.
- **U5. Default `colors` drift:** MCP start default 8 (`tools.mjs:148`), editor default 6 (`index.html:26`), docs say 6. Same image gives different first-pass parts per surface. Pick one.

---

## 4. Architecture / maintainability

- **A1. Two parallel layered-SVG metadata extractors** — `layer-ingest.js parseLayered` (regex, node) vs `app.js loadLayeredSvg` (DOMParser, browser) each re-implement name/role/kind/bone/pivot/preset extraction. They have **already drifted twice** (data-kind needed the double fix in e9f09c4; I3 above is the current drift). Fix: one shared `metaFromGroup(getAttr)` + `collectElements` consumed by both; the browser passes DOM accessors, node passes regex accessors.
- **A2. `app.js` at 716 lines** is the largest file and mixes intake, canvas interaction, state controls, and export wiring. Tolerable for "thin glue", but the loaders (`loadText`/`loadLayeredSvg`/`loadPng`/`?rig=`) are a coherent ~120-line module that would relieve most of the pressure. Low urgency.
- **A3. Two demo-page emitters** — `emitDemoHtml` (editor download) and `emitShowcaseHtml` (MCP emit) duplicate scaffold; the editor demo lacks the play-feed/download affordances users get from the MCP path. Converge on `emitShowcaseHtml`.
- **A4. Repo hygiene:** both `out/` and `output/` exist at root; `tools/emit-react-gsap/dist/` + `generated/` are committed build artifacts; `test-results/` at root and under `tests/`. Not wrong, but confusing to newcomers.

---

## 5. Docs drift

- **D1.** README MCP loop: "six tools" vs the 10-tool contract; guided flow/tiers absent (see U3).
- **D2.** Gallery README priority annotation contradicts the code for the array it documents (see I4).
- **D3.** ADR counts stale: README table + repo-layout say 0001–0009, `docs/README.md` says 0001–0010; ADR 0011 exists.
- **D4.** README repo-layout tree omits `mcp/`, `tests/`, and `tools/rig-editor/` — three of the four surfaces the intro paragraphs sell.
- **D5.** `layer-ingest.js` header documents the transform limitation but not the nested-group geometry loss (I3) — the known-limit note understates the actual ceiling.
- **D6.** Hero images (`docs/hero-mascot.png`, `docs/hero-mcp-live.gif`) remain placeholder/owner-capture steps — honest per the captions, but the top of the README still leads with a broken-image-or-placeholder for the headline claim. (Owner task, listed for completeness.)

---

## 6. Additions worth making (ranked, value ÷ effort)

| # | What | Fixes | Effort |
|---|------|-------|--------|
| 1 | Vocabulary-aware motion recommendations (`defaultPresetFor`/`planFor`/editor kind handler clamp to declared states) + Simple-tier regression test | C1, G1 | S |
| 2 | Pass `parts`+`states` through in `startFromLayeredSvg` + seam test | I1, G2 | XS |
| 3 | Sanitize part ids at the model boundary (MCP + 3 editor inputs) + hostile-id test | I2, G3 | S |
| 4 | Reorder SIGNAL_STATES guidance to `loading, success, error`; fix gallery README + server description | I4, D2 | XS |
| 5 | Silhouette grade requires `fills<=2`; dominant-region-with-colours → borderline | U2 | XS |
| 6 | Self-describing editor export (serializeSvg writes `data-role/kind/preset-*/states`; loader reads `data-pivot-x/-y`) | U1 | M |
| 7 | Nested-`<g>` guard + preset-regex widen in `parseLayered`; document the ceiling | I3, D5 | S |
| 8 | README refresh: 10-tool guided loop, ADR counts, layout tree | U3, D1, D3, D4 | S |
| 9 | Shared layered-metadata extractor (browser+node) | A1 | M |
| 10 | `pollJson` `res.ok` + adapter tests; marquee-selection e2e assertion | M3, G4, G5 | S |
| 11 | Rename collision guard; word-boundary anatomy regexes; label clamp; colors-default unification | M1, M2, U4, U5 | S |
| 12 | Converge demo emitters on `emitShowcaseHtml` | A3 | S |

**Explicitly refuted during audit** (checked, not findings): `svgPoint` letterbox skew (SVG sizing preserves viewBox aspect ratio — mapping verified exact via Playwright probe); marquee full-containment policy (intended, documented); session eviction order (Map insertion order is oldest-first); `normPartId("party")` false-prefix concern (`startsWith("part-")` is hyphen-exact).
