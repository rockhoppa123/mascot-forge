# SVG+CSS Buildable Slice Implementation Plan

> Status: First implementation pass verified; goldens accepted; SVG+CSS emitter stage implemented
> Date: 2026-06-17
> Scope: planning document for the first implementation pass after the Buildable Slice
> Evidence Pack

## Progress Update - 2026-06-17

The first SVG+CSS Buildable Slice implementation pass has been completed against this
plan.

Completed:

- Clean Mascot Source candidate approved by the user:
  `C:\Users\dev\Dev\DevBrain\public\mascot\default.png`.
- Source metadata rechecked and recorded in `docs/buildable-slice/README.md`.
- Manual Part SVG fixture created at `docs/buildable-slice/devbrain-manual-part.svg`.
- Small rig fixture created at `docs/buildable-slice/devbrain-rigged.json`.
- SVG+CSS stylesheet created at `docs/buildable-slice/devbrain-svg-css.css`.
- Standalone demo page created at `docs/buildable-slice/devbrain-svg-css-demo.html`.
- No-dependency structural checker created at `tools/check-buildable-slice.ps1`.
- `docs/buildable-slice/goldens/` created as the reserved baseline folder.
- Deterministic reduced-motion screenshots captured for `idle`, `active`, and `alert`
  with semantic SVG part assertions before capture.

Verification run:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-buildable-slice.ps1
git diff --check
rg -n "npm install|pnpm|yarn|package scaffold|React\+GSAP package|@gsap/react|gsap" docs/buildable-slice tools
$rig = Get-Content -Raw 'docs/buildable-slice/devbrain-rigged.json' | ConvertFrom-Json
if ($rig.states -contains 'impact') { throw 'impact must stay outside states' }
```

Results:

- Structural checks passed.
- Whitespace check passed.
- Package/dependency scope scan returned no matches.
- `impact` state guard passed.
- Browser capture succeeded through existing Playwright runtime; no repo dependency was
  added.

Review artifacts:

```text
C:\Users\dev\AppData\Local\Temp\mascot-forge-buildable-slice-screenshots\devbrain-svg-css-idle-reduced.png
C:\Users\dev\AppData\Local\Temp\mascot-forge-buildable-slice-screenshots\devbrain-svg-css-active-reduced.png
C:\Users\dev\AppData\Local\Temp\mascot-forge-buildable-slice-screenshots\devbrain-svg-css-alert-reduced.png
```

Current state after golden acceptance:

1. The three reduced-motion screenshots were accepted by the human reviewer.
2. The accepted `idle`, `active`, and `alert` captures were copied into
   `docs/buildable-slice/goldens/`.
3. The next Buildable Slice stage is planned: a minimal dependency-free SVG+CSS emitter
   contract that consumes the existing Manual Part SVG and `rigged.json` fixture before
   broader code generation, React+GSAP, telemetry, vectorization, or segmentation work.
4. The follow-up prompt for a fresh Codex session is stored at
   `docs/research/next-stage-prompt.md`.

## Golden Acceptance Result - 2026-06-17

Current result: all three reduced-motion screenshots accepted by human review.

Accepted goldens copied into `docs/buildable-slice/goldens/`:

```text
docs/buildable-slice/goldens/devbrain-svg-css-idle-reduced.png
docs/buildable-slice/goldens/devbrain-svg-css-active-reduced.png
docs/buildable-slice/goldens/devbrain-svg-css-alert-reduced.png
```

The only accepted baselines for this stage are these deterministic
`?state=<idle|active|alert>&reduce=1` captures. Moving-frame visual diffs remain
deferred until static reduced-motion parity is stable.

## SVG+CSS Emitter Implementation Result - 2026-06-17

Current result: minimal dependency-free SVG+CSS emitter implemented.

Implemented:

- `docs/buildable-slice/devbrain-rigged.json` now includes the six minimal SVG+CSS
  motion recipes under `animations.idle`, `animations.active`, and `animations.alert`.
- `tools/emit-svg-css.ps1` validates the Manual Part SVG and `rigged.json` with
  PowerShell XML/JSON APIs before writing generated files.
- `docs/buildable-slice/generated/` contains only:
  - `devbrain-svg-css.generated.svg`
  - `devbrain-svg-css.generated.css`
  - `devbrain-svg-css.generated-demo.html`
- `docs/buildable-slice/devbrain-manual-part.svg` now uses source-pixel row-run
  geometry from the approved Clean Mascot Source so the Manual Part SVG preserves the
  DevBrain likeness instead of a freehand approximation.
- `part-moustache` is emitted as a narrow duplicated lower accent over the full body
  silhouette, preventing alert recoil from tearing holes in the source-pixel mascot.
- `tools/check-buildable-slice.ps1` validates both the source-pixel fixture/demo and
  the generated SVG+CSS output, including generated state controls from `rigged.json`.
- `docs/buildable-slice/README.md` documents how to regenerate and open the generated
  demo.

Emitter-stage caveats:

- Generated output is currently a structure/parity proof for the SVG+CSS Output Target;
  it does not replace the accepted reduced-motion goldens.
- The Manual Part SVG is source-pixel row-run geometry, not production vectorization or
  automated segmentation.
- `impact` remains only under `accents.impact`; generated state buttons and selectors
  remain exactly `idle`, `active`, and `alert`.
- Browser visual review is still human-reviewed; generated screenshots are review
  artifacts unless explicitly accepted as new goldens.

Verification output recorded during implementation:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\emit-svg-css.ps1
```

