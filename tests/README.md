# Browser e2e (Playwright)

Headless smoke + product-path tests for the in-browser rig editor. Kept **out of the repo root** so the
runtime and emitters stay dependency-free. There is deliberately **no root `package.json`** — the gate
asserts its absence, and the `{"type":"module"}` markers live in `runtime/` and `tools/rig-editor/`
instead. Playwright lives here, in `tests/`, with its own `package.json`.

## Run it

```sh
cd tests
npm install            # first time only — installs @playwright/test
npx playwright install chromium   # first time only — the browser binary
npx playwright test    # the whole suite
npx playwright test drop-rig      # just the drop-zone product-path proof
```

The config (`playwright.config.mjs`) starts a static server on **:4179** serving the repo **root**, so
`/tools/rig-editor/index.html` and the fixtures resolve. It reuses an already-running server outside CI.

## What's covered

- `e2e/rig-editor.spec.mjs` — the editor happy path + regressions (load example, role/preset, pivot,
  undo, real-colours, the MCP-rigged live-feed demo).
- `e2e/drop-rig.spec.mjs` — **the product claim**: a non-dev drops a PNG and gets an animated SVG with
  no terminal (drop → vectorise → segment → assign role/preset → export), plus the Phase-2 reach
  (tag a part `kind=wheel` → it auto-selects `spin` → exports). Fixture: `e2e/fixtures/blocks.png`,
  regenerable with `node e2e/fixtures/make-blocks.mjs` (zero-dep, `node:zlib` only).

## Why it isn't in the node gate

The node gate (`node tools/gate/check-all.mjs`, P1–P7) is deliberately node-only and browser-free. Wiring Playwright
into it would drag a browser binary + an npm dependency into the zero-dep gate. The e2e is run
separately (here, or via `tools/check-e2e.ps1`); the node gate stays clean.
