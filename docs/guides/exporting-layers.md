# Exporting a layered SVG (Figma / Illustrator / Inkscape)

This is the recommended way to get artwork into mascot-forge. Export your file so each
character part is its own top-level layer, and the part semantics come for free — no
colour-separation heuristics, no auto-segmentation guesswork. This page is the complete
list of rules your export needs to follow, in the order they bite.

Worked example: [`assets/example-layered/robot.svg`](../../assets/example-layered/robot.svg) — seven
named layers (Antenna, Head, Body, Left Arm, Right Arm, Left Leg, Right Leg), `rect` + `path` only, no
transforms. **It is hand-authored to these rules, not a captured real-world Figma/Illustrator export** —
it proves the rules are internally consistent, not that a real export from those tools comes out clean
on the first try.

## The rules

### 1. Flatten or expand transformed groups before export — read this one first

If any layer's subtree (nested groups included) carries a `transform` attribute, ingest refuses the
whole file and names the offending layer(s). This is the single most likely first-run failure with a
real Figma export — Figma routinely leaves groups transformed (drag-to-reposition, component
instances, nested auto-layout), and none of that gets resolved by the importer.

- **Figma:** select the layer → right-click → **Flatten selection**.
- **Illustrator:** select the object → **Object → Expand**.
- **Inkscape:** select the object → **Path → Object to Path**, or ungroup and re-flatten.

Do this to every layer, then re-export.

### 2. Each top-level `<g>` is one part — name it meaningfully

The layer name becomes the part id: `"Left Arm"` → `part-left-arm` (lowercased, non-alphanumerics
collapsed to `-`, `part-` prefix added, deduped with `-2`/`-3` on collision). Name your layers the way
you'd name a character part — `Left Arm`, `Head`, `Tail` — not `Group 14`.

### 3. Nesting is fine

A layer owns every drawable in its subtree, at any depth. You can group sub-shapes inside a layer for
your own organisation in Figma/Illustrator — they all still flatten into that one part.

### 4. `data-*` metadata only works on the top-level `<g>`

If you hand-author `data-role` / `data-kind` / `data-bone` / `data-pivot` / `data-preset-*` attributes,
put them on the layer's own `<g>`, not a group nested inside it. A nested group can only ever
contribute geometry — it never becomes a part of its own and its attributes are never read.

### 5. Avoid `circle` / `ellipse` / `polygon` / `polyline` / `line` if you're driving this through the agent/MCP path

The agent (MCP) ingest path only computes bounding boxes for `rect` and `path`. Any other primitive
in a layer makes the whole file rejected. Two ways around it:
- Convert those shapes to paths before export (Figma/Illustrator/Inkscape all have an
  "object to path" / "expand" action that does this).
- Or drop the file into the **browser rig editor** instead — it handles all seven shape types
  (`rect`, `path`, `circle`, `ellipse`, `polygon`, `polyline`, `line`) because it measures real
  geometry in the DOM (`getBBox`) rather than parsing coordinates from text.

### 6. Clip paths and masks are ignored safely

Anything inside `<defs>`, `<clipPath>`, `<mask>`, `<symbol>`, or `<marker>` is stripped before layers
are even selected. These subtrees define reusable art, they don't draw anything themselves, so they
never turn into a phantom part and never trigger the transform check above.

## What a good export looks like

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">
  <g id="Left Arm">
    <path d="M70 96 L52 96 L46 140 L58 142 L64 106 Z" fill="#8892a6"/>
  </g>
  <g id="Right Arm">
    <path d="M130 96 L148 96 L154 140 L142 142 L136 106 Z" fill="#8892a6"/>
  </g>
</svg>
```

Each part is a top-level `<g>` with a real name, contains only `rect`/`path`, and carries no
`transform` anywhere in its subtree. That's the whole shape of a good export — see the full file in
[`assets/example-layered/robot.svg`](../../assets/example-layered/robot.svg) for all seven parts together.

## Troubleshooting: matching an error you're seeing

**"layer(s) ... carry a transform — layered ingest does not resolve transforms, so those shapes would
be placed incorrectly. Flatten or ungroup them before export (Figma: right-click → Flatten selection;
Illustrator: Object → Expand)."**

This is rule 1. The message names every offending layer. Flatten/expand each one in your design tool
and re-export — there is no way to override this from mascot-forge's side, because a resolved
transform can't be told apart from one silently applied wrong.

**"layered ingest handles rect + path layers; N element(s) are circle/ellipse/polygon which need a
node rasterizer (deferred). Rig this in the browser editor, or trace to paths/rects."**

This is rule 5, and only fires on the agent/MCP path (`forge_start_from_image` with a layered SVG, or
the equivalent MCP tool). Either convert the flagged shapes to paths, or open the file in the browser
rig editor instead.

## Honest limits

- **The agent/MCP path is `rect` + `path` only.** The browser rig editor handles all seven primitives
  (it measures geometry with `getBBox` instead of parsing SVG text); the automated agent path does not.
  If your export has circles, ellipses, or polygons and you want to stay on the agent path, convert
  them to paths first.
- **`assets/example-layered/robot.svg` is hand-authored**, not a captured export from Figma,
  Illustrator, or Inkscape. It demonstrates the rules cleanly; it does not prove a real export from
  those tools will pass ingest untouched. Expect to flatten transforms (rule 1) on a real export even
  if you follow every other rule here.
