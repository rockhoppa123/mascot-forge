# Guided Vision Route — Implementation Plan (Phases 3–5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the analyze-first → report-regions → human-checkpoint loop (MCP elicitation) to the
mascot-forge MCP, with inline tweak + editor handoff, then launch v1.0.0.

**Architecture:** A new `forge_propose` tool assembles the current proposed parts and writes a
regions-overlay preview (original image + part boxes). A `forge_review` tool pauses via
`server.elicitInput()` to let the human approve / tweak / hand off to the editor / redo — degrading to
a plain tool result when the client lacks elicitation capability. The guided route carves parts on the
rect (scanline) engine (rect-granular = any region carvable); VTracer stays the fidelity engine for
colour-distinct parts. Builds on Phases 1–2 (merged to main).

**Tech Stack:** Node ESM, `@modelcontextprotocol/sdk ^1.20.0` (`server.elicitInput`, form mode),
`node:assert` self-checks, in-memory transport integration tests (mirror `mcp/protocol.test.mjs`).

## Global Constraints

- Zero-dep RUNTIME untouched; integration deps stay in `mcp/`. Pure ESM. Terse comment style.
- No ML (ADR-0002). The agent's own multimodal vision proposes regions — no CV library.
- New node suites wired into `tools/check-all.ps1` (P5 for pure modules, P6 for mcp).
- `forge_emit` / existing tool return shapes and behaviour stay backward-compatible.
- **Elicitation degrades gracefully:** if `server.server.getClientCapabilities()?.elicitation` is
  falsy, tools return the proposal as a normal result for the agent to relay — never hang.

## Design decisions resolved (from Phase 2 findings + SDK check)

1. **Elicitation API exists:** `server.server.elicitInput({ message, requestedSchema })` (form mode),
   confirmed in `@modelcontextprotocol/sdk` ≥1.13. Capability-gated by the client.