Result:

```text
Emitted SVG+CSS demo files to C:\Users\dev\Dev\mascot-forge\docs\buildable-slice\generated
```

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-buildable-slice.ps1
```

Result:

```text
Buildable Slice structural checks passed.
```

Browser review artifacts captured with existing Chrome through Playwright CLI at the
accepted `900x620` review viewport:

```text
C:\Users\dev\AppData\Local\Temp\mascot-forge-generated-screenshots\devbrain-svg-css-generated-idle-reduced.png
C:\Users\dev\AppData\Local\Temp\mascot-forge-generated-screenshots\devbrain-svg-css-generated-active-reduced.png
C:\Users\dev\AppData\Local\Temp\mascot-forge-generated-screenshots\devbrain-svg-css-generated-alert-reduced.png
```

These captures are temporary review artifacts. They were not copied into
`docs/buildable-slice/goldens/`.

Same-browser comparison against a `900x620` source-pixel fixture recapture produced
`0` different pixels for `idle`, `active`, and `alert`. The generated Output Target is
therefore visually identical to the corrected Manual Part SVG under the same browser and
viewport. The stored accepted goldens are from the previous freehand fixture and remain
unchanged until a human explicitly accepts replacement source-pixel goldens.

## Next Stage Plan - Minimal Dependency-Free SVG+CSS Emitter Contract

Status: prepared for review. Do not implement this emitter until the user explicitly
approves this next-stage plan.

### Goal

Create the smallest SVG+CSS emitter contract that consumes:

- `docs/buildable-slice/devbrain-manual-part.svg`
- `docs/buildable-slice/devbrain-rigged.json`

and emits a generated SVG+CSS demo that reproduces the current source-pixel demo shape
from data. This remains an Output Target proof for SVG+CSS only. React+GSAP stays
deferred.

### Evidence Basis

- The Evidence Pack recommends SVG+CSS as the first Output Target because it is
  dependency-free, screenshot-testable, and sufficient for `idle`, `active`, and `alert`.
- The SVG+CSS Local Proof shows `data-state` routing, explicit transform origins,
  nested SVG group transforms, and forced reduced-motion captures.
- The existing checker proves the Manual Part SVG and `rigged.json` already share
  semantic part IDs, pivots, and the three-state Animation State boundary.

### Contract Shape

The existing `states`, `bones`, `parts`, and `accents` fields stay authoritative.
`impact` remains under `accents.impact` and must not appear in `states`.

The next implementation should extend the existing `animations` arrays with the smallest
SVG+CSS motion recipes needed to generate the current stylesheet. Each recipe should use
this shape:

```json
{
  "part": "part-body",
  "name": "devbrain-idle-breathe",
  "durationMs": 1800,
  "timing": "ease-in-out",
  "iteration": "infinite",
  "keyframes": [
    { "offset": "0%, 100%", "transform": "scale(1)" },
    { "offset": "50%", "transform": "scale(.985, 1.035)" }
  ],
  "reduced": { "transform": "scale(1)" }
}
```

Required recipes:

| State | Part | Keyframe name | Reduced transform |
|---|---|---|---|
| `idle` | `part-body` | `devbrain-idle-breathe` | `scale(1)` |
| `idle` | `part-eyes` | `devbrain-blink` | no transform |
| `active` | `part-leg-left` | `devbrain-walk-left` | `rotate(10deg)` |
| `active` | `part-leg-right` | `devbrain-walk-right` | `rotate(-10deg)` |
| `alert` | `part-antenna` | `devbrain-antenna-pulse` | `scale(1.08)` |
| `alert` | `part-moustache` | `devbrain-recoil` | `translateX(-4px)` |

The emitter should fail fast if an animation recipe references an unknown state, unknown
part ID, duplicate keyframe name, missing duration, missing timing, missing iteration,
or invalid keyframe transform data.

### Planned Files After Approval

| Path | Action | Purpose |
|---|---|---|
| `docs/buildable-slice/devbrain-rigged.json` | Modify | Add the minimal SVG+CSS motion recipes under the existing `animations` keys. |
| `tools/emit-svg-css.ps1` | Create | Dependency-free emitter using PowerShell XML and JSON APIs already used by the checker. |
| `docs/buildable-slice/generated/` | Create | Holds generated SVG+CSS Output Target files separate from fixture sources. |
| `docs/buildable-slice/generated/devbrain-svg-css.generated.svg` | Generate | Copy the Manual Part SVG geometry, preserve semantic IDs, and link generated CSS. |
| `docs/buildable-slice/generated/devbrain-svg-css.generated.css` | Generate | Emit part origins, state selectors, keyframes, and reduced-motion rules from `rigged.json`. |
| `docs/buildable-slice/generated/devbrain-svg-css.generated-demo.html` | Generate | Emit the standalone state switcher from the `states` array. |
| `tools/check-buildable-slice.ps1` | Modify | Validate generated files, data parity, reduced-motion selectors, and `impact` placement. |
| `docs/buildable-slice/README.md` | Modify | Document generated demo usage and golden/parity status. |
| `docs/buildable-slice-svg-css-implementation-plan.md` | Modify | Record implementation result, caveats, and verification output. |

No root `package.json`, npm dependency, package scaffold, DevBrain asset copy, ADR
change, React+GSAP package setup, vectorizer, segmentation step, Motion Intent UI, or
telemetry binding belongs in this stage.

### Implementation Steps After Approval

1. Extend `docs/buildable-slice/devbrain-rigged.json` with the six motion recipes listed
   above, keeping `states` exactly `idle`, `active`, and `alert`.
2. Add `tools/emit-svg-css.ps1` with parameters for `-SvgPath`, `-RigPath`, and
   `-OutDir`, defaulting to the existing Buildable Slice fixture paths.
3. In the emitter, parse the Manual Part SVG with `[xml]` and `rigged.json` with
   `ConvertFrom-Json`; do not use string parsing for contract validation.
4. Validate semantic IDs, part origins, numeric pivots, parent-before-child bones,
   animation state keys, and `accents.impact` before writing generated files.
5. Generate the SVG file by copying the Manual Part SVG document, preserving geometry and
   semantic IDs, and replacing the stylesheet processing instruction with the generated
   CSS filename.
6. Generate the CSS file from `rigged.json` parts and animation recipes, including
   `transform-box: fill-box`, `transform-origin`, `data-state` selectors, keyframes,
   `prefers-reduced-motion: reduce`, and `.force-reduced-motion` selectors.
7. Generate the demo HTML from the `states` array, with buttons only for `idle`,
   `active`, and `alert`, query-param routing, and `?reduce=1` support.
8. Extend `tools/check-buildable-slice.ps1` so the current structural checks also cover
   the generated files and prove generated state controls come from `rigged.json`.
9. Run the emitter, then run structural checks and capture generated reduced-motion
   screenshots through the existing browser automation path if available without adding
   repo dependencies.
10. Compare generated output against the current source-pixel demo by structure first:
    same semantic part IDs, same state list, same reduced-motion state transforms, same
    state buttons, and no `impact` state. Use human review for visual parity until
    accepted goldens exist.

### Verification For The Approved Emitter Stage

Run from `C:\Users\dev\Dev\mascot-forge`:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\emit-svg-css.ps1
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-buildable-slice.ps1
git diff --check
$rig = Get-Content -Raw 'docs/buildable-slice/devbrain-rigged.json' | ConvertFrom-Json
if ($rig.states -contains 'impact') { throw 'impact must stay outside states' }
```

