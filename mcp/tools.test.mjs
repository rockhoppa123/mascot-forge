// Agent-simulation test for the MCP tool chain (M1). Drives the handlers with fixed normalized coords —
// no live agent — to prove: image -> assigned-by-region -> valid self-contained animated SVG.
// Uses a synthetic 3-block PNG (red/green/blue, with margins) so each region is cleanly enclosable and
// the test is deterministic. Run: `node mcp/tools.test.mjs` (after `npm install` in mcp/).
import assert from "node:assert/strict";
import { PNG } from "pngjs";
import { startFromImage, assignRegion, forgeEmit } from "./tools.mjs";

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

// 4. graceful errors
assert.throws(() => assignRegion({ session: "nope", box: { x: 0, y: 0, w: 1, h: 1 }, partId: "x" }), /unknown session/);
assert.throws(() => startFromImage({}), /base64 or path/);

console.log(`tools.test.mjs (agent-sim): all assertions passed. moved=${a1.moved}/${a2.moved}/${a3.moved} svgBytes=${out.svgBytes}`);
