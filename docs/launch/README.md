# Launch Checklist — mascot-forge v1.0.0

Owner-gated steps to take mascot-forge public. Most need Andrew (publish, tag, record); this doc is the
runbook + the talking points, not an automation.

## What's shippable now (done)

- **Colour-faithful output** — source colours preserved end-to-end (was diagnostic tint).
- **Path-based fidelity** — opt-in VTracer engine: the cat went 108,600 B → 7,306 B (93% smaller).
- **Premium input path** — layered SVG with named `<path>` layers rigs directly (full fidelity).
- **Guided vision route** — `forge_propose` (regions-overlay preview + silhouette advisory) →
  `forge_review` (MCP elicitation: approve / redo / open-editor, with a no-capability fallback) →
  inline `forge_apply_tweaks` / `forge_open_editor` handoff → `forge_emit`.
- **Gate** — `tools/check-all.ps1` is green across P1–P6 (P6 covers the MCP + VTracer chain).

## Demo script (for the GIF + transcript)

Use the former DevBrain mascot in `assets/devbrain/` as the flagship showoff unless Andrew deliberately
chooses a different public asset.

1. `forge_start_from_image` on the DevBrain showoff mascot PNG (colour-distinct → use the `vtracer` engine).
2. `forge_propose` → open the written `regions-preview.html` (original + proposed part boxes).
3. `forge_review` → approve at the elicitation prompt.
4. `forge_emit` → open the side-by-side demo HTML (original beside the animated mascot).

## Checklist (needs Andrew)

- [ ] **Hero GIF** of the loop above → `docs/hero-mcp-live.gif` (screen-record steps 1–4).
- [ ] **Live-agent transcript** (a real client driving the MCP, not the sim) → `docs/launch/transcript.md`.
- [ ] **Flip repo public** on GitHub (`rockhoppa123/mascot-forge`).
- [ ] **Enable GitHub Pages** for the demo HTML so the animated mascot is viewable online.
- [ ] **Tag `v1.0.0`** + release notes: colour fix → rigging quality → VTracer fidelity → guided route.
- [ ] **Validate with one real non-author user**: hand them the MCP + a PNG, watch where they get stuck,
      record findings here.

## Known limits to state honestly in the README

- A **single-colour silhouette** (flat clipart) can't be auto-separated into parts — `forge_propose`
  reports this; use a layered or multi-colour source for full rigging. (Path-splitting was rejected by
  design: it tears the whole-part CSS-transform animation model.)
- Layered ingest handles **rect + path** layers; circle/ellipse/polygon still defer to the browser
  editor's rasterizer.