Additional review checks:

- `docs/buildable-slice/generated/` contains only generated SVG+CSS demo files.
- Generated demo buttons are exactly `idle`, `active`, and `alert`.
- Generated CSS includes no `data-state="impact"` selector.
- React+GSAP remains mentioned only as deferred Output Target work.
- Any visual baseline copied into `docs/buildable-slice/goldens/` is an explicitly
  accepted reduced-motion screenshot.

### Stop Conditions

Stop and ask before:

- implementing this plan without explicit approval
- adding any npm dependency, root package manifest, or package scaffold
- copying, editing, or deriving new files from DevBrain assets
- deleting or moving existing files
- changing ADR decisions
- adding `impact` to Animation States
- expanding into vectorization, segmentation, Motion Intent Confirmation, React+GSAP
  package integration, telemetry binding, or broad browser certification
- accepting screenshots as goldens without explicit human approval

## Objective

Implement the first SVG+CSS Buildable Slice as a dependency-free, reviewable slice that
starts from a confirmed Clean Mascot Source, uses a source-pixel Manual Part SVG and a
small `rigged.json` fixture, and demonstrates Output Target Routing for exactly these
Animation States:

- `idle`
- `active`
- `alert`

`impact` remains a transient accent, not a required Animation State.

Evidence:

- Buildable Slice scope and gate:
  `docs/research/buildable-slice-evidence.md`
