// Agent-simulation test for the MCP tool chain (M1). Drives the handlers with fixed normalized coords —
// no live agent — to prove: image -> assigned-by-region -> valid self-contained animated SVG.
// Uses a synthetic 3-block PNG (red/green/blue, with margins) so each region is cleanly enclosable and
// the test is deterministic. Run: `node mcp/tools.test.mjs` (after `npm install` in mcp/).
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { startFromImage, assignRegion, setPart, forgeStatus, forgeEmit, startFromLayeredSvg } from "./tools.mjs";

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

  // a non-rect element (no node rasterizer for its bbox) is rejected with a clear v1-limit message.
  const withPath =
    '<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">' +
    '<g id="blob"><path d="M5 5 H45 V45 Z" fill="#000"/></g></svg>';
  assert.throws(() => startFromLayeredSvg({ svg: withPath }), /rect-bearing only/, "layered: non-rect is refused in v1");

  // graceful errors
  assert.throws(() => startFromLayeredSvg({}), /svg \(string\) or path/);
  console.log(`tools.test.mjs (M3 layered): start_from_layered_svg -> emit green. svgBytes=${lem.svgBytes}`);
}

console.log(`tools.test.mjs (agent-sim): all assertions passed. moved=${a1.moved}/${a2.moved}/${a3.moved} svgBytes=${out.svgBytes}`);
