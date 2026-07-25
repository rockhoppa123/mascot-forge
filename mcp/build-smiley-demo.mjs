// build-smiley-demo.mjs — regenerate the MCP-rigged smiley artifact used by the P-D live-data hero
// demo (docs/buildable-slice/mcp-live-demo.html). This drives the SAME tool handlers an agent would
// call (start_from_image -> assign_region xN -> set_part xN -> forge_emit) on a synthetic smiley PNG,
// so the committed SVG is a faithful, reproducible output of the agent-rigging path — not hand-authored.
// It is the worked example from tools.test.mjs (M2), emitted to a file instead of asserted.
//
// Run from mcp/ (after `npm install`):  node build-smiley-demo.mjs
// Output: ../docs/buildable-slice/mcp-smiley/smiley-mascot.svg  (+ -demo.html, the standalone preview).
// Kept out of generated/ on purpose — that dir is the LOCKED Phase-1 buildable slice (allowlisted by
// tools/check-buildable-slice.ps1); this is a separate, regenerable agent-path artifact.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { startFromImage, assignRegion, setPart, forgeStatus, forgeEmit } from "./tools.mjs";

// A synthetic multi-block "smiley": body (yellow), two eyes (dark), two hands (orange), a tongue
// (red). No third-party art is committed. Layout matches the M2 worked example (90x90 viewBox).
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

const DEFAULT_OUT_DIR = resolve(fileURLToPath(new URL("../docs/buildable-slice/mcp-smiley", import.meta.url)));

// Exported so smiley-golden.test.mjs can rebuild into a temp dir and prove the COMMITTED artifact
// still matches this recipe. One recipe, two callers — the same anti-drift rule that makes
// tools/rig-editor/emit.js shared between the editor's live preview and its export.
export function buildSmiley({ outDir = DEFAULT_OUT_DIR } = {}) {
// 1. start from the image (the agent host would pass the user's PNG as base64)
const s = startFromImage({ base64: smileyPngBase64(), colors: 6 });

// 2. the agent segments by vision into five semantic parts (normalized 0..1 boxes)
assignRegion({ session: s.session, box: { x: 0.30, y: 0.18, w: 0.40, h: 0.52 }, partId: "part-body", role: "core" });
assignRegion({ session: s.session, box: { x: 0.38, y: 0.28, w: 0.22, h: 0.10 }, partId: "part-eyes", role: "accent" });
assignRegion({ session: s.session, box: { x: 0.04, y: 0.30, w: 0.20, h: 0.28 }, partId: "part-hand-left", role: "limb" });
assignRegion({ session: s.session, box: { x: 0.74, y: 0.30, w: 0.22, h: 0.28 }, partId: "part-hand-right", role: "limb" });
assignRegion({ session: s.session, box: { x: 0.40, y: 0.70, w: 0.22, h: 0.25 }, partId: "part-tongue", role: "accent" });

// 3. assign motion per part — one preset per state so idle/active/alert all animate
setPart({ session: s.session, partId: "part-body", role: "core", bone: "body", presets: { idle: "breathe" } });
setPart({ session: s.session, partId: "part-eyes", role: "accent", bone: "eyes", presets: { idle: "blink" } });
setPart({ session: s.session, partId: "part-hand-left", role: "limb", bone: "arm-left", presets: { active: "walk" } });
setPart({ session: s.session, partId: "part-hand-right", role: "limb", bone: "arm-right", presets: { active: "walk-mirror" } });
setPart({ session: s.session, partId: "part-tongue", role: "accent", bone: "tongue", presets: { alert: "pulse" } });

const st = forgeStatus({ session: s.session });
if (!(st.rigStatus.idle && st.rigStatus.active && st.rigStatus.alert)) {
  throw new Error(`smiley rig must cover all three states: ${JSON.stringify(st.rigStatus)}`);
}

// 4. emit the owned, self-contained animated SVG (+ standalone demo) into generated/
const out = forgeEmit({ session: s.session, assetName: "smiley", outDir });
if (!out.ok) throw new Error(`smiley emit invalid: ${JSON.stringify(out.validation || out.error)}`);

  return { written: out.written, rigStatus: st.rigStatus };
}

// CLI entry — only when run directly, so importing this module has no side effects.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildSmiley();
  console.error(`build-smiley-demo: wrote ${r.written.join(", ")} (states ${JSON.stringify(r.rigStatus)})`);
}
