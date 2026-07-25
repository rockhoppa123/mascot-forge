// Agent-simulation test for the MCP tool chain (M1). Drives the handlers with fixed normalized coords —
// no live agent — to prove: image -> assigned-by-region -> valid self-contained animated SVG.
// Uses a synthetic 3-block PNG (red/green/blue, with margins) so each region is cleanly enclosable and
// the test is deterministic. Run: `node mcp/tools.test.mjs` (after `npm install` in mcp/).
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { startFromImage, assignRegion, setPart, forgeStatus, forgeEmit, forgePropose, applyTweaks, editorHandoff, defaultPresetFor, startFromLayeredSvg, planFor, _sessions } from "./tools.mjs";
import { parseLayered } from "../tools/rig-editor/layer-ingest.js";
import { createModel } from "../tools/rig-editor/model.js";

// 3 separated colour blocks on transparent — body / limb / accent candidates.
function blocksPngBase64() {
  const w = 90, h = 90, png = new PNG({ width: w, height: h });
  const set = (x, y, c) => { const i = (y * w + x) << 2; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3]; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = [0, 0, 0, 0];
    if (x >= 10 && x < 80) {
      if (y >= 10 && y < 30) c = [220, 40, 40, 255];
      else if (y >= 35 && y < 55) c = [40, 200, 80, 255];
      else if (y >= 60 && y < 80) c = [40, 80, 220, 255];
    }
    set(x, y, c);
  }
  return PNG.sync.write(png).toString("base64");
}

// 1. start from a PNG (base64)
const s = startFromImage({ base64: blocksPngBase64(), colors: 4 });
assert.ok(s.session && s.viewBox === "0 0 90 90", "session + viewBox");
assert.ok(Array.isArray(s.parts) && s.parts.length >= 1, "proposes parts");

// 2. agent "segments" the three blocks by normalized region → core / limb / accent (covers 3 states)
const a1 = assignRegion({ session: s.session, box: { x: 0.05, y: 0.05, w: 0.9, h: 0.30 }, partId: "part-top", role: "core" });
const a2 = assignRegion({ session: s.session, box: { x: 0.05, y: 0.36, w: 0.9, h: 0.27 }, partId: "part-mid", role: "limb" });
const a3 = assignRegion({ session: s.session, box: { x: 0.05, y: 0.62, w: 0.9, h: 0.27 }, partId: "part-bot", role: "accent" });
assert.ok(a1.moved > 0 && a2.moved > 0 && a3.moved > 0, `each region grabbed shapes (${a1.moved}/${a2.moved}/${a3.moved})`);

// 3. emit — roles alone must yield a VALID animated rig (M1 auto-fills a default preset per role)
const out = forgeEmit({ session: s.session, assetName: "blocks" });
assert.equal(out.ok, true, `emit must be valid: ${JSON.stringify(out.validation || out.error)}`);
assert.ok(out.svgBytes > 0 && out.demoBytes > 0, "produced a self-contained svg + demo");

// 4. unprefixed part ids are auto-normalised to 'part-*' so agent names can't collide with segment ids
const pn = assignRegion({ session: s.session, box: { x: 0.05, y: 0.05, w: 0.9, h: 0.3 }, partId: "head" });
assert.ok(pn.parts.some((p) => p.id === "part-head"), "unprefixed 'head' -> 'part-head'");
assert.ok(!pn.parts.some((p) => p.id === "head"), "raw 'head' id never lands in the model");

// 5. graceful errors
assert.throws(() => assignRegion({ session: "nope", box: { x: 0, y: 0, w: 1, h: 1 }, partId: "x" }), /unknown session/);
assert.throws(() => startFromImage({}), /base64 or path/);