- SVG+CSS browser behaviour:
  `docs/research/proofs/svg-css-transform-proof.html`
- Project language:
  `CONTEXT.md`
- Pluggable Output Target direction:
  `docs/technical-proposal.md` and `docs/adr/0003-pluggable-emitter.md`

## First Implementation Path

1. Confirm the Clean Mascot Source candidate.
2. Create a Manual Part SVG fixture from the approved source.
3. Create a small `rigged.json` fixture that shares the SVG coordinate system.
4. Create a standalone SVG+CSS output page that consumes the fixture shape and exposes
   `?state=<idle|active|alert>&reduce=1`.
5. Add no-dependency structural checks for semantic SVG IDs, `rigged.json`, supported
   states, reduced-motion selectors, and `impact` placement.
6. Capture deterministic reduced-motion screenshots for review before accepting golden
   images.

The first pass should prove the contract and test path before adding code generation.
React+GSAP remains deferred until a later Output Target pass with explicit package
approval.

## Files For The First Implementation Pass

Existing files to read:

| Path | Use |
|---|---|
| `README.md` | Preserve current pre-alpha/docs-first positioning. |
| `CONTEXT.md` | Preserve Buildable Slice, Clean Mascot Source, Manual Part SVG, Motion Intent, Animation State, Output Target, Output Target Routing, Routing Matrix, and Future Expansion Note language. |
| `docs/technical-proposal.md` | Keep the Phase 3 and pluggable emitter framing intact. |
| `docs/adr/0006-research-first-buildable-slice.md` | Do not start outside the researched Buildable Slice. |
| `docs/research/buildable-slice-evidence.md` | Source of readiness claims, constraints, cons, and caveats. |
| `docs/research/proofs/svg-css-transform-proof.html` | Local Proof pattern for SVG transforms, `data-state`, and reduced motion. |
| `docs/research/proofs/README.md` | Local Proof purpose and verification notes. |
| `assets/README.md` | DevBrain asset context and local asset paths. |

