# Layered-SVG ingest hardening (nested groups + transforms) — design

- **Date:** 2026-07-26
- **Status:** Approved (design phase)
- **Governs:** [ADR-0011](../../adr/0011-geometry-agnostic-parts.md) (geometry-agnostic parts)
- **Stage:** 1 of the layered-first reframe (harden ingest → cross-platform gate → docs/demo flip →
  hero capture → push)

## Problem

The layered-SVG path is being promoted to the product's front door. Its documented limits therefore
stop being footnotes and become first-run failures. Two of them are real, and they fail in opposite
and equally bad ways.

**1. Nested `<g>` is rejected outright by the node path, but silently accepted by the browser path.**

`tools/rig-editor/layer-ingest.js` tokenizes groups with a non-greedy regex
(`/<g\b([^>]*)>([\s\S]*?)<\/g>/g`). On a nested export that regex ends the outer group at the *inner*
`</g>`, so the outer group's own geometry would be dropped. Rather than emit a silently broken part,
`parseLayered` throws (line 58). That is the right instinct and the wrong ceiling: the regex is the
defect, and rejecting nesting is a workaround for it.

The browser path has no such limit. `app.js:233` collects geometry with `g.querySelectorAll(DRAW)`,
which descends to **any** depth — it already flattens nested groups and always has. So the two ingest
paths disagree about what a valid input is, on the path about to become the headline. Real Figma and
Illustrator exports routinely nest.

**2. Ancestor `transform` is silently dropped by both paths.**

`layer-ingest.js`'s header notes "per-group/element transforms are not resolved". Nothing enforces it.
In the browser this is worse than unenforced, it is invisible:

- `el.getBBox()` returns the element's box in its **own** user space — it does not include the
  element's own transform or any ancestor's.
- `markup: el.outerHTML` re-parents the element into the part group, away from the transform that
  positioned it.

So a Figma export whose layers sit under `<g transform="translate(…)">` loads today with no error, no
warning, and every part in the wrong place. This is the same failure class as the raster
auto-segmenter's ghost "legs" — confident, plausible-looking, wrong — and it is exactly what the
layered-first reframe exists to escape. A layered ingest that silently misplaces geometry forfeits its
one advantage over the raster path: that a human already established the truth.

Note that transform-dropping is **not** a nesting problem. A top-level `<g transform>` is dropped by
both paths too. It has simply never been caught.

## Non-goals

- **Resolving transforms.** Detect and refuse, do not compose. Composing ancestor transforms means
  matrix math applied to path data or wrapper emission, on the newly-primary front door, on the eve of
  a public push. Deferred with a marked upgrade path (see "Deferred").
- **Adding an MCP tool.** The count is a locked contract at 10 (`mcp/protocol.test.mjs`). Nothing here
  needs one; `startFromLayeredSvg` already exists and its behaviour improves for free.
- **Adding a dependency.** `tools/rig-editor/` stays zero-dependency, pure ESM, no build step.
- **Touching goldens.** `docs/buildable-slice/generated/*` and `tools/emit-react-gsap/generated/*` must
  stay byte-for-byte identical. Flat inputs must parse exactly as they do today.
- **Reading metadata from nested groups.** See "Metadata rule".
- **Changing an ADR decision.** ADR-0011 records no flat-only rule; the limit lives in a code comment.
  ADR-0011 already calls layered input "a first-class input" and the PNG path "the fallback", so this
  work is consistent with it, not an amendment to it.

## Architecture

Three changes across two files, plus tests.

```
tools/rig-editor/layer-ingest.js
  + topLevelGroups(svgText)      NEW, pure, ~20 lines. Depth-aware <g> scanner.
  ~ parseLayered()               uses the scanner; nested drawables flatten into the part;
                                 nested-<g> rejection REMOVED; transform guard ADDED.
  + transformErrorMessage(names) NEW, exported. Shared wording for both paths.
  ~ #rig-root unwrap             reuses the scanner instead of its own greedy regex.

tools/rig-editor/app.js
  ~ loadLayeredSvg()             transform guard ADDED (status + abort). Flattening
                                 unchanged — it already worked.
```

### 1. Depth-aware top-level group scan