// ================================================================================================
// M2 — the smiley worked example, run tool-by-tool (start -> assign_region xN -> set_part xN ->
// forge_status (all states covered) -> forge_emit valid). Uses a SYNTHETIC multi-block smiley PNG —
// no third-party art is committed. Layout (90x90 viewBox):
//   body   : big yellow disc-ish square, centre                         -> core,  idle:breathe
//   eyes   : two dark islands inside the upper body                     -> accent, idle:blink
//   hand-L : orange block, far left, outside the body                   -> limb,  active:walk
//   hand-R : orange block, far right, outside the body                  -> limb,  active:walk-mirror
//   tongue : red block, bottom-centre, below the body                   -> accent, alert:pulse
function smileyPngBase64() {
  const w = 90, h = 90, png = new PNG({ width: w, height: h });
  const set = (x, y, c) => { const i = (y * w + x) << 2; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3]; };
  const Y = [235, 205, 40, 255], B = [30, 30, 30, 255], O = [235, 140, 30, 255], R = [220, 40, 40, 255];
  const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
  const body = box(28, 18, 62, 62);
  const eyeL = box(36, 28, 41, 33), eyeR = box(49, 28, 54, 33);
  const handL = box(6, 30, 20, 52), handR = box(70, 30, 84, 52);
  const tongue = box(40, 66, 50, 78);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let c = [0, 0, 0, 0];
    if (eyeL(x, y) || eyeR(x, y)) c = B;
    else if (body(x, y)) c = Y;
    else if (handL(x, y) || handR(x, y)) c = O;
    else if (tongue(x, y)) c = R;
    set(x, y, c);
  }
  return PNG.sync.write(png).toString("base64");
}

{
  // 1. start
  const ss = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assert.ok(ss.session && ss.viewBox === "0 0 90 90", "smiley: session + viewBox");
  assert.ok(ss.parts.length >= 1, "smiley: proposes at least one part");

  // 2. agent segments by vision into the five semantic parts (normalized 0..1 boxes).
  const r1 = assignRegion({ session: ss.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "part-body", role: "core" });
  const r2 = assignRegion({ session: ss.session, box: { x: 0.38, y: 0.28, w: 0.22, h: 0.10 }, partId: "part-eyes", role: "accent" });
  const r3 = assignRegion({ session: ss.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "part-hand-left", role: "limb" });
  const r4 = assignRegion({ session: ss.session, box: { x: 0.74, y: 0.30, w: 0.22, h: 0.28 }, partId: "part-hand-right", role: "limb" });
  const r5 = assignRegion({ session: ss.session, box: { x: 0.40, y: 0.70, w: 0.22, h: 0.25 }, partId: "part-tongue", role: "accent" });
  for (const [n, r] of [["body", r1], ["eyes", r2], ["hand-left", r3], ["hand-right", r4], ["tongue", r5]]) {
    assert.ok(r.moved > 0, `smiley: ${n} region grabbed shapes (moved=${r.moved})`);
  }

  // 3. set_part per part — role-aware pivot defaults (omitted) + presets per state.
  const sp = setPart({ session: ss.session, partId: "part-body", role: "core", bone: "body", presets: { idle: "breathe" } });
  assert.equal(sp.part.role, "core", "set_part returns the updated role");
  assert.deepEqual(sp.part.pivot, { x: 45, y: 40 }, "core pivot defaults to bbox centre (omitted pivot)");

  const spH = setPart({ session: ss.session, partId: "part-hand-left", role: "limb", bone: "arm-left", presets: { active: "walk" } });
  // limb default pivot = top-edge centre (the joint/hip line), not the bbox centre.
  const hb = spH.part.bbox;
  assert.deepEqual(spH.part.pivot, { x: hb.x + hb.w / 2, y: hb.y }, "limb pivot defaults to top-edge joint");

  setPart({ session: ss.session, partId: "part-hand-right", role: "limb", bone: "arm-right", presets: { active: "walk-mirror" } });
  setPart({ session: ss.session, partId: "part-eyes", role: "accent", presets: { idle: "blink" } });
  setPart({ session: ss.session, partId: "part-tongue", role: "accent", presets: { alert: "pulse" } });

  // explicit-pivot path: passing 0..1 coords scales into the viewBox.
  const spP = setPart({ session: ss.session, partId: "part-tongue", pivot: { x: 0.5, y: 0.8 } });
  assert.deepEqual(spP.part.pivot, { x: 45, y: 72 }, "explicit 0..1 pivot scales to viewBox coords");

  // role-change clears a now-invalid preset (bug-#1 fix): walk-mirror is a limb preset; switching the
  // right hand to accent must drop it (accent has no 'active' preset). Then restore it as a limb.
  const flip = setPart({ session: ss.session, partId: "part-hand-right", role: "accent" });
  assert.equal(flip.part.role, "accent", "role flipped to accent");
  assert.equal(flip.rigStatus.active, 1, "the stale walk-mirror preset was cleared on role change (active drops to 1)");
  setPart({ session: ss.session, partId: "part-hand-right", role: "limb", bone: "arm-right", presets: { active: "walk-mirror" } });

  // an invalid preset for the role/state is rejected.
  assert.throws(() => setPart({ session: ss.session, partId: "part-body", presets: { active: "walk" } }),
    /not valid for role 'core'/, "core cannot take a limb preset");

  // 4. forge_status — every state has coverage before emit.
  const st = forgeStatus({ session: ss.session });
  assert.ok(st.rigStatus.idle >= 1 && st.rigStatus.active >= 1 && st.rigStatus.alert >= 1,
    `all three states covered (idle=${st.rigStatus.idle} active=${st.rigStatus.active} alert=${st.rigStatus.alert})`);
  assert.equal(st.rigStatus.total, 5, "five rect-bearing parts");
  assert.equal(st.rigStatus.animated, 5, "every part animates in at least one state");
  assert.equal(st.ungroupedRects, 0, "no rects left ungrouped");

  // 5. forge_emit — the full image->rigged loop produces a valid self-contained mascot.
  const semit = forgeEmit({ session: ss.session, assetName: "smiley" });
  assert.equal(semit.ok, true, `smiley emit must be valid: ${JSON.stringify(semit.validation || semit.error)}`);
  assert.ok(semit.svgBytes > 0 && semit.demoBytes > 0, "smiley produced a self-contained svg + demo");
  console.log(`tools.test.mjs (M2 smiley): full loop green. status=${JSON.stringify(st.rigStatus)} svgBytes=${semit.svgBytes}`);
}