Planned files to create:

| Path | Purpose |
|---|---|
| `docs/buildable-slice/README.md` | Records source confirmation, implementation notes, accepted caveats, and how to run the slice. |
| `docs/buildable-slice/devbrain-manual-part.svg` | Manual Part SVG fixture with semantic part groups. |
| `docs/buildable-slice/devbrain-rigged.json` | Small Spine-like rig fixture for the Manual Part SVG. |
| `docs/buildable-slice/devbrain-svg-css.css` | SVG+CSS Output Target stylesheet for state loops and reduced motion. |
| `docs/buildable-slice/devbrain-svg-css-demo.html` | Standalone browser harness with state query params and static reduced-motion mode. |
| `docs/buildable-slice/goldens/` | Planned screenshot baseline folder, populated only after first visual review. |
| `tools/check-buildable-slice.ps1` | No-dependency structural validation for SVG, JSON, state scope, and reduced-motion markers. |

No root `package.json`, package scaffold, npm dependency, React file, GSAP integration,
automated vectorizer, segmentation tool, or DevBrain telemetry binding belongs in this
first pass.

## Clean Mascot Source Confirmation

Candidate found:

| Field | Value |
|---|---|
| Candidate path | `C:\Users\dev\Dev\DevBrain\public\mascot\default.png` |
| Dimensions | `192x192` |
| Pixel format | `Format32bppArgb` |
| Alpha flag | `true` |
| Corner alpha values | `0,0,0,0` |
| File size | `15670` bytes |
| Last modified | `2026-06-16 13:32:59` |

The parallel copy at
`C:\Users\dev\Dev\DevBrain-mascot\public\mascot\default.png` has the same
dimensions, pixel format, alpha flag, corner alpha values, and file size.

The checked-in `assets/devbrain-mascot-reference-v1.png` remains a reference sheet only.
It is `1536x1024`, `Format24bppRgb`, has opaque corners, contains multiple poses and
labels, and is not a Clean Mascot Source. This preserves the negative finding in the
Evidence Pack.

Confirmation steps for the first implementation pass:

1. Ask the user to approve the candidate path as the Clean Mascot Source before copying,
   tracing, transforming, or deriving files from it.
2. Re-run the metadata check and record the result in `docs/buildable-slice/README.md`.
3. Visually confirm it is one transparent pose with enough transparent room for antenna
   and leg motion.
4. If the candidate is not approved, stop and request an approved transparent single-pose
   PNG.

Evidence:

- `assets/README.md` identifies the DevBrain mascot paths and explains the current
  flipbook PNG baseline.
- `docs/research/buildable-slice-evidence.md` Section 5 defines Clean Mascot Source
  requirements and records why the checked-in reference sheet is not suitable.
- The metadata above comes from a local check run on 2026-06-17.

## Manual Part SVG Fixture Requirements

Create `docs/buildable-slice/devbrain-manual-part.svg` only after Clean Mascot Source
approval.

Requirements:

- Use `viewBox="0 0 192 192"` if the approved source remains the `192x192` candidate.
- Include one coordinate-control wrapper group, `rig-root`.
- Use readable semantic group IDs:
  `part-body`, `part-leg-left`, `part-leg-right`, `part-antenna`, `part-eyes`, and
  `part-moustache`.
- Keep generated or decorative path IDs out of the public contract.
- Keep the SVG reviewable through semantic part groups and source-pixel row-run geometry.
- Include per-part pivot metadata in either SVG data attributes or the matching
  `rigged.json` `parts` entries.
- Preserve enough transparent breathing room around animated parts.
- Keep all moving parts in the same coordinate system used by `rigged.json`.

The fixture does not need to perfectly reproduce the final production mascot. It must be
close enough to verify independent part motion, pivots, state routing, and visual test
stability.

Evidence:

- `docs/research/buildable-slice-evidence.md` Section 5 lists Manual Part SVG
  requirements.