Replace `GROUP_RE` with a small scanner that walks `<g`…`>` and `</g>` tokens, tracks depth, and
yields only the depth-0 groups — each with its attribute string and its **complete** inner text,
inner groups included.

Flattening then requires no additional code. The existing `EL_RE` already scans for drawable tags
across whatever text it is given; hand it the full subtree and it collects drawables at every depth.
Fixing the tokenizer *is* the flattening fix.

Self-closing `<g/>` carries no geometry and is skipped. Unbalanced `</g>` (depth would go negative) is
clamped at zero rather than throwing — a malformed document should fail on its content, not on a
counter.

The `#rig-root` unwrap at line 44 currently uses its own greedy regex. It becomes: if there is exactly
one top-level group and its id is `rig-root`, descend one level. That is the rule `app.js:220` already
applies, so the two paths converge on one rule and one regex disappears.

### 2. Transform guard

Two one-line detections that share one message. Deliberately **not** an abstraction — the two paths
hold different data (text vs. live DOM) and a shared detector would have to abstract over both to save
two lines. What must not drift is the wording a user reads, so only the message builder is shared.

- node: test `/\btransform\s*=/` against the group's attribute string and its inner text.
- browser: `g.hasAttribute("transform") || g.querySelector("[transform]")`.

Both collect the offending **layer names** first and report them together, so a user with six bad
layers learns that in one pass instead of six.

The name reported is the **raw layer name as authored** — `inkscape:label`, else `id`, else
`data-name`, else `layer-N` — the same resolution order `parseLayered` and `loadLayeredSvg` already
use for naming, *before* `sanitizeId`. A user hunting the layer in Figma is looking for "Left Arm",
not `part-left-arm`. When the transform sits on a nested group rather than the layer root, the
**top-level layer** is what gets named: that is the thing the user can find and flatten.

Message (single source, `transformErrorMessage`):

```
layer(s) "Head", "Left Arm" carry a transform — layered ingest does not resolve transforms,
so those shapes would be placed incorrectly. Flatten or ungroup them before export
(Figma: right-click → Flatten selection; Illustrator: Object → Expand).
```

The requirement is that the message names the offending layers and states a concrete action. Exact
wording may be refined during implementation; tests assert on the layer names and a stable keyword,
not on the full sentence.

### 3. Browser behaviour

Same guard, different failure idiom. `loadLayeredSvg` reports through `status()` and returns early —
matching its existing `"Could not parse that SVG."` and `"No shapes found in that SVG."` handling. It
does not throw. A thrown error in a drop handler leaves the editor in an undefined state; a status
message leaves the previous model intact and the user able to try another file.

## Metadata rule (explicit, because it is currently only implied)

`data-role`, `data-kind`, `data-bone`, `data-pivot` and `data-preset-*` are read **only from the
top-level `<g>`**. Nested groups contribute **geometry only** — never metadata, never a part of their
own.

This is what both paths do today (node never saw nested groups; the browser iterates only
`svgEl.children` for layers while collecting geometry at any depth). Flattening makes the rule
load-bearing rather than incidental, so it is stated in the header comment and pinned by a test.

Consequence to accept knowingly: a self-describing handoff rig can never nest its part groups. It does
not — `editorHandoff` emits one flat level under `#rig-root` — and the round-trip test guards that.

## Data flow

Unchanged. `parseLayered` still returns `{ viewBox, elements, parts, states }`; `toModel` is
untouched; the exporter is untouched. The only difference is that `elements[].part` may now be sourced
from a drawable found below the top level. `elements` order remains document order, so any
order-sensitive downstream behaviour is preserved.

## Error handling

| Input | Node (`parseLayered`) | Browser (`loadLayeredSvg`) |
|---|---|---|
| flat, no transform | unchanged | unchanged |
| nested, no transform | **now works** — one part per top-level layer | unchanged (already worked) |
| any `transform` in a layer subtree | **throws**, names layers | **status + abort**, names layers |
| top-level `<g transform>` | **throws**, names layers | **status + abort**, names layers |
| circle/ellipse/polygon | unchanged (`startFromLayeredSvg` throws on null bbox) | unchanged (`getBBox`) |