// ================================================================================================
// M3 — alt entry: forge_start_from_layered_svg. A rect-bearing layered SVG (each top-level <g> is a
// named part from its layer) starts a session with parts already named — no segmentation. The agent
// then set_part roles/presets and emits.
{
  const layered =
    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<g id="body"><rect x="30" y="30" width="40" height="40" fill="#cccccc"/></g>' +
    '<g id="arm"><rect x="10" y="35" width="14" height="30" fill="#ff7f0e"/></g>' +
    '<g id="eye"><rect x="42" y="40" width="6" height="6" fill="#222222"/></g>' +
    "</svg>";
  const ls = startFromLayeredSvg({ svg: layered });
  assert.equal(ls.viewBox, "0 0 100 100", "layered: viewBox read from the SVG");
  assert.deepEqual(ls.parts.map((p) => p.id).sort(), ["part-arm", "part-body", "part-eye"],
    "layered: parts come from layer names (sanitized)");

  // roles cover all three states; forge_emit auto-fills a default preset per role.
  setPart({ session: ls.session, partId: "part-body", role: "core", presets: { idle: "breathe" } });
  setPart({ session: ls.session, partId: "part-arm", role: "limb", presets: { active: "walk" } });
  setPart({ session: ls.session, partId: "part-eye", role: "accent", presets: { alert: "pulse" } });
  const lst = forgeStatus({ session: ls.session });
  assert.ok(lst.rigStatus.idle && lst.rigStatus.active && lst.rigStatus.alert, "layered: all three states covered");
  const lem = forgeEmit({ session: ls.session, assetName: "layered" });
  assert.equal(lem.ok, true, `layered emit must be valid: ${JSON.stringify(lem.validation || lem.error)}`);

  // path layers now ingest directly (Phase 3 Task 0): a named <path> layer becomes a part with a bbox.
  const withPath =
    '<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">' +
    '<g id="blob"><path d="M5 5 H45 V45 Z" fill="#000"/></g></svg>';
  const pathSession = startFromLayeredSvg({ svg: withPath });
  assert.ok(pathSession.parts.some((p) => p.id === "part-blob"), "path layer ingests as a named part");

  // a circle/ellipse still has no node bbox computation -> rejected with a clear message.
  const withCircle =
    '<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">' +
    '<g id="dot"><circle cx="25" cy="25" r="10" fill="#000"/></g></svg>';
  assert.throws(() => startFromLayeredSvg({ svg: withCircle }), /rasterizer/, "circle/ellipse still refused");

  // graceful errors
  assert.throws(() => startFromLayeredSvg({}), /svg \(string\) or path/);
  console.log(`tools.test.mjs (M3 layered): start_from_layered_svg -> emit green. svgBytes=${lem.svgBytes}`);
}

