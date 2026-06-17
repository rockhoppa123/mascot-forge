# Local Proofs

This folder stores minimal executable checks used by the Buildable Slice Evidence Pack.

Local Proofs are durable backup evidence for browser or runtime behaviour. They should be small, runnable, and focused on removing one uncertainty at a time. They are not product implementation code.

## Proof files

| Proof | File | What it proves | Runtime notes |
|---|---|---|---|
| SVG+CSS transform proof | [`svg-css-transform-proof.html`](svg-css-transform-proof.html) | Nested SVG `<g>` transforms compose after viewport normalization; per-part `transform-origin` and `transform-box` are usable; `data-state` drives `idle`, `active`, and `alert`; reduced motion can disable loops; semantic part IDs stay readable. | Standalone HTML/CSS/JS, no dependencies. Use `?state=alert&reduce=1` for deterministic screenshots. |
| React+GSAP lifecycle proof | [`react-gsap-lifecycle-proof.html`](react-gsap-lifecycle-proof.html) | `useGSAP()` can initialize and clean up scoped timelines; telemetry-like state changes interrupt one timeline and start another; reduced motion switches to static pose; semantic SVG part IDs stay readable; GSAP adds scoped timeline cleanup, labels, repeats, and interruption control. | Standalone HTML using CDN-pinned React, ReactDOM, GSAP, and `@gsap/react`. This avoids repo package setup but requires network access for the proof page. Use `?auto=1&reduce=1` for deterministic screenshots. |

## Verification command used in the first research pass

The first pass loaded both proof pages in Chromium through Playwright and saved screenshots to the OS temp folder, outside the repo. It asserted:

- the SVG proof rendered five `PASS` rows and no `FAIL` rows
- the React+GSAP proof initialized `useGSAP()`, recorded cleanup/setup events across state changes, and preserved semantic part IDs
