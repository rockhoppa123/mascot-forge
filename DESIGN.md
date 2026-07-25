# mascot-forge design guidance

mascot-forge has two different visual jobs. The rig editor and demos are
utility surfaces for inspecting and correcting a mascot; the emitted mascot is
the visual product. Do not impose a competing brand system on either.

## Product-surface rules

- The rig editor favors clear staged progress, direct manipulation, visible
  preview, and recoverable export over decorative dashboard treatment.
- Preserve the source asset's visual identity. The editor may frame and label
  it, but must not recolor, restyle, or make it subordinate to generic UI
  chrome.
- The SVG+CSS output target stays the portable default. React+GSAP is an
  opt-in output target for richer React use cases; neither route justifies a
  new animation library.
- Animation states must communicate app state (`idle`, `active`, `alert`, and
  the approved preset states), remain interruptible, and respect reduced
  motion. The output is owned, readable code, not a black-box visual effect.
- Marketing/showcase pages may be more expressive than the editor, but must
  demonstrate real pipeline output and use real asset evidence rather than
  invented product capability.

## Agent UI-skill routing

| Surface | Lead | Support |
|---|---|---|
| Rig editor, demos, and export UX | `impeccable` | `emil-design-eng` for motion judgment; `review-animations` for motion-only review |
| Emitted React mascot | existing GSAP emitter and CSS/SVG output | `motion-framer` only if a future approved target adopts `motion/react` |
| Public showcase or portfolio page | `design-taste-frontend` | `imagegen-frontend-web` only for a committed visual reference |
| Brand/identity work | `brandkit` | keep it separate from editor/product UX |

Do not mix multiple visual-direction skills in one pass. Do not use a
marketing or image-first workflow to redesign the editor. Do not add a new
dependency when the emitted SVG+CSS or existing GSAP target already covers the
requested behavior.

## Documentation ownership

- `README.md` owns quickstart and public product framing.
- `CONTEXT.md` owns vocabulary and product boundaries.
- `docs/product-discovery.md` owns problem, personas, and scope.
- `docs/technical-proposal.md` and `docs/adr/` own architecture and durable
  decisions.
- This file owns visual/product-surface constraints. Add tokens or component
  rules only when a stable editor or showcase convention is actually adopted.
- `docs/plans/` and `docs/superpowers/plans/` are execution history, not a
  second design system.
