# Buildable Slice Evidence Pack

> Status: First research pass complete (2026-06-17). Implementation gate:
> **Go with caveats**.

## Research priority

This pass researched the agreed Buildable Slice in the requested order:

1. SVG transform behaviour on nested groups
2. React+GSAP lifecycle and interruption model
3. Clean DevBrain asset requirements
4. Rig schema details
5. Visual/golden testing strategy
6. Routing Matrix

## 1. Scope and non-goals

The Buildable Slice is:

```text
Clean Mascot Source -> Motion Intent -> Manual Part SVG / rigged.json -> Output Target Routing
```

The sample Motion Intent remains:

> Idle breathing, legs walk during activity, antenna pulses on alert, eyes blink occasionally, moustache recoils on impact or alert.

The first implementation should target named Animation States only:

- `idle`
- `active`
- `alert`

Research conclusion for `impact`: treat `impact` as a transient animation accent, not a
fourth required Animation State, for the first implementation. The sample intent already
allows moustache recoil on `alert`; a later state orchestrator can expose `impact` as a
one-shot accent when telemetry/event binding exists.

Non-goals for this Evidence Pack:

- no mascot-forge product implementation
- no package scaffold
- no npm dependencies
- no automated PNG-to-SVG vectorization
- no automated segmentation
- no AI Motion Intent parsing
- no real DevBrain telemetry binding
- no full Spine/Rive runtime clone

## 2. Evidence Standard

Each implementation-readiness claim must have one of:

- a primary source
- a Local Proof
- a clearly marked assumption with a planned test

Cons, constraints, and negative findings are first-class evidence. If research shows an
approach is not worth using now, record the finding, the reason, and what evidence would
change it.

### Source Hierarchy

- Browser behaviour: MDN, specs, browser compatibility data, and Local Proofs
- React: official React docs
- GSAP: official GSAP docs, official GSAP React integration, and license pages
- Rig models: official Spine or Rive docs where possible
- Testing: Playwright or tool-vendor docs
- Competitor positioning: official docs first, credible comparison articles second

Source links in this pass were checked live on 2026-06-17 because browser/runtime and
license claims are current-version sensitive.

## 3. SVG transform behaviour on nested groups

### Evidence