- `docs/research/proofs/svg-css-transform-proof.html` shows the required semantic IDs,
  nested group shape, and pivot style.

## `rigged.json` Fixture Requirements

Create `docs/buildable-slice/devbrain-rigged.json` with a deliberately small
Spine-like model.

Required shape:

```json
{
  "version": 1,
  "source": {
    "kind": "clean-mascot-source",
    "path": "C:\\Users\\dev\\Dev\\DevBrain\\public\\mascot\\default.png",
    "metadata": {
      "width": 192,
      "height": 192,
      "pixelFormat": "Format32bppArgb",
      "hasAlpha": true
    }
  },
  "states": ["idle", "active", "alert"],
  "bones": [
    { "name": "root", "x": 96, "y": 96 },
    { "name": "body", "parent": "root", "x": 0, "y": 0 },
    { "name": "leg_left", "parent": "body", "x": -20, "y": 26, "rotation": 0, "length": 30 },
    { "name": "leg_right", "parent": "body", "x": 20, "y": 26, "rotation": 0, "length": 30 },
    { "name": "antenna", "parent": "body", "x": 22, "y": -30, "rotation": 0, "length": 34 },
    { "name": "moustache", "parent": "body", "x": 0, "y": 2 }
  ],
  "parts": [
    { "id": "part-body", "bone": "body", "origin": "50% 62%", "pivot": { "x": 96, "y": 100 } },
    { "id": "part-leg-left", "bone": "leg_left", "origin": "50% 0%", "pivot": { "x": 76, "y": 122 } },
    { "id": "part-leg-right", "bone": "leg_right", "origin": "50% 0%", "pivot": { "x": 116, "y": 122 } },
    { "id": "part-antenna", "bone": "antenna", "origin": "50% 100%", "pivot": { "x": 118, "y": 66 } },
    { "id": "part-eyes", "bone": "body", "origin": "50% 50%", "pivot": { "x": 96, "y": 86 } },
    { "id": "part-moustache", "bone": "moustache", "origin": "50% 50%", "pivot": { "x": 96, "y": 98 } }
  ],
  "animations": {
    "idle": [],
    "active": [],
    "alert": []
  },
  "accents": {
    "impact": []
  }
}
```

Validation rules:

- `states` must be exactly `idle`, `active`, and `alert`.
- `impact` must appear only under `accents`.
- Every `part.id` must exist in the Manual Part SVG.
- Every part bone must exist in `bones`.
- Parent bones must appear before child bones.
- Numeric pivots and CSS `origin` strings must describe the same intended pivot.
- The root coordinate system must match the SVG `viewBox`.

Evidence:

- `docs/research/buildable-slice-evidence.md` Section 6 recommends a small
  Spine-like bones model and explicitly rejects full Spine/Rive runtime scope.
- The SVG+CSS Local Proof preserves semantic part IDs through nested groups.
- Numeric pivots are an implementation assumption from the Evidence Pack, with the
  planned test being validation against generated CSS origins.

## SVG+CSS Output Target Shape

Create a standalone SVG+CSS demonstration instead of a package-backed emitter in the
first pass.

Required behaviour:

- `docs/buildable-slice/devbrain-svg-css-demo.html` loads the Manual Part SVG shape and
  stylesheet.
- The root mascot element uses `data-state`.
- Query params choose deterministic state:
  `?state=idle`, `?state=active`, or `?state=alert`.
- `?reduce=1` forces the reduced-motion static path for visual testing.
- `idle` applies breathing and occasional blink loops.
- `active` applies simple alternating leg motion.
- `alert` applies antenna pulse and moustache recoil.
- CSS uses explicit `transform-origin` and `transform-box: fill-box` for moving parts.
- CSS includes a `prefers-reduced-motion: reduce` branch and a forced reduced-motion
  class used by `?reduce=1`.
- The page exposes a small state switcher for manual review, but tests should prefer
  query params.

Evidence:

- `docs/research/proofs/svg-css-transform-proof.html` proves nested group transforms,
  `data-state` selectors, explicit pivots, and reduced-motion mode.