// VTracer engine: path-based start produces a valid, smaller rig than the scanline engine
{
  // three opaque colour bands on green, with margins so each VTracer path is fully enclosable by the
  // marquee (full-containment). Assign core/limb/accent so all three states get an animation (the
  // validator requires every state to be covered) — proves the vtracer path engine emits a valid rig.
  const W = 60, H = 90, png = new PNG({ width: W, height: H });
  const set = (x, y, c) => { const i = (y * W + x) * 4; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = [40, 160, 60]; const band = x >= 12 && x < 48;
    if (band && y >= 10 && y < 28) c = [220, 40, 40];
    else if (band && y >= 36 && y < 54) c = [40, 80, 220];
    else if (band && y >= 62 && y < 80) c = [235, 140, 30];
    set(x, y, c);
  }
  const b64 = PNG.sync.write(png).toString("base64");
  const sv = startFromImage({ base64: b64, engine: "vtracer" });
  assert.ok(sv.session && /\d+ \d+/.test(sv.viewBox), "vtracer start returns a session + viewBox");
  assert.ok(sv.parts.length >= 1, "vtracer start proposes at least one part");
  const v1 = assignRegion({ session: sv.session, box: { x: 0.15, y: 0.08, w: 0.7, h: 0.26 }, partId: "top", role: "core" });
  const v2 = assignRegion({ session: sv.session, box: { x: 0.15, y: 0.36, w: 0.7, h: 0.26 }, partId: "mid", role: "limb" });
  const v3 = assignRegion({ session: sv.session, box: { x: 0.15, y: 0.64, w: 0.7, h: 0.30 }, partId: "bot", role: "accent" });
  assert.ok(v1.moved > 0 && v2.moved > 0 && v3.moved > 0, `vtracer regions grab path elements by bbox (${v1.moved}/${v2.moved}/${v3.moved})`);
  const out2 = forgeEmit({ session: sv.session, assetName: "vtcat" });
  assert.equal(out2.ok, true, `vtracer rig must emit valid: ${JSON.stringify(out2.validation || out2.error)}`);
  assert.ok(out2.svgBytes > 0, "vtracer path SVG emitted");
}

// forge_propose: parts + rigStatus + a regions preview + an input-quality advisory
{
  const sp = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: sp.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const prop = forgePropose({ session: sp.session });
  assert.ok(Array.isArray(prop.parts) && prop.parts.length >= 1, "propose returns parts");
  assert.ok(prop.rigStatus && typeof prop.rigStatus.total === "number", "propose returns rigStatus");
  assert.ok(typeof prop.preview === "number" && prop.preview > 0, "propose reports the preview size");
  assert.equal(prop.advisory, null, "multi-colour smiley is not flagged as a silhouette");

  // with an outDir, propose must hand back a clickable URL (like forge_emit/forge_open_editor),
  // not a raw local filesystem path the human can't open from chat
  const propUrl = forgePropose({ session: sp.session, outDir: "out/_test_open" });
  assert.match(propUrl.preview, /^http:\/\/localhost:\d+\/out\/_test_open\/regions-preview\.html$/,
    `propose with outDir returns a demo URL (got ${propUrl.preview})`);

  // a monochrome blob trips the silhouette advisory
  const W = 40, mono = new PNG({ width: W, height: W });
  for (let i = 0; i < mono.data.length; i += 4) { mono.data[i] = 60; mono.data[i + 1] = 60; mono.data[i + 2] = 60; mono.data[i + 3] = 255; }
  const sm = startFromImage({ base64: PNG.sync.write(mono).toString("base64"), colors: 4 });
  const mp = forgePropose({ session: sm.session });
  assert.ok(mp.advisory && /auto-separated/.test(mp.advisory), "monochrome input flags a silhouette advisory");
}

// applyTweaks: inline rename + role change at the checkpoint (Phase 4)
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "blob", role: "core" });
  const res = applyTweaks({ session: s.session, edits: [{ partId: "blob", renameTo: "torso", setRole: "limb" }] });
  assert.ok(res.parts.some((p) => p.id === "part-torso" && p.role === "limb"), "rename + role change applied");
  assert.ok(!res.parts.some((p) => p.id === "part-blob"), "old id is gone after rename");
  assert.throws(() => applyTweaks({ session: s.session, edits: "nope" }), /edits must be an array/);
}

