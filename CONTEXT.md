# mascot-forge

mascot-forge turns static mascot art into rigged, articulated, telemetry-aware web mascot code. This glossary names the project concepts used when discussing scope, research, and implementation.

## Language

**Buildable Slice**:
A narrow proof path that can be researched, implemented, tested, and demoed before the full pipeline exists. It proves one promise end to end without requiring every planned phase.
_Avoid_: Milestone, spike, prototype

**Evidence Pack**:
A research deliverable that captures the sources, decisions, alternatives, cons, constraints, and acceptance checks needed to implement a Buildable Slice with confidence.
_Avoid_: Research dump, notes, brainstorm

**Evidence Standard**:
The bar for treating a research claim as implementation-ready: each claim must have a primary source, a small local proof, or a clearly marked assumption with a planned test. Cons and constraints must be recorded with the same care as supporting evidence.
_Avoid_: Confidence, gut feel, best practice

**Local Proof**:
A minimal executable check used inside the Evidence Pack to prove browser or runtime behaviour before implementation starts. It removes uncertainty without becoming the product code.
_Avoid_: Prototype, implementation, demo

**Buildable Slice Evidence Pack**:
The Evidence Pack stored at `docs/research/buildable-slice-evidence.md`, with Local Proofs stored under `docs/research/proofs/`.
_Avoid_: Research folder, implementation plan

**Source Hierarchy**:
The Evidence Pack rule that primary sources and Local Proofs outrank secondary summaries. Browser behaviour uses MDN, specs, compatibility data, and Local Proofs; React uses official React docs; GSAP uses official GSAP docs and license pages; rig models use official Spine or Rive docs where possible.
_Avoid_: Link list, article roundup

**Clean Mascot Source**:
A single transparent PNG pose used as the Buildable Slice input. It excludes labelled reference-sheet cleanup, crop detection, shadow removal, and background removal.
_Avoid_: Reference sheet, source sheet, production asset

**Manual Part SVG**:
A hand-authored SVG representation of the Clean Mascot Source used by the Buildable Slice to prove rigging and Output Targets before PNG-to-SVG vectorization exists.
_Avoid_: Vectorizer output, generated SVG, final asset

**Motion Intent**:
The user's description of desired mascot behaviours before part segmentation is finalized, such as legs walking, antenna pulsing, eyes blinking, or the moustache recoiling. Motion Intent should drive proposed moving parts instead of forcing users to name SVG anatomy first.
_Avoid_: Animation prompt, part list, rig instructions

**Motion Intent Confirmation**:
The structured review step where extracted Motion Intent becomes confirmed moving parts, behaviours, pivots, intensity, and states. It makes natural-language intent repeatable enough for `rigged.json` and Output Target generation.
_Avoid_: Prompt result, generated plan, wizard answers

**Animation State**:
A named mascot behaviour state such as `idle`, `active`, `alert`, or `impact`. Buildable Slice work proves clean switching between Animation States before real telemetry binding is added.
_Avoid_: Telemetry state, app state, pose

**Future Expansion Note**:
A scoped note for work that should be built upon later but is intentionally outside the Buildable Slice. It records the future idea, why it matters, and what evidence would justify pulling it into implementation.
_Avoid_: TODO, nice-to-have, tangent

**Output Target**:
The web-code form emitted by mascot-forge for a rigged mascot, chosen from options such as SVG+CSS or React+GSAP based on the user's needs and the Evidence Pack.
_Avoid_: Backend, renderer, format

**Output Target Criteria**:
The comparison lens used to choose an Output Target: editable output quality, animation expressiveness, runtime size, dependency risk, generated-code maintainability, telemetry fit, visual testability, licensing, and long-term ownership.
_Avoid_: Pros and cons, vibes

**Output Target Routing**:
The rules that tell a user which Output Target fits their mascot and application needs. SVG+CSS is expected to suit portable, lightweight mascots; React+GSAP is expected to suit richer, interruptible React mascots, subject to Evidence Pack findings.
_Avoid_: Winner, default forever

**Routing Matrix**:
The Evidence Pack section that compares Output Targets against the Output Target Criteria and turns the comparison into user-facing Output Target Routing rules.
_Avoid_: Comparison table, scorecard