- `docs/research/buildable-slice-evidence.md` Sections 7 and 10 recommend SVG+CSS as
  the first Output Target and route React+GSAP to later richer-interruption needs.

## Visual And Golden Testing Strategy

Use two test layers.

Structure checks:

- Parse `devbrain-rigged.json`.
- Parse `devbrain-manual-part.svg` as XML.
- Verify all semantic part IDs exist.
- Verify the supported Animation States are exactly `idle`, `active`, and `alert`.
- Verify `impact` is an accent only.
- Verify the demo page and CSS include reduced-motion selectors.
- Verify no package scaffold exists as a side effect of this pass.

Visual checks:

- Open the demo at a fixed viewport.
- Capture deterministic reduced-motion screenshots for:
  `?state=idle&reduce=1`, `?state=active&reduce=1`, and `?state=alert&reduce=1`.
- Assert all semantic part IDs exist before accepting screenshots.
- Accept the first screenshots only after user review.
- Store accepted baselines under `docs/buildable-slice/goldens/`.
- Defer moving-frame visual diffs until static reduced-motion frames are stable.

Evidence:

- `docs/research/buildable-slice-evidence.md` Section 9 defines structure checks before
  visual comparisons and recommends deterministic `?state=<name>&reduce=1` screenshots.
- `docs/research/proofs/README.md` records the proof convention for deterministic
  screenshot query params.

## Reduced-Motion Test Path

The reduced-motion path is required in the first implementation pass.

Rules:

- `?reduce=1` must add a force-reduced-motion class to the document root.
- `prefers-reduced-motion: reduce` must also disable loops for user settings.
- Reduced mode must keep the selected state readable without infinite animation.
- Screenshot commands must use `?reduce=1`.
- The state switcher may remain interactive, but automated checks should not depend on
  animation timing.

Evidence:

- `docs/research/proofs/svg-css-transform-proof.html` includes both media-query reduced
  motion and forced query-param reduced motion.
- `docs/research/buildable-slice-evidence.md` Sections 3, 7, and 9 require reduced
  motion and deterministic screenshots.

## `impact` As Transient Accent

`impact` stays outside `states` in the first implementation.

Allowed representation:

- `rigged.json` may include `accents.impact`.
- A later proof may add `data-accent="impact"` or a short-lived class.
- `alert` may reuse moustache recoil as part of the `alert` state.

Not allowed in this pass:

- Adding `impact` to the `states` list.
- Adding an `impact` state button beside `idle`, `active`, and `alert`.
- Changing Output Target Routing because of `impact` without a new Local Proof.

Evidence:

- `docs/research/buildable-slice-evidence.md` Sections 1, 6, 7, 11, and 16 keep
  `impact` as an accent unless later evidence proves it must own the whole mascot pose.

## Explicit Non-Goals

The first implementation pass must not:

- Add npm dependencies.
- Create a root `package.json`.
- Create a package scaffold.
- Implement React+GSAP package integration.
- Implement automated PNG-to-SVG vectorization.
- Implement automated segmentation.
- Implement AI Motion Intent parsing.
- Implement a Motion Intent Confirmation UI.
- Bind to DevBrain telemetry.
- Delete, move, copy, or transform DevBrain assets without explicit user approval.
- Change accepted ADR decisions.
- Promote `impact` to a required Animation State.
- Expand Future Expansion Notes into the Buildable Slice.
- Claim broad browser support from Chromium-only proof results.

Evidence:

- These scope locks come from `docs/research/buildable-slice-evidence.md`,
  `docs/adr/0006-research-first-buildable-slice.md`, and
  `docs/research/next-stage-prompt.md`.

## Verification Commands For The First Implementation Pass

Run from `C:\Users\dev\Dev\mascot-forge`.

Clean source metadata:

