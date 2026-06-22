// Robustness battery — run 20 diverse synthetic images through the full pipeline and report.
// Not a gate test (underscore prefix); run: `node tools/rig-editor/_battery.mjs`.
import { vectorizeRaster } from "./vectorize.js";
import { segment } from "./segment.js";
import { parseSegmented } from "./loader.js";
import { recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";
import { emitAnimatedSvg } from "./emit.js";

function grid(w, h, paint) {
  const a = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; const p = paint(x, y);
    if (!p) { a[i + 3] = 0; continue; }
    a[i] = p[0]; a[i + 1] = p[1]; a[i + 2] = p[2]; a[i + 3] = p[3] === undefined ? 255 : p[3];
  }
  return { rgba: a, w, h };
}
const Y = [230, 200, 40], B = [40, 40, 40], R = [220, 40, 40], G = [40, 200, 80], BL = [40, 80, 220];
const inRect = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;

const cases = [
  { name: "01 solid", w: 64, h: 64, paint: () => Y },
  { name: "02 two-side-by-side", w: 64, h: 40, paint: (x) => (x < 32 ? Y : B) },
  { name: "03 body+leg-below", w: 64, h: 80, paint: (x, y) => (inRect(x, y, 50, 60, 60, 80) ? B : inRect(x, y, 10, 10, 54, 55) ? Y : null) },
  { name: "04 full-mascot", w: 80, h: 90, paint: (x, y) => {
      if (inRect(x, y, 20, 4, 26, 18)) return G;                 // antenna (above)
      if (inRect(x, y, 18, 70, 26, 88)) return B;                // leg-left (below)
      if (inRect(x, y, 54, 70, 62, 88)) return B;                // leg-right (below)
      if (inRect(x, y, 28, 30, 34, 36) || inRect(x, y, 50, 30, 56, 36)) return R; // eyes (islands)
      if (inRect(x, y, 14, 20, 66, 68)) return Y;                // body
      return null; } },
  { name: "05 one-pixel", w: 32, h: 32, paint: (x, y) => (x === 5 && y === 5 ? Y : null) },
  { name: "06 checkerboard", w: 16, h: 16, paint: (x, y) => ((x + y) % 2 ? Y : B) },
  { name: "07 gradient", w: 64, h: 32, colors: 6, paint: (x) => [20 + x * 3, 100, 200 - x * 2] },
  { name: "08 1x1", w: 1, h: 1, paint: () => Y },
  { name: "09 2x2", w: 2, h: 2, paint: (x) => (x ? Y : B) },
  { name: "10 large-200", w: 200, h: 200, colors: 6, paint: (x, y) => [ (x * 7) % 256, (y * 5) % 256, ((x + y) * 3) % 256 ] },
  { name: "11 donut", w: 60, h: 60, paint: (x, y) => { const d = Math.hypot(x - 30, y - 30); return d < 25 && d > 12 ? Y : null; } },
  { name: "12 thin-line-1px", w: 50, h: 1, paint: () => Y },
  { name: "13 wide", w: 100, h: 10, paint: (x) => (x < 50 ? Y : B) },
  { name: "14 tall", w: 10, h: 100, paint: (x, y) => (y < 50 ? Y : B) },
  { name: "15 concentric", w: 60, h: 60, paint: (x, y) => { const d = Math.hypot(x - 30, y - 30); return d < 8 ? G : d < 16 ? B : d < 26 ? Y : null; } },
  { name: "16 two-same-colour-blobs", w: 64, h: 32, paint: (x) => (x < 20 ? Y : x > 44 ? Y : null) },
  { name: "17 all-transparent", w: 32, h: 32, paint: () => null, expectError: true },
  { name: "18 many-colours", w: 60, h: 12, colors: 6, paint: (x) => [[230,0,0],[0,200,0],[0,0,230],[230,230,0],[230,0,230],[0,230,230],[120,60,0],[60,60,60],[200,120,40],[40,120,200],[120,200,40],[200,40,120]][Math.floor(x / 5) % 12] },
  { name: "19 single-row", w: 40, h: 1, paint: (x) => (x < 20 ? Y : B) },
  { name: "20 single-col", w: 1, h: 40, paint: (x, y) => (y < 20 ? Y : B) },
];

const PLAN = [["core", "idle", "breathe"], ["limb", "active", "walk"], ["accent", "alert", "pulse"]];
let bugs = 0;
for (const c of cases) {
  const res = { name: c.name };
  try {
    const flat = vectorizeRaster(grid(c.w, c.h, c.paint), { colors: c.colors || 6 });
    res.rects = flat.rects.length;
    const seg = segment(flat.rects, { viewBoxSize: Math.max(c.w, c.h) });
    const m = parseSegmented(seg.svg);
    const parts = Object.keys(m.parts()).filter((id) => m.rectsOf(id).length > 0);
    res.parts = parts.length;
    parts.forEach((id, i) => { if (i < 3) { const [role, st, pre] = PLAN[i]; m.setRole(id, role); m.setBone(id, "b" + i); m.setPreset(st, id, pre); } });
    const out = exportRig(m, { assetName: "t", recipeFor });
    const v = validate(out.riggedJson);
    res.exportValid = v.ok;
    if (!v.ok) res.why = v.errors[0];
    const svg = emitAnimatedSvg(out.riggedJson, out.manualSvg);
    res.svgBytes = svg.length;
    res.status = c.expectError ? "UNEXPECTED-OK" : v.ok ? "OK" : (parts.length < 3 ? "rig-incomplete (too few parts — expected)" : "RIG-INVALID");
    if (res.status === "UNEXPECTED-OK") bugs++;
  } catch (e) {
    res.status = c.expectError ? "expected-error" : "UNEXPECTED-ERROR";
    res.error = e.message;
    if (!c.expectError) bugs++;
  }
  console.log(`${res.status.padEnd(34)} ${c.name.padEnd(26)} ` +
    `rects=${res.rects ?? "-"} parts=${res.parts ?? "-"} valid=${res.exportValid ?? "-"}` +
    (res.why ? ` why="${res.why}"` : "") + (res.error ? ` ERR="${res.error}"` : ""));
}
console.log("\nUNEXPECTED ISSUES:", bugs);
process.exitCode = bugs ? 1 : 0; // crash-safety: nonzero if any input made the pipeline throw unexpectedly