2. **Input-quality engine strategy (path-splitting rejected for good):** VTracer emits whole colour
   paths; carving a same-colour sub-region (the cat's ears/tail) would need polygon-boolean
   path-splitting, which (a) fights the whole-part CSS-transform animation model — a box-cut through
   filled art tears/gaps at the seam when the part moves, (b) is expensive/fragile, (c) papers over a
   bad input. **Rejected permanently.** Instead the system steers toward riggable art and *reports*
   input quality. Engine hierarchy:
   - **Layered SVG (named path layers)** → premium: explicit parts, full fidelity, zero guessing. Now
     unlocked by Phase 2's `pathBBox` (the old "rect-bearing only" deferral is over).
   - **Colour-distinct raster** → VTracer paths: each colour-cluster is a part; small + smooth.
   - **Flat single-colour silhouette** → scanline carve (coarse) or "rig as one body".
   The guided route's analyze step **detects a single-colour silhouette and reports it** as a quality
   signal ("give me a layered/multi-colour source for real rigging"), rather than carving heroically.

---

## File Structure

- `tools/rig-editor/layer-ingest.js` (modify) — compute a bbox for `<path>` layers via `pathBBox`
  (premium input path; was rect-only).
- `tools/rig-editor/layer-ingest.test.mjs` (modify) — assert a path layer ingests with a bbox.
- `mcp/regions-preview.mjs` (create) — pure: `emitRegionsPreview(sourceDataUri, viewBox, parts)` → HTML.
- `mcp/regions-preview.test.mjs` (create) — self-check.
- `mcp/tools.mjs` (modify) — add `forgePropose(session, outDir?)`; add `applyTweaks(session, edits)`
  (Phase 4); add `editorHandoff(session, outDir)` (Phase 4).
- `mcp/tools.test.mjs` (modify) — cover propose + tweaks + handoff.
- `mcp/server.mjs` (modify) — register `forge_propose`, `forge_review` (elicitation), `forge_open_editor`.
- `mcp/protocol.test.mjs` (modify) — in-memory client that answers `elicitInput`, asserting the
  approve / redo / editor branches + the no-capability fallback.
- `docs/launch/` (create, Phase 5) — launch checklist + assets.

---

# PHASE 3 — Input quality + the guided checkpoint

## Task 0: Enable layered PATH ingest (premium input path)

**Files:** Modify `tools/rig-editor/layer-ingest.js` so a top-level `<path>` layer gets a bbox from
`pathBBox(d)` (import from `./path-bbox.js`) instead of being rejected; keep the rect path unchanged.
Modify `mcp/tools.mjs` `startFromLayeredSvg` to stop rejecting path-bearing layers. **Test:** a layered
SVG with two named `<path>` layers ingests into 2 parts, each with a finite bbox; emit validates.
**Acceptance:** a designer's named-path-layer export rigs directly — the highest-fidelity input path.

## Task 1: Regions-overlay preview (pure)

**Files:**
- Create: `mcp/regions-preview.mjs`
- Test: `mcp/regions-preview.test.mjs`

**Interfaces:**
- Produces: `export function emitRegionsPreview(sourceDataUri, viewBox, parts)` → HTML string. `parts`
  is `[{ id, role, bbox:{x,y,w,h} }]` (the shape `partList` already returns). Renders the source image
  with an SVG overlay of labelled part boxes, sized to the viewBox.

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { emitRegionsPreview } from "./regions-preview.mjs";

const html = emitRegionsPreview(
  "data:image/png;base64,AAAA",
  "0 0 100 80",
  [{ id: "part-body", role: "core", bbox: { x: 10, y: 10, w: 40, h: 40 } },
   { id: "part-eyes", role: "accent", bbox: { x: 20, y: 15, w: 8, h: 6 } }]
);
assert.ok(html.includes("data:image/png;base64,AAAA"), "embeds the source image");
assert.ok(html.includes('viewBox="0 0 100 80"'), "overlay uses the viewBox");
assert.ok(html.includes("part-body") && html.includes("part-eyes"), "labels every part");
assert.ok((html.match(/<rect /g) || []).length >= 2, "draws a box per part");
console.log("regions-preview.test.mjs: all assertions passed.");
```

- [ ] **Step 2: Run it, verify it FAILS** — `node mcp/regions-preview.test.mjs` (module not found).

- [ ] **Step 3: Implement**

```javascript
// regions-preview.mjs — the analyze-first artifact: the source image with the agent's proposed part
// boxes drawn over it, so the human can judge the proposal at the checkpoint. Pure, dependency-free.
const ROLE_COLOUR = { core: "#2563eb", limb: "#16a34a", accent: "#d97706", passive: "#6b7280" };

export function emitRegionsPreview(sourceDataUri, viewBox, parts) {
  const boxes = parts.map((p) => {
    const c = ROLE_COLOUR[p.role] || ROLE_COLOUR.passive, b = p.bbox;
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${c}" stroke-width="1.5"/>` +
      `<text x="${b.x + 1}" y="${b.y - 1}" font-size="4" fill="${c}">${p.id}</text>`;
  }).join("\n    ");
  return `<!doctype html><html><head><meta charset="utf-8"><title>proposed regions</title>
<style>body{margin:0;background:#eef3f8;display:grid;place-items:center;min-height:100vh}
.wrap{position:relative}.wrap img,.wrap svg{position:absolute;inset:0;width:100%;height:100%}
.wrap{width:min(80vw,520px);aspect-ratio:${viewBox.split(" ")[2]}/${viewBox.split(" ")[3]}}</style></head>
<body><div class="wrap"><img alt="source" src="${sourceDataUri}">
  <svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
    ${boxes}
  </svg></div></body></html>
`;
}
```

- [ ] **Step 4: Run it, verify it PASSES** — `node mcp/regions-preview.test.mjs`.

- [ ] **Step 5: Wire into the gate** — add `"regions-preview"` to the P6 `foreach` list in `tools/check-all.ps1`.

- [ ] **Step 6: Commit**

```bash
git add mcp/regions-preview.mjs mcp/regions-preview.test.mjs tools/check-all.ps1
git commit -m "feat(mcp): regions-overlay preview artifact for the checkpoint"
```

## Task 2: `forge_propose` handler

**Files:**
- Modify: `mcp/tools.mjs`
- Test: `mcp/tools.test.mjs`

**Interfaces:**
- Consumes: `emitRegionsPreview` (Task 1); the session store's `model`, `vb`, `sourceDataUri`.
- Produces: `export function forgePropose({ session, outDir })` → `{ parts, rigStatus, preview, advisory }`
  where `parts` = `partList(model)`, `rigStatus` = `rigStatus(model)`, `preview` is the written preview
  file path (when `outDir` is given) or the preview HTML byte length (when not), and `advisory` is a
  string|null input-quality signal. Compute `advisory` from the model: count distinct rect fills; if
  `<= 2` distinct fills OR one element's area is `> 0.8` of the opaque-content area, set
  `advisory = "single-colour silhouette — parts can't be auto-separated; provide a layered or multi-colour source for full rigging, or it will animate as one body"`, else `null`. This is the
  silhouette-detection report (the strategy's input-quality signal), surfaced at the checkpoint.

- [ ] **Step 1: Write the failing test** — append to `mcp/tools.test.mjs`:

```javascript
// forge_propose: assembles the current parts + a regions preview the human can eyeball
{
  const sp = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: sp.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const prop = forgePropose({ session: sp.session });
  assert.ok(Array.isArray(prop.parts) && prop.parts.length >= 1, "propose returns parts");
  assert.ok(prop.rigStatus && typeof prop.rigStatus.total === "number", "propose returns rigStatus");
  assert.ok(typeof prop.preview === "number" && prop.preview > 0, "propose reports the preview size");
}
```
(Add `forgePropose` to the import line at the top of `mcp/tools.test.mjs`.)

- [ ] **Step 2: Run it, verify it FAILS** — `node mcp/tools.test.mjs`.

- [ ] **Step 3: Implement** — add to `mcp/tools.mjs` (import `emitRegionsPreview` at top; reuse the
  existing `partList`, `rigStatus`, `safePath`, `writeFileSync`, `join`):

```javascript
// forge_propose: the analyze-first report — current parts + a regions-overlay preview for the human.
export function forgePropose({ session, outDir } = {}) {
  const s = getSession(session);
  const parts = partList(s.model);
  const html = emitRegionsPreview(s.sourceDataUri || "", s.model.viewBox(), parts);
  let preview;
  if (outDir) {
    const dir = safePath(outDir); mkdirSync(dir, { recursive: true });
    const f = join(dir, "regions-preview.html"); writeFileSync(f, html); preview = f;
  } else preview = html.length;
  return { parts, rigStatus: rigStatus(s.model), preview };
}
```

- [ ] **Step 4: Run it, verify it PASSES** — `node mcp/tools.test.mjs`.

- [ ] **Step 5: Commit**

```bash
git add mcp/tools.mjs mcp/tools.test.mjs
git commit -m "feat(mcp): forge_propose assembles parts + regions preview"
```

## Task 3: `forge_review` elicitation + fallback

**Files:**
- Modify: `mcp/server.mjs`
- Test: `mcp/protocol.test.mjs`

**Interfaces:**
- Registers `forge_review` (and `forge_propose` from Task 2). `forge_review` calls
  `server.server.elicitInput({ message, requestedSchema })` with an `action` enum
  (`approve` | `redo` | `editor`). If `server.server.getClientCapabilities()?.elicitation` is falsy,
  it returns `{ elicitation: false, parts, rigStatus }` so the agent can relay a plain prompt.

- [ ] **Step 1: Write the failing test** — in `mcp/protocol.test.mjs`, add an in-memory client that
  declares elicitation capability and answers with `{ action: "approve" }`, then asserts the
  `forge_review` result echoes the chosen action; and a second client with NO elicitation capability,
  asserting the fallback `{ elicitation: false }` shape. (Mirror the existing in-memory transport
  setup in that file; read it first to match its client/server pairing and capability declaration.)

- [ ] **Step 2: Run it, verify it FAILS** — `node mcp/protocol.test.mjs`.

- [ ] **Step 3: Implement** — register `forge_propose` and `forge_review` in `buildServer()`
  (capture `server` in closure for elicitation):

```javascript
server.registerTool(
  "forge_propose",
  { description: "Report the current proposed parts + write a regions-overlay preview the human can eyeball before emit. Returns { parts, rigStatus, preview }.",
    inputSchema: { session: z.string(), outDir: z.string().optional() } },
  async (a) => { try { return ok(forgePropose(a)); } catch (e) { return fail(e); } }
);
server.registerTool(
  "forge_review",
  { description: "Checkpoint: ask the human to approve / redo / open the editor for the proposed rig. Uses MCP elicitation; if the client can't elicit, returns { elicitation:false, parts } for you to relay.",
    inputSchema: { session: z.string() } },
  async ({ session }) => {
    try {
      const status = forgeStatus({ session });
      const caps = server.server.getClientCapabilities && server.server.getClientCapabilities();
      if (!caps || !caps.elicitation) return ok({ elicitation: false, ...status });
      const res = await server.server.elicitInput({
        message: `Proposed rig: ${status.parts.length} parts, states covered ${JSON.stringify(status.rigStatus)}. Approve, redo, or open the editor?`,
        requestedSchema: { type: "object", properties: { action: { type: "string", enum: ["approve", "redo", "editor"] } }, required: ["action"] },
      });
      return ok({ elicitation: true, action: res.action === "accept" ? res.content?.action : res.action, raw: res.action });
    } catch (e) { return fail(e); }
  }
);
```
Adjust the `res` field access to match the SDK's `ElicitResult` shape you observe (`{ action: "accept"|"decline"|"cancel", content }`) — read `@modelcontextprotocol/sdk` types and make the test assert the real shape.

- [ ] **Step 4: Run it, verify it PASSES** — `node mcp/protocol.test.mjs`.

- [ ] **Step 5: Run the full gate** — `pwsh -NoProfile -File tools/check-all.ps1` → `RESULT: PASS`.

- [ ] **Step 6: Commit**

```bash
git add mcp/server.mjs mcp/protocol.test.mjs
git commit -m "feat(mcp): forge_review elicitation checkpoint + no-capability fallback"
```

---

# PHASE 4 — Inline tweak + editor handoff

*(Concrete code depends on Phase 3's elicitation result shape; tasks are scoped, with acceptance.)*

## Task 4: Inline tweaks via the elicitation form
- Extend `forge_review`'s `requestedSchema` with optional fields (`renameTo`, `setRole`) OR add a
  follow-up `applyTweaks({ session, edits })` in `tools.mjs` that calls `model.rename` / `setRole`.
- **Test:** `applyTweaks` renames a part and changes a role; `forge_status` reflects it.
- **Acceptance:** a human can rename a part and change its role at the checkpoint without leaving chat.

## Task 5: Editor handoff
- Add `editorHandoff({ session, outDir })` in `tools.mjs`: write the session's current rig as a
  segmented SVG (reuse the `exportRig` manual-part SVG / a segmented emit) the browser rig editor can
  load, and return a `file://…/tools/rig-editor/index.html?load=<path>` URL. Register `forge_open_editor`.
- **Test:** handoff writes a loadable SVG and returns a path under the project root.
- **Acceptance:** "open editor" produces a file the existing P5 editor opens with the proposed rig.

---

# PHASE 5 — Launch (owner-gated checklist, not TDD)

## Task 6: Launch checklist → `docs/launch/README.md`
- [ ] Record hero GIF of the live MCP loop → `docs/hero-mcp-live.gif`.
- [ ] Capture a real live-agent MCP transcript (propose → review → emit) → `docs/launch/transcript.md`.
- [ ] Flip the GitHub repo public; enable Pages for the demo HTML.
- [ ] Tag `v1.0.0` and write release notes (colour fix → guided route).
- [ ] Validate with one real non-author user; record findings.

These are operational and need the owner (Andrew); the task is to assemble the checklist + assets, not
to automate the flip/tag.

---

## Self-Review

**Spec coverage:** Phase 3 checkpoint (elicitation) → Tasks 1–3. Inline tweak → Task 4. Editor handoff
→ Task 5. Launch → Task 6. Visualisation (regions preview + existing side-by-side demo) → Task 1. ✓

**Placeholder scan:** Phase 3 (Tasks 1–3) carries complete code; Tasks 4–6 are deliberately scoped (not
placeheld) because their concrete code depends on Phase 3's elicitation result shape and the editor's
load API — flagged as such, to be detailed once Phase 3 lands. This is a decomposition decision, not a
gap.

**Type consistency:** `parts` shape `{id,role,bbox}` is consistent across `partList`, `emitRegionsPreview`,
and `forgePropose`. `forge_review` reads `forgeStatus` output (`{parts, rigStatus, ungroupedRects}`). ✓

**Open risks:** (a) exact `ElicitResult` shape — Task 3 reads SDK types and asserts the real shape;
(b) client elicitation capability in the test harness — Task 3's in-memory client must declare it.

**Granularity decision (resolved):** path-splitting rejected permanently (tears the whole-part
animation model). Instead: layered-path ingest (Task 0) as the premium path, VTracer for colour-
distinct, scanline fallback, and silhouette-detection reporting in `forge_propose` (Task 2).