```powershell
$path = 'C:\Users\dev\Dev\DevBrain\public\mascot\default.png'
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile($path)
try {
  [PSCustomObject]@{
    Width = $img.Width
    Height = $img.Height
    PixelFormat = $img.PixelFormat.ToString()
    HasAlphaFlag = [bool]($img.PixelFormat -band [System.Drawing.Imaging.PixelFormat]::Alpha)
    CornerAlpha = @(
      $img.GetPixel(0, 0).A
      $img.GetPixel($img.Width - 1, 0).A
      $img.GetPixel(0, $img.Height - 1).A
      $img.GetPixel($img.Width - 1, $img.Height - 1).A
    ) -join ','
  }
} finally {
  $img.Dispose()
}
```

Structural validation after planned files exist:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\tools\check-buildable-slice.ps1
```

Text and scope checks:

```powershell
git diff --check
rg -n "npm install|pnpm|yarn|package scaffold|React\+GSAP package|@gsap/react|gsap" docs/buildable-slice tools
$rig = Get-Content -Raw 'docs/buildable-slice/devbrain-rigged.json' | ConvertFrom-Json
if ($rig.states -contains 'impact') { throw 'impact must stay outside states' }
```

The second command should only report allowed deferral language in documentation, not an
instruction to add a package or implement React+GSAP. The state check should complete
without throwing because `impact` must not be listed as a state.

Visual capture should use an already available browser or test harness without adding
repo dependencies. If no browser automation is available, stop before adding a test
package and ask for approval. Capture these URLs at the same viewport:

```text
docs/buildable-slice/devbrain-svg-css-demo.html?state=idle&reduce=1
docs/buildable-slice/devbrain-svg-css-demo.html?state=active&reduce=1
docs/buildable-slice/devbrain-svg-css-demo.html?state=alert&reduce=1
```

## Stop Conditions

Stop and ask before:

- Copying, tracing, transforming, or editing DevBrain asset files.
- Adding any dependency or package scaffold.
- Creating or modifying a root package manifest.
- Implementing product code beyond the planned fixture, demo page, stylesheet, and
  validation script.
- Deleting or moving files.
- Changing accepted ADR decisions.
- Adding React+GSAP package setup.
- Expanding beyond SVG+CSS.
- Adding `impact` to `states`.
- Claiming cross-browser support without Firefox and WebKit checks.

Stop and revise the plan if:

- The Clean Mascot Source candidate is rejected.
- The approved source is not `192x192`.
- Manual Part SVG coordinates cannot share a coordinate system with `rigged.json`.
- The reduced-motion screenshots are visually ambiguous.
- Structural checks require a package scaffold to run.

## Open Caveats

| Caveat | Current handling | Evidence path |
|---|---|---|
| Clean Mascot Source is not checked into this repo. | Candidate external path recorded; first pass must ask before copy or derivation. | `assets/README.md`; Evidence Pack Section 5. |
| Manual Part SVG is source-pixel row-run geometry. | Use it only to prove rigging and Output Targets before production vectorization exists. | Evidence Pack Sections 5, 15, and 16. |
| Numeric pivots may need adjustment. | Store both CSS `origin` and numeric `pivot`, then validate against visual output. | Evidence Pack Sections 6 and 14. |
| Visual goldens need human acceptance. | Capture deterministic reduced-motion frames first, then accept baselines after review. | Evidence Pack Section 9. |
| React+GSAP package integration remains unproven. | Defer to a later pass after explicit package approval. | Evidence Pack Sections 4, 8, 10, and 16. |
| Chromium proof is not cross-browser certification. | Treat first pass as feasibility, with Firefox/WebKit checks before broader claims. | Evidence Pack Sections 9 and 14. |

## Handoff Summary For Follow-Up Agent

Start from the accepted SVG+CSS fixture/demo and goldens. Implement only the planned
minimal dependency-free SVG+CSS emitter contract: extend `devbrain-rigged.json` with the
six motion recipes, add `tools/emit-svg-css.ps1`, generate SVG+CSS demo files under
`docs/buildable-slice/generated/`, and extend `tools/check-buildable-slice.ps1` for
generated parity checks. Keep `impact` as `accents.impact`, preserve the accepted
goldens, and stop before any dependency, package scaffold, DevBrain asset copy, ADR
change, React+GSAP setup, vectorization, segmentation, Motion Intent UI, telemetry
binding, or broad browser certification.