// editorHandoff: emits a layered SVG the browser editor loads (round-trips via parseLayered) (Phase 4)
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const h = editorHandoff({ session: s.session });
  assert.ok(h.svg.includes("<g id=\"part-body\""), "handoff SVG groups by part id");
  const { elements } = parseLayered(h.svg);
  assert.ok(elements.some((e) => e.part === "part-body"), "handoff SVG re-parses into the proposed parts");
}

// anatomy-aware auto-fill: roles alone pick sensible motion by part name (tail wags, ears twitch)
assert.deepEqual(defaultPresetFor("part-tail", "limb"), ["active", "wag"], "tail wags");
assert.deepEqual(defaultPresetFor("part-ears", "accent"), ["idle", "twitch"], "ears twitch");
assert.deepEqual(defaultPresetFor("part-eyes", "accent"), ["idle", "blink"], "eyes blink");
assert.deepEqual(defaultPresetFor("part-arm", "limb"), ["active", "walk"], "generic limb still walks");

// M1: anatomy heuristics must not fire on substrings — 'detail' is not a tail, 'eyebrow' not an eye.
assert.notDeepEqual(defaultPresetFor("part-detail", "limb"), ["active", "wag"], "'detail' is not a tail");
assert.notDeepEqual(defaultPresetFor("part-eyebrow", "accent"), ["idle", "blink"], "'eyebrow' is not an eye");
// real anatomy still matches
assert.deepEqual(defaultPresetFor("part-tail", "limb"), ["active", "wag"], "a real tail still wags");
assert.deepEqual(defaultPresetFor("part-left-eye", "accent"), ["idle", "blink"], "a real eye still blinks");

// kind-aware defaults (Phase 2a): a kind hint outranks id/role (the land-rover wheels-rock fix)
assert.deepEqual(defaultPresetFor("part-wheel-front", "limb", "wheel"), ["active", "spin"], "wheel kind spins");
assert.deepEqual(defaultPresetFor("part-flag", "accent", "flag"), ["alert", "wave"], "flag waves");
assert.deepEqual(defaultPresetFor("part-tail", "limb", null), ["active", "wag"], "id-based fallback still works without a kind");

// open states (Phase 2b): an under-rigged core-only mascot now EMITS, but with a plain-language
// warning naming the uncovered state + the role to add (it no longer hard-fails).
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const out2 = forgeEmit({ session: s.session, assetName: "under" });
  assert.equal(out2.ok, true, "a core-only rig now validates (empty states are warnings)");
  assert.ok(out2.warnings && out2.warnings.length, "uncovered states are reported as warnings");
  assert.ok(/active/.test(out2.message) && /limb/.test(out2.message), "message names the uncovered state + the role to add");
}

// input grade is surfaced at start, from the shared heuristic
{
  const mono = new PNG({ width: 30, height: 30 });
  for (let i = 0; i < mono.data.length; i += 4) { mono.data[i] = 50; mono.data[i + 1] = 50; mono.data[i + 2] = 50; mono.data[i + 3] = 255; }
  const sg = startFromImage({ base64: PNG.sync.write(mono).toString("base64"), colors: 4 });
  assert.equal(sg.inputGrade.grade, "silhouette", "monochrome start is graded silhouette");
  assert.ok(sg.inputGrade.recommendation, "grade carries a recommendation");
  const cg = startFromImage({ base64: blocksPngBase64(), colors: 4 });
  assert.ok(["good", "borderline"].includes(cg.inputGrade.grade), "multi-colour start is not a silhouette");
}

// app-signal states: a session can be started with extra states and set_part fills a preset for them
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4, states: ["idle", "loading", "error"] });
  assert.deepEqual(s.states, ["idle", "loading", "error"], "start declares the signal-state vocabulary");
  const partId = s.parts[0].id;
  setPart({ session: s.session, partId, role: "limb", presets: { loading: "spin" } });
  const st = forgeStatus({ session: s.session });
  // the loading state now has coverage (rigStatus tracks per declared state)
  assert.ok(st.rigStatus.loading >= 1, "set_part applied a preset to the loading state");
}