`mcp/tools.mjs` → `startFromLayeredSvg` needs no change: it calls `parseLayered`, so the throw
propagates as an MCP error with the actionable text already in it.

## Testing

`tools/rig-editor/layer-ingest.test.mjs`, `node:assert/strict`, no framework — mirroring the existing
file.

1. **Nesting flattens, outer geometry survives.** A 2-level nest with drawables at *both* depths →
   one part, both shapes present. This is the precise defect the old tokenizer had, so it is the
   assertion that must have teeth: it fails if the scanner regresses to non-greedy behaviour.
2. **3-level nest** → still one part, all shapes.
3. **Two nested layers side by side** → two parts, no cross-contamination of elements. Guards the
   scanner's depth reset between groups.
4. **Nested `transform`** → throws; message contains the offending layer's name.
5. **Top-level `transform`** → throws.
6. **Multiple transformed layers** → one throw naming *all* of them.
7. **Metadata rule** — a nested `<g data-role="limb" id="inner">` inside a top-level layer → its
   geometry joins the parent part; no `part-inner` exists; no role is applied from it.
8. **`#rig-root` unwrap** still works through the scanner (existing handoff round-trip test must stay
   green unmodified).
9. **Regression** — every existing flat assertion in the file passes untouched.

**Test to be replaced, not added:** lines 107–114 of `layer-ingest.test.mjs` currently assert that
nested `<g>` *throws* ("I3a"). That test encodes the rule this design reverses. It is replaced by
assertions 1–3, and the comment above it (explaining the non-greedy tokenizer) is rewritten to
describe the scanner. Flagged here so the implementer does not treat its failure as a regression.

**Playwright e2e:** load an SVG with a transformed layer via `window.__rigEditor` and assert the status
text names the layer.

> **Amended during planning (2026-07-26):** this section originally specified *one* e2e, reasoning that
> browser flattening was unchanged code. That reasoning was wrong, and the same review found a second
> silent-wrong case the sections above miss: **flattening newly exposes non-rendered subtrees as art.**
> Figma emits `<g clip-path="url(#c0)">` and can place the `<clipPath>` inside the group; once a layer
> owns its whole subtree, a clip shape becomes a phantom element — invisible in the source, exported as
> real geometry. Both paths are affected (`EL_RE` over the subtree in node; `querySelectorAll` in the
> browser, where `getBBox` on an unrendered clip shape returns zeros rather than throwing, so the
> phantom is silent). Both therefore skip `defs`/`clipPath`/`mask`/`symbol`/`pattern`/`marker` subtrees,
> and the transform check runs on the stripped body so a clip's internal transform cannot trigger a
> spurious refusal. A second e2e covers this. **The e2e count below is superseded: 22, not 21.**

**Gate expectations after this stage:**
- `pwsh -NoProfile -ExecutionPolicy Bypass -File tools/check-all.ps1` → `RESULT: PASS` (P1–P7)
- `pwsh -NoProfile -File tools/check-e2e.ps1` → **22 passed** (up from 20; two tests added — see the
  amendment above, which supersedes the original figure of 21)

The e2e count moving 20 → 22 is expected and is not a regression. Any *other* movement is.

## Deferred

Composing ancestor `translate(tx,ty)` into the cached bbox and wrapping the element markup in
`<g transform="translate(…)">` would make the most common Figma transform work rather than fail.
`exporter.js:126` emits `markup` verbatim, so the wrapper survives export — the approach is viable.

It is deferred, not rejected, and marked in `layer-ingest.js` with a `ponytail:` comment naming the
ceiling and this upgrade path. Trigger to build it: evidence from real exports that transformed layers
are common enough that the refusal is the dominant first-run failure. That evidence does not exist
yet, and inventing geometry math to pre-empt it is the wrong risk to take immediately before a public
push.

## Acceptance

- A nested, untransformed layered SVG ingests identically through the node and browser paths: same
  parts, same element count.
- A transformed layered SVG fails in both paths with a message naming the offending layers and a
  concrete corrective action.
- Flat inputs are bit-identical in behaviour; all goldens unchanged.
- MCP tool count is 10. No root `package.json`. No new dependency. `tools/rig-editor/` imports nothing
  outside `node:`.
- Both gates green at the stated numbers.
