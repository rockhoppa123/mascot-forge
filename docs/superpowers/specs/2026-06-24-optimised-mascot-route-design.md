# Optimised Mascot Route — Design Spec

**Date:** 2026-06-24
**Status:** Approved (design); pending implementation plan
**Scope:** Restructure the image→animated-mascot pipeline for higher output quality and easier
visualisation, add a human checkpoint, and adopt path-based vectorisation.

---

## 1. Context

The current MCP route is:

```
forge_start_from_image → (JS pixel-scanline vectorize) → segment (CCL colour blobs)
→ agent guesses region boxes blind → assign_region/set_part → forge_emit
```

It is deterministic, O(n) vectorise, no-ML by design (ADR-0002: "tool proposes, human confirms"),
and runs in both node and the browser. **Two weaknesses cap quality:**

1. **Vectoriser fidelity.** Pixel-rect scanlines produce rect-soup (1607 rects / ~106KB for a
   225px cat) and cannot separate same-colour regions (the ear/tail "ceiling" documented in
   `segment-quality.test.mjs` case 6).
2. **Blind rigging.** The agent assigns part regions from a coarse part list without using its own
   vision, so parts are guessed rather than seen. A mis-aimed box silently drops a part (fixed
   defensively in `assign_region` with a 0-rect warning, but the root cause is the blind route).

Prior work this session (branch `fix/color-preservation-and-rigging`): colour preservation, anatomy
presets, pivot rounding, side-by-side demo, 0-rect warning, 10-case quality battery. This spec
builds on that branch.

### Research basis
- **VTracer** (visioncortex, Rust): O(n) full-colour clustering, path-based output ~30–70% smaller
  than Illustrator Image Trace; the field standard for raster→vector. Potrace is sharper but
  B&W-only; ML auto-riggers (UniRig, SpriteToMesh, instance-rig) are 3D or mesh-deformation paradigm,
  heavy infra, and would replace the runtime — rejected (wrong domain, dilutes the lightweight wedge).
- **MCP Elicitation** (Claude Code 2.1.76, March 2026): servers can pause mid-tool and request
  structured input (form fields or approval URL). This is the native rail for the "analyze first,
  report back, continue?" checkpoint. Best practice: one gate before the expensive/irreversible step.

---

## 2. Goals & non-goals

**Goals**
- Output that visibly resembles the source, in compact path form (not rect-soup).
- A human checkpoint that shows what was detected *before* committing to emit.
- Use the agent's existing multimodal vision for semantic region proposal — no ML library.
- Make output easy to visualise at both the proposal stage and the result stage.

**Non-goals**
- No neural/ML rigging or segmentation libraries (keep ADR-0002).
- No change to the zero-dep *runtime* artifact (integration-layer deps in `mcp/` are fine).
- No skeletal mesh-deformation animation engine (stay with semantic parts + CSS keyframes).

**Success criteria**
- A path-based mascot emits and validates, visibly resembling the source, materially smaller than
  the rect-soup baseline.
- The checkpoint surfaces detected regions to the human and gates emit on approval.
- The route degrades gracefully where elicitation or the VTracer binary is unavailable.

---

## 3. The optimised route

```
Source image
  → [NEW] VTracer → colour paths            (mcp/ layer; browser keeps JS fallback)
  → [NEW] Agent vision → spot semantic regions
  → Proposed rig (parts + preview)
  → ★ CHECKPOINT (MCP elicitation): "here's what I found — continue?"
        approve · tweak inline · open browser editor · redo↺
  → Rig (roles + anatomy presets)
  → Emit (animated SVG + side-by-side demo)
```

Two actors, kept distinct:
- **Agent (Claude)** does the *looking* — proposes regions from the original image.
- **Human** does the *approving* — via the elicitation form rendered by the client.

---

## 4. Component decisions

### 4.1 VTracer integration — fidelity
- Node binding in the `mcp/` package (e.g. `@neplex/vectorizer` napi, or vtracer crate via napi),
  beside `pngjs`. The zero-dep runtime is untouched (mirrors the existing "deps are integration-only"
  split in `mcp/tools.mjs`).