// planFor: mirror-aware recommendation engine — two limbs alternate walk/walk-mirror (fault #1), and
// options are keyed by every DECLARED state from the single presetsFor source of truth.
{
  const m = createModel({
    viewBox: "0 0 100 100",
    rects: [
      { id: "r0", x: 0, y: 0, w: 20, h: 40, fill: "#111", part: "part-leg-a" },
      { id: "r1", x: 40, y: 0, w: 20, h: 40, fill: "#111", part: "part-leg-b" },
      { id: "r2", x: 20, y: 50, w: 30, h: 30, fill: "#222", part: "part-body" },
    ],
    parts: { "part-leg-a": { role: "limb" }, "part-leg-b": { role: "limb" }, "part-body": { role: "core" } },
  });
  const plan = planFor(m);
  const legs = plan.filter((p) => p.role === "limb");
  assert.deepEqual(legs.map((l) => l.recommended.preset), ["walk", "walk-mirror"], "two limbs alternate walk/walk-mirror (no lockstep)");
  const legA = plan.find((p) => p.id === "part-leg-a");
  assert.ok(legA.options.active.includes("walk"), "plan entries carry per-state options from presetsFor");
}
{
  // options follow the rig's declared vocabulary, incl. signal states (loading reuses active via STATE_FAMILY)
  const m = createModel({ viewBox: "0 0 10 10", rects: [{ id: "r0", x: 0, y: 0, w: 10, h: 10, fill: "#000", part: "part-w" }], parts: { "part-w": { role: "limb" } }, states: ["idle", "active", "loading"] });
  const p = planFor(m)[0];
  assert.deepEqual(Object.keys(p.options).sort(), ["active", "idle", "loading"], "options keyed by declared states");
  assert.ok(p.options.loading.includes("spin"), "loading options reuse active motion (spin)");
}
{
  // forge_propose now returns the motion plan alongside parts/overlay
  const sp = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: sp.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const prop = forgePropose({ session: sp.session });
  assert.ok(Array.isArray(prop.plan) && prop.plan.length >= 1, "propose returns a motion plan");
  assert.ok(prop.plan[0].options && typeof prop.plan[0].options === "object", "plan entries carry options");
}
{
  // fault #1 regression: forge_emit auto-fill must NOT give two limbs the same in-phase preset
  const sd = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: sd.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "hand-left", role: "limb" });
  assignRegion({ session: sd.session, box: { x: 0.74, y: 0.30, w: 0.22, h: 0.28 }, partId: "hand-right", role: "limb" });
  assignRegion({ session: sd.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  forgeEmit({ session: sd.session, assetName: "desync" });
  const sel = _sessions.get(sd.session).model.selections();
  const lp = ["part-hand-left", "part-hand-right"].map((id) => sel.active && sel.active[id]);
  assert.ok(lp[0] && lp[1] && lp[0] !== lp[1], `two auto-filled limbs differ, no lockstep (${lp[0]} vs ${lp[1]})`);
}

console.log(`tools.test.mjs (agent-sim): all assertions passed. moved=${a1.moved}/${a2.moved}/${a3.moved} svgBytes=${out.svgBytes}`);

// editorHandoff carries the FULL rig (roles/pivots/presets/states), not just geometry, so the editor animates
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6, states: ["idle", "active", "alert"] });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "hand-left", role: "limb" });
  setPart({ session: s.session, partId: "part-body", role: "core", presets: { idle: "breathe" } });
  setPart({ session: s.session, partId: "part-hand-left", role: "limb", kind: "wheel", presets: { active: "walk" } });
  const { svg } = editorHandoff({ session: s.session });
  assert.match(svg, /<svg[^>]*\bdata-states="idle,active,alert"/, "root carries the declared states");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-role="core"/, "body group carries its role");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-preset-idle="breathe"/, "body group carries its idle preset");
  assert.match(svg, /<g id="part-hand-left"[^>]*\bdata-preset-active="walk"/, "limb group carries its active preset");
  assert.match(svg, /<g id="part-hand-left"[^>]*\bdata-kind="wheel"/, "limb group carries its kind (fidelity fix)");
  assert.match(svg, /<g id="part-body"[^>]*\bdata-pivot="\d+(\.\d+)?,\d+(\.\d+)?"/, "body group carries its pivot");
}

