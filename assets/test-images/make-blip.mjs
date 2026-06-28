// Generate "blip.png" — a brand-new flat-art mascot with colour-distinct parts so it grades "good"
// and segments into core/limb/accent candidates. Zero art committed; pure pixels. Run: node make-blip.mjs
import { PNG } from "../../mcp/node_modules/pngjs/lib/png.js";
import { writeFileSync } from "node:fs";

const W = 120, H = 120, png = new PNG({ width: W, height: H });
const set = (x, y, c) => { const i = (y * W + x) << 2; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3]; };
const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

// distinct fills -> distinct parts: teal body, blue legs, white eyes, orange antenna, red tip
const TEAL = [38, 166, 154, 255], BLUE = [33, 64, 120, 255], WHITE = [240, 240, 245, 255], ORANGE = [240, 140, 40, 255], RED = [220, 50, 50, 255];
const body = box(38, 40, 82, 84);
const legL = box(42, 84, 54, 104), legR = box(66, 84, 78, 104);
const eyeL = box(46, 52, 54, 60), eyeR = box(66, 52, 74, 60);
const antenna = box(58, 24, 62, 40), tip = box(54, 16, 66, 26);

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let c = [0, 0, 0, 0];
  if (tip(x, y)) c = RED;
  else if (antenna(x, y)) c = ORANGE;
  else if (eyeL(x, y) || eyeR(x, y)) c = WHITE;
  else if (body(x, y)) c = TEAL;
  else if (legL(x, y) || legR(x, y)) c = BLUE;
  set(x, y, c);
}
writeFileSync(new URL("./blip.png", import.meta.url), PNG.sync.write(png));
console.log("wrote blip.png (120x120, 5 fills: body/legs/eyes/antenna/tip)");