- `startFromImage`/`forge_propose` call VTracer to produce colour-clustered **paths**; these flow
  through the geometry-agnostic model (ADR-0011 `el.markup` branch already supports non-rect elements).
- The browser editor keeps the JS scanline vectorizer (`vectorize.js`) as fallback.
- **Risk to validate:** prebuilt Windows binary availability; a real path round-trip test through
  `loader → model → exporter → validator`.

### 4.2 Agent-vision semantic regions
- The agent proposes named regions as normalized 0..1 boxes from the original image (it can already
  see the attached PNG). This solves the same-colour-silhouette ceiling no colour segmenter can.
- `segment.js` (CCL) is retained as a **deterministic geometry helper / fallback**, not the primary
  namer. The generic-blob fallback and quality battery stay as the no-vision safety net.

### 4.3 The checkpoint — MCP elicitation
- New tool `forge_propose({ session })`: runs vectorise + assembles the proposed parts, writes a
  **regions-overlay preview** (original beside detected parts), then elicits the human.
- Elicitation result drives one of: `approve` → emit; `tweak` → apply inline edits then re-preview;
  `editor` → emit a handoff URL/file to the browser rig editor; `redo` → fresh vision pass.
- **Graceful degradation:** if the client/server does not support elicitation, `forge_propose`
  returns the proposal + preview path as a normal tool result and the agent relays it in chat for a
  plain yes/no — the route still works, just without the native form.

### 4.4 Inline tweak + editor handoff
- **Inline** (elicitation form fields): rename a part, change its role, nudge a region box. Cheap
  fixes without leaving chat.
- **Editor handoff**: open the existing browser rig editor pre-loaded with the proposed rig for deep
  manual fixing, then return to emit. Reuses P5 editor; no new editor surface.

### 4.5 Visualisation
- **Regions-overlay preview** at the checkpoint: original image + detected part boxes/labels.
- **Side-by-side animated demo** at emit (already shipped in Wave 2: `emitDemoHtml` source pane).

---

## 5. What changes vs. today

| Area | Today | After |
|---|---|---|
| Entry | `start_from_image` → blind assign → emit | `propose → review(elicit) → emit` |
| Vectoriser | JS scanline rect-soup | VTracer paths (JS = fallback) |
| Part naming | CCL heuristic / blind boxes | agent vision (CCL = fallback) |
| Quality gate | none (emit immediately) | human checkpoint before emit |
| Rect-merge optimizer | proposed quick win | **demoted to fallback-only** (VTracer supersedes) |
| Real-colours toggle | not built | Phase 1 quick win (editor) |

---

## 6. Phasing (→ implementation plan)

1. **Phase 1 — Quick wins:** real-colours editor toggle (model already carries `r.fill` + part
   `tint`; `app.js` swaps render source). Rect-merge optimizer recorded as fallback-only, likely skipped.
2. **Phase 2 — VTracer integration:** Node binding in `mcp/`; path round-trip test; emit a path-based
   mascot that validates and is materially smaller than the baseline.
3. **Phase 3 — Guided route:** `forge_propose` + elicitation checkpoint + regions-overlay preview;
   graceful no-elicitation fallback.
4. **Phase 4 — Inline tweak + editor handoff.**
5. **Phase 5 — Launch:** hero GIF, live MCP transcript, public flip, `v1.0.0`.

Each phase is independently shippable and testable. Phases 1–2 are loosely coupled to 3–4 (the route
operates on the original image + normalized boxes, so the vectoriser can change underneath it).

---

## 7. Testing approach
- Reuse the node-self-check pattern (no framework; `node:assert`) and wire new suites into
  `tools/check-all.ps1`.
- Phase 2: a VTracer path round-trip test (`vectorize → model → export → validate`).
- Phase 3: a `forge_propose` test driving the elicitation path and the no-elicitation fallback
  (agent-sim style, mirroring `mcp/tools.test.mjs`).
- Keep the 10-case `segment-quality` battery green as the fallback safety net.

---

## 8. Open risks (resolve in planning)
- Elicitation support in the custom `server.mjs` / installed MCP SDK version.
- VTracer prebuilt binary on Windows (build-from-source friction otherwise).
- Path output through the rig model — prove with a round-trip test before building the route on it.