// emit + handoff return a copy-pasteable open URL (frictionless open)
{
  const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
  assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
  const e = forgeEmit({ session: s.session, assetName: "blip", outDir: "out/_test_open" });
  assert.match(e.open, /^http:\/\/localhost:\d+\/out\/_test_open\/blip-mascot-demo\.html$/, "emit returns a demo URL");
  const h = editorHandoff({ session: s.session, outDir: "out/_test_open" });
  assert.match(h.open, /^http:\/\/localhost:\d+\/tools\/rig-editor\/index\.html\?rig=out\/_test_open\/rig-handoff\.svg$/, "handoff returns an editor URL with ?rig=");
}

// safePath must resolve outDir against the repo root, not process.cwd() — an MCP client rarely
// launches the server with cwd pinned there, so cwd-relative resolution either wrote one directory
// too deep or rejected a perfectly valid outDir outright. Simulate a client launched from elsewhere.
{
  const savedCwd = process.cwd();
  process.chdir(fileURLToPath(new URL(".", import.meta.url))); // cwd = mcp/, one level below repo root
  try {
    const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });
    assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "body", role: "core" });
    const e = forgeEmit({ session: s.session, assetName: "cwdcheck", outDir: "out/_test_open" });
    assert.match(e.open, /^http:\/\/localhost:\d+\/out\/_test_open\/cwdcheck-mascot-demo\.html$/,
      `outDir resolves against the repo root regardless of server cwd (got ${e.open})`);
  } finally {
    process.chdir(savedCwd);
  }
}

// I2: an id with a space would produce '<g id="part-left arm">' and a broken '#part-left arm' CSS
// selector (a silent no-op animation). It must be sanitized to a single valid token at the boundary.
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4 });
  const r = assignRegion({ session: s.session, box: { x: 0, y: 0, w: 1, h: 1 }, partId: "Left Arm", role: "limb" });
  assert.ok(r.parts.some((p) => p.id === "part-left-arm"), "'Left Arm' sanitized to 'part-left-arm'");
  assert.ok(!r.parts.some((p) => /[ "A-Z]/.test(p.id)), "no id carries a space, quote, or uppercase");
}

// I1: a self-describing layered SVG (data-role/pivot/preset-*/states) must round-trip through the
// MCP alt entry, not just the browser. Regression for the dropped parts/states in startFromLayeredSvg.
{
  const rig =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,alert,loading">' +
    '<g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe">' +
    '<rect x="30" y="30" width="40" height="40" fill="#26a69a"/></g></svg>';
  const s = startFromLayeredSvg({ svg: rig });
  const m = _sessions.get(s.session).model;
  assert.deepEqual(m.states(), ["idle", "active", "alert", "loading"], "declared states survive MCP ingest");
  assert.equal(m.parts()["part-body"].role, "core", "role survives MCP ingest");
  assert.equal(m.preset("idle", "part-body"), "breathe", "preset survives MCP ingest");
}

// C1 regression: a Simple-tier rig (idle only) with a limb must EMIT, not crash. The limb has no
// idle preset, so it simply stays inert; the core still breathes. Auto-fill must not reach for 'active'.
{
  const s = startFromImage({ base64: blocksPngBase64(), colors: 4, states: ["idle"] });
  assignRegion({ session: s.session, box: { x: 0.05, y: 0.05, w: 0.9, h: 0.30 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.05, y: 0.62, w: 0.9, h: 0.27 }, partId: "leg", role: "limb" });
  const out = forgeEmit({ session: s.session, assetName: "simple" });
  assert.equal(out.ok, true, `Simple-tier emit must not crash: ${JSON.stringify(out.error || out.validation)}`);
  // planFor must not recommend an undeclared state for the limb
  const legPlan = planFor(_sessions.get(s.session).model).find((p) => p.id === "part-leg");
  assert.ok(!legPlan.recommended || legPlan.recommended.state === "idle",
    `limb recommendation stays within declared states (got ${JSON.stringify(legPlan.recommended)})`);
}

{ // a silhouette is steered to whole-body Simple, not carved into fake parts
  const W = 40, mono = new PNG({ width: W, height: W });
  for (let i = 0; i < mono.data.length; i += 4) { mono.data[i] = 60; mono.data[i + 1] = 60; mono.data[i + 2] = 60; mono.data[i + 3] = 255; }
  const sm = startFromImage({ base64: PNG.sync.write(mono).toString("base64"), colors: 4 });
  const prop = forgePropose({ session: sm.session });
  assert.match(prop.advisory || "", /whole-body|one part|Simple/i, "silhouette advisory recommends whole-body Simple");
}