- Source: [MDN SVG `transform` attribute](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/transform)
- Source: [MDN CSS `transform-origin`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-origin)
- Source: [MDN CSS `transform-box`](https://developer.mozilla.org/en-US/docs/Web/CSS/transform-box)
- Source: [MDN `prefers-reduced-motion`](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- Local Proof: [`docs/research/proofs/svg-css-transform-proof.html`](proofs/svg-css-transform-proof.html)

### Findings

Nested SVG `<g>` transforms are suitable for a Manual Part SVG. The Local Proof composes
a parent `translate(...) scale(...)` transform with a child `translate(...)` transform
and verifies the expected coordinate result after normalizing out responsive viewport
scaling.

Per-part pivots should be emitted explicitly. `transform-origin` and `transform-box:
fill-box` can make a part-local pivot practical for limbs, antenna, eyes, and moustache
motion, but generated output should not rely on SVG defaults.

Animation State switching can be represented with `data-state`. The Local Proof drives
`idle`, `active`, and `alert` with CSS selectors such as
`#mascot[data-state="active"] #part-leg-left`.

Reduced motion can disable loops through `prefers-reduced-motion`. The Local Proof also
supports `?reduce=1` so screenshot tests can force a deterministic static frame without
depending on the tester's OS preference.

### Cons and constraints

- SVG transform tests must normalize viewport scaling; raw CTM comparisons change when
  the SVG is responsive.
- Every moving part needs an explicit pivot/origin. Bad pivots are likely to look worse
  than whole-sprite motion.
- CSS keyframes are enough for repeatable loops and simple state selectors, but richer
  interruption, labels, and sequenced one-shot accents are more awkward than in GSAP.
- Screenshot tests should prefer `?state=<name>&reduce=1` to avoid capturing arbitrary
  animation frames.

## 4. React+GSAP lifecycle and interruption model

### Evidence

- Source: [React `useEffect`](https://react.dev/reference/react/useEffect)
- Source: [GSAP React integration (`@gsap/react`)](https://github.com/greensock/react)
- Source: [GSAP Timeline docs](https://gsap.com/docs/v3/GSAP/Timeline/)
- Source: [GSAP standard license](https://gsap.com/community/standard-license/)
- Local Proof: [`docs/research/proofs/react-gsap-lifecycle-proof.html`](proofs/react-gsap-lifecycle-proof.html)

### Findings

React animation setup must be idempotent and cleanup-aware. React effects can run setup
and cleanup more than once in development, so generated animation code should tolerate
repeat setup, dependency updates, and teardown.

`@gsap/react` is the right React integration point when the `React+GSAP` Output Target is
chosen. It wraps GSAP setup in a hook, scopes selector text to a container, and can revert
animations when hook dependencies change.

GSAP timelines are a better fit than CSS for expressive interruption and accents. The
Local Proof uses `useGSAP()`, `revertOnUpdate`, timeline cleanup, and telemetry-like
state changes. In Chromium verification with `?auto=1&reduce=1`, it recorded:

- setup count: `4`
- cleanup count: `3`
- current timeline: `static:idle`
- semantic part IDs present: `part-moustache`, `part-antenna`

Reduced motion should branch before creating looping timelines. The Local Proof switches
to a static pose when `reduce=1` or `prefers-reduced-motion: reduce` is active.

GSAP licensing is not a blocker for this Buildable Slice based on the current standard
license source. License state must still be re-checked immediately before adding GSAP as
a package dependency.

### Cons and constraints

- The Local Proof is CDN-backed to avoid adding dependencies or a package scaffold. That
  proves browser/runtime behaviour, not final bundler integration.
- Adding React, GSAP, or `@gsap/react` to the repo remains a stop condition and requires
  explicit approval.
- `React+GSAP` increases runtime/dependency surface compared with `SVG+CSS`.
- Generated code must register plugins once, scope selectors, and clean timelines on
  state changes.

## 5. Clean DevBrain asset requirements

### Evidence

- Local source: [`assets/README.md`](../../assets/README.md)
- Local metadata check: `assets/devbrain-mascot-reference-v1.png` is `1536x1024`,
  `Format24bppRgb`

### Findings

The Buildable Slice requires a single Clean Mascot Source:

- one transparent PNG pose
- cropped to the mascot, not a labelled reference sheet
- no background removal, crop detection, or shadow cleanup required at runtime
- stable pixel grid suitable for a Manual Part SVG
- enough surrounding transparent space for antenna and limb motion
- source pose chosen to support the sample Motion Intent

Negative finding: the checked-in `assets/devbrain-mascot-reference-v1.png` is a reference
sheet, not a Clean Mascot Source. It is RGB, not transparent alpha, and contains multiple
poses plus labels. It should remain a visual reference only.

### Manual Part SVG requirements

For this Buildable Slice, Manual Part SVG is allowed to stand in for future
vectorization. It should include:

- a stable `viewBox`
- readable semantic group IDs, such as `part-body`, `part-leg-left`,
  `part-leg-right`, `part-antenna`, `part-eyes`, and `part-moustache`
- one wrapper/root group for coordinate control
- explicit per-part pivots through `transform-origin`/`transform-box` metadata or
  equivalent `rigged.json` pivot fields
- no generated path names as the only semantic handle

### Open assumption and planned test

Assumption: a clean transparent single-pose DevBrain PNG can be exported from the
existing DevBrain mascot assets without new art direction.

Planned test: before product implementation, create or identify the Clean Mascot Source
and run a metadata check for alpha support, dimensions, transparent corners, and one-pose
content.

## 6. Rig model and `rigged.json` schema evidence

### Evidence

- Source: [Spine JSON export format](http://en.esotericsoftware.com/spine-json-format)
- Source: [Spine bones user guide](http://en.esotericsoftware.com/spine-bones)
- Source: [Rive bones help](https://help.rive.app/editor/manipulating-shapes/bones)
- Local Proofs: both proof pages preserve semantic SVG part IDs and show parent/child
  transform inheritance through nested groups

### Findings

The first `rigged.json` should use a small Spine-like bones model, not the full Spine
schema. The useful proven concepts are:

- ordered bones, with parents before children
- named parent-child relationships
- x/y offsets and rotation fields
- length as optional documentation for limbs/antenna
- parts attached to bones by semantic SVG IDs
- Animation State to animation mapping

Recommended minimum shape:

```json
{
  "states": ["idle", "active", "alert"],
  "bones": [
    { "name": "root", "x": 80, "y": 66 },
    { "name": "body", "parent": "root", "x": 0, "y": 0 },
    { "name": "leg_left", "parent": "body", "x": -20, "y": 21, "rotation": 0, "length": 25 },
    { "name": "leg_right", "parent": "body", "x": 20, "y": 21, "rotation": 0, "length": 25 },
    { "name": "antenna", "parent": "body", "x": 0, "y": -22, "rotation": 0, "length": 34 },
    { "name": "moustache", "parent": "body", "x": 0, "y": 5 }
  ],
  "parts": [
    { "id": "part-leg-left", "bone": "leg_left", "origin": "50% 0%" },
    { "id": "part-leg-right", "bone": "leg_right", "origin": "50% 0%" },
    { "id": "part-antenna", "bone": "antenna", "origin": "50% 100%" },
    { "id": "part-moustache", "bone": "moustache", "origin": "50% 50%" }
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

`impact` should live under `accents` first. Promote it to an Animation State only if the
implementation discovers that Output Target Routing or state orchestration needs it to
own the whole mascot pose.

### Cons and constraints

- Do not implement Spine slots, skins, constraints, IK, mesh deformation, or a Rive-like
  editor model in the Buildable Slice.
- Parent-before-child ordering should be validated before emit.
- `origin` strings are convenient for CSS, but the schema may also need numeric pivot
  coordinates for precise codegen. That is an open implementation test.
- Manual Part SVG coordinates and `rigged.json` coordinates must share one coordinate
  system, or transforms will drift.

## 7. `SVG+CSS` implementation pattern

### Evidence

- Sources and Local Proof from Section 3
- Local Proof path:
  [`docs/research/proofs/svg-css-transform-proof.html`](proofs/svg-css-transform-proof.html)

### Pattern

Use a semantic inline or external SVG with part groups and a small stylesheet:

- `data-state="idle"` drives breathing and occasional blinking
- `data-state="active"` drives leg walk loops
- `data-state="alert"` drives antenna pulse and moustache recoil
- `prefers-reduced-motion` disables loops
- optional future `data-accent="impact"` or a short-lived class can trigger one-shot
  recoil without turning `impact` into a full Animation State

### Best fit

`SVG+CSS` is the recommended first implementation Output Target. It proves the core
owned-code promise with no runtime dependency and no package setup. It is sufficient for
the first three Animation States and keeps product implementation focused on Manual Part
SVG, `rigged.json`, and Output Target Routing.

### Cons and constraints

- Complex interruption is not as explicit as GSAP timeline cleanup.
- One-shot accents need a tiny JS/state layer to add/remove a class or `data-accent`.
- CSS animations are less ergonomic for long, sequenced, labelled timelines.

## 8. `React+GSAP` implementation pattern

### Evidence

- Sources and Local Proof from Section 4
- Local Proof path:
  [`docs/research/proofs/react-gsap-lifecycle-proof.html`](proofs/react-gsap-lifecycle-proof.html)

### Pattern

Use a generated React component with semantic inline SVG and a scoped `useGSAP()` block:

- register GSAP React plugin once
- scope selector text to the component root
- branch on reduced motion before creating loops
- clean up or revert timelines on state changes
- express `alert` and future `impact` accents with labelled timelines

### Best fit

`React+GSAP` should be routed to users who want richer interruption, event accents, or a
React-native integration point. It is not blocked, but it should be the second Output
Target after the first `SVG+CSS` implementation proves the schema and Manual Part SVG
contracts.

### Cons and constraints

- Requires package/dependency approval before repo implementation.
- Requires bundler integration proof after package setup is approved.
- Higher dependency/runtime surface than `SVG+CSS`.

## 9. Visual/golden testing strategy

### Evidence

- Source: [Playwright screenshots](https://playwright.dev/docs/screenshots)
- Source: [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)
- Local Proof verification: both proof pages were loaded in Chromium with deterministic
  query params and screenshots saved outside the repo temp folder

### Recommended strategy

For first implementation, use two layers of tests:

1. Structure/golden tests:
   - generated files contain expected semantic IDs
   - `rigged.json` validates parent-before-child bones
   - supported Animation States are exactly `idle`, `active`, `alert`
   - `impact` is represented only as an accent unless deliberately promoted

2. Browser visual tests:
   - render each Output Target in Chromium
   - screenshot `?state=idle&reduce=1`
   - screenshot `?state=active&reduce=1`
   - screenshot `?state=alert&reduce=1`
   - assert no missing part IDs before comparing screenshots

Use moving-frame tests later only when the first deterministic static screenshots are
stable. For motion, prefer sampling known timeline offsets or asserting generated
animation declarations before relying on pixel diffs.

### Cons and constraints

- Animated screenshots are noisy unless reduced motion or a fixed timeline position is
  forced.
- Chromium proof is enough for this first pass; Firefox/WebKit parity should be tested
  before claiming broad browser support.
- Visual diffs can fail from font/rendering/environment noise. Keep proof pages mostly
  SVG and avoid text inside the visual target area.

## 10. Routing Matrix

| Output Target Criteria | `SVG+CSS` | `React+GSAP` | Routing guidance |
|---|---|---|---|
| Editable output quality | Strong: semantic SVG plus CSS | Strong: semantic inline SVG plus timeline code | Both fit the owned-code promise. |
| Runtime size/dependencies | Best: no animation dependency | Higher: React app plus GSAP packages | Choose `SVG+CSS` first when dependency minimization matters. |
| Animation expressiveness | Good for loops and simple state selectors | Best for sequencing, labels, interruption, one-shot accents | Route richer eventful mascots to `React+GSAP`. |
| Reduced motion | Proven with media query | Proven with branch to static pose | Both must emit reduced-motion handling. |
| Interruption model | Class/data changes; less explicit cleanup | Proven setup/cleanup and timeline replacement | Use `React+GSAP` for frequent telemetry/event interruption. |
| Generated-code maintainability | Simple CSS selectors; easy to inspect | More code, but scoped hooks keep structure readable | Use `SVG+CSS` for first slice; route advanced needs later. |
| Visual testability | Strong with deterministic query params | Strong with deterministic reduced mode | Both are testable with Playwright. |
| Licensing | Browser-native | GSAP license source currently acceptable | Re-check GSAP license before dependency addition. |
| First-slice risk | Lowest | Medium because package setup is deferred | First implementation should be `SVG+CSS`. |

### Recommended first implementation Output Target

Recommended first Output Target: **`SVG+CSS`**.

Evidence supports `SVG+CSS` as the narrowest buildable first target because it satisfies
the three required Animation States, preserves readable Manual Part SVG groups, supports
reduced motion, can be screenshot-tested, and requires no dependency or package scaffold.

### Output Target Routing rules

Choose `SVG+CSS` when:

- the mascot needs lightweight, framework-agnostic output
- states are mostly looping or selector-driven
- dependency footprint matters
- the first goal is to prove Manual Part SVG and `rigged.json`
- reduced-motion and screenshot-test paths should stay simple

Choose `React+GSAP` when:

- the host app is React
- timeline sequencing, labels, repeats, or yoyo motion matter
- telemetry-like events frequently interrupt current animation
- one-shot accents such as `impact` need precise replay/cleanup
- the user accepts adding React/GSAP dependencies

## 11. Cons, constraints, and negative findings

### Cons and constraints

- The current DevBrain reference PNG is not a Clean Mascot Source.
- Manual Part SVG is required for the Buildable Slice; automated vectorization remains
  future work.
- SVG pivots must be explicit and reviewed. Pivot mistakes are user-visible.
- Responsive SVG testing must normalize viewport scaling before asserting transform
  math.
- `SVG+CSS` cannot express complex interruption as cleanly as GSAP.
- The React+GSAP proof is CDN-backed; package/bundler integration is unproven until
  dependency approval.
- No npm dependencies or root package scaffold should be added without approval.
- `impact` should remain a transient accent until a state-orchestration proof needs it
  to become a full Animation State.
- Browser/runtime and license sources should be re-checked before dependency changes.

### Negative findings

| Finding | Evidence | Consequence |
|---|---|---|
| Existing `assets/devbrain-mascot-reference-v1.png` is not a Clean Mascot Source. | Local metadata: `1536x1024`, `Format24bppRgb`; asset README says reference sheet. | Export or identify a single transparent pose before implementation relies on the real asset. |
| Raw CTM assertions are brittle in responsive SVG. | Local Proof failed until viewport scaling was normalized. | Transform tests must compare in normalized SVG coordinates. |
| `impact` should not be a required fourth Animation State yet. | Scope requires `idle`, `active`, `alert`; current proof can express recoil under `alert`. | Model `impact` as an accent with a planned one-shot test. |
| Full Spine/Rive schemas are too large for the Buildable Slice. | Official docs show much richer models than this slice needs. | Borrow bones/parenting concepts only. |
| React+GSAP package integration is not proven. | Local Proof avoids repo dependencies via CDN. | Ask before package setup, then run a bundler proof. |

## 12. Local Proof checklist

### `SVG+CSS` Local Proof

File: [`docs/research/proofs/svg-css-transform-proof.html`](proofs/svg-css-transform-proof.html)

Verification result in Chromium: **pass**.

- [x] Nested SVG `<g>` transforms compose predictably.
- [x] Per-part `transform-origin` works as needed for limbs and antenna.
- [x] State changes can be driven by `data-state`.
- [x] `prefers-reduced-motion` or `?reduce=1` can disable loops.
- [x] The result can be screenshot-tested in a browser.

### `React+GSAP` Local Proof

File: [`docs/research/proofs/react-gsap-lifecycle-proof.html`](proofs/react-gsap-lifecycle-proof.html)

Verification result in Chromium: **pass**, with CDN/network caveat.

- [x] `useGSAP()` initializes and cleans up timelines.
- [x] A telemetry-like state change interrupts one animation and starts another.
- [x] Reduced motion disables timelines or switches to static state.
- [x] Generated code can keep semantic SVG part IDs and groups readable.
- [x] The proof exposes where GSAP adds value over plain CSS.

## 13. Implementation readiness checklist

| Gate item | Status | Evidence |
|---|---|---|
| Clean Mascot Source requirements are known. | Ready with caveat | Requirements listed; current asset is a negative finding. |
| Manual Part SVG requirements are known. | Ready | Section 5 plus Local Proof semantic IDs. |
| Rig schema choice is justified. | Ready | Spine/Rive docs support small bones/parenting model. |
| `SVG+CSS` Local Proof passes. | Ready | Chromium verification passed. |
| `React+GSAP` Local Proof passes or is explicitly deferred with evidence. | Ready with caveat | Proof passes via CDN; package setup deferred. |
| Routing Matrix recommends a first implementation Output Target. | Ready | `SVG+CSS` recommended first. |
| Visual testing approach is defined. | Ready | Section 9. |
| Cons, constraints, negative findings, and open assumptions are listed. | Ready | Sections 11 and 14. |
| First implementation tasks are clear enough to start. | Ready with caveat | Start with Clean Mascot Source confirmation, Manual Part SVG, small `rigged.json`, then `SVG+CSS` emitter. |

## 14. Open assumptions

| Assumption | Why it is acceptable now | Planned test |
|---|---|---|
| A clean transparent single-pose DevBrain PNG can be exported from existing assets. | DevBrain owns the mascot and already has pose PNGs/reference art. | Identify/export Clean Mascot Source and verify alpha, dimensions, and one-pose content. |
| Numeric pivots may be needed in addition to CSS `origin` strings. | CSS strings are enough for proof pages, but codegen may need coordinate math. | During schema implementation, generate both CSS and numeric pivot output from one fixture. |
| `impact` can be a one-shot accent in `SVG+CSS`. | Alert recoil works in proof; event-triggered impact is outside current state-only scope. | Add a small class/`data-accent` proof before implementing event accents. |
| Chromium behaviour is representative enough for first implementation. | Local Proofs are evidence for feasibility, not browser support certification. | Run Firefox/WebKit proof checks before claiming cross-browser support. |
| GSAP bundler integration will follow official React guidance. | Official docs and CDN proof support the lifecycle model. | After explicit dependency approval, create the smallest package proof and run a local build. |

## 15. Future expansion notes

Use Future Expansion Notes for ideas that should be built upon later but are intentionally
outside the Buildable Slice. Each note captures the future idea, why it matters, and what
evidence would justify pulling it into implementation.

Future Expansion Notes use one maturity bucket:

- **Research-backed**: supported by sources or Local Proofs
- **Promising but unproven**: plausible, needs research
- **Speculative**: interesting, but not yet decision-relevant

| Idea | Maturity | Why it matters | Evidence needed to pull into implementation |
|---|---|---|---|
| Automated PNG-to-SVG vectorization | Research-backed | Converts Clean Mascot Sources into editable SVG without manual tracing. | Local Proof using the DevBrain Clean Mascot Source; output quality and editability checks. |
| Assisted segmentation from image regions | Research-backed | Reduces manual part creation after vectorization. | Evidence that colour/connected-region segmentation works on target assets; fallback criteria for SAM/SAM2. |
| AI Motion Intent parsing | Promising but unproven | Lets users describe desired movement naturally. | Local Proof or evaluation showing reliable extraction into Motion Intent Confirmation fields. |
| Motion Intent Confirmation UI | Promising but unproven | Turns fuzzy user intent into repeatable moving parts, pivots, behaviours, and states. | Interaction proof showing users can correct parts and behaviours without SVG knowledge. |
| DevBrain telemetry binding | Research-backed | Connects Animation States to the original dashboard use case. | Mapping proof from DevBrain liveness/health signals to mascot Animation States. |
| User-facing Output Target selection | Promising but unproven | Lets users choose SVG+CSS or React+GSAP based on their needs. | Validate Routing Matrix language against example user needs and generated outputs. |
| Multiple mascot/style support | Speculative | Extends beyond the DevBrain mascot. | Evidence from at least one non-DevBrain asset. |
| Richer rig model | Promising but unproven | May be needed if parts + pivots cannot express hierarchy, recoil, or inherited motion. | Implementation proof comparing parts+pivots with the small bones model before adding complexity. |
| React+GSAP package proof | Research-backed | Turns the CDN proof into a repo-local build proof after dependency approval. | Smallest possible package setup, local build, cleanup verification, and screenshot test. |
| One-shot animation accents | Promising but unproven | Supports `impact` without promoting it to a full Animation State. | Local Proof for `data-accent="impact"` or generated GSAP one-shot timeline replay. |

## 16. Implementation gate

Gate status: **Go with caveats**.

Implementation can start on the first Buildable Slice if it starts with the conservative
`SVG+CSS` Output Target and keeps the caveats explicit:

- first confirm or export the Clean Mascot Source
- build from a Manual Part SVG, not automated vectorization
- use a small Spine-like `rigged.json`, not a full rig runtime
- implement only `idle`, `active`, and `alert` as Animation States
- model `impact` as a future/transient accent unless a Local Proof proves it needs state
- defer package setup for `React+GSAP` until explicitly approved

This is not a `Go` yet because the real Clean Mascot Source is not checked in and
React+GSAP package integration is intentionally unproven. No blocking browser/runtime
issue was found for the first `SVG+CSS` implementation path.
