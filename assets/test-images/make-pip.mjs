// Generate "pip.png" — a brand-new flat-art critter with TWO limb pairs (arms + legs) so the new
// walk/walk-mirror de-sync is visible, plus eyes + antenna for option variety. 6 distinct fills ->
// grades "good". Zero art committed; pure pixels. Run: node make-pip.mjs
import { PNG } from "../../mcp/node_modules/pngjs/lib/png.js";
import { writeFileSync } from "node:fs";

const W = 130, H = 130, png = new PNG({ width: W, height: H });
const set = (x, y, c) => { const i = (y * W + x) << 2; png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = c[3]; };
const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;

const PURPLE = [124, 92, 200, 255], ORANGE = [240, 150, 40, 255], BLUE = [40, 130, 200, 255],
      WHITE = [245, 245, 250, 255], GREEN = [90, 200, 120, 255], PINK = [230, 60, 90, 255];
const body = box(44, 46, 86, 92);
const armL = box(28, 54, 42, 82), armR = box(88, 54, 102, 82);
const legL = box(50, 92, 62, 114), legR = box(68, 92, 80, 114);
const eyeL = box(52, 58, 60, 66), eyeR = box(70, 58, 78, 66);
const stem = box(62, 30, 68, 46), tip = box(58, 22, 72, 32);

for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let c = [0, 0, 0, 0];
  if (tip(x, y)) c = PINK;
  else if (stem(x, y)) c = GREEN;
  else if (eyeL(x, y) || eyeR(x, y)) c = WHITE;
  else if (armL(x, y) || armR(x, y)) c = ORANGE;
  else if (legL(x, y) || legR(x, y)) c = BLUE;
  else if (body(x, y)) c = PURPLE;
  set(x, y, c);
}
writeFileSync(new URL("./pip.png", import.meta.url), PNG.sync.write(png));
console.log("wrote pip.png (130x130, 6 fills: body/arms/legs/eyes/antenna-stem/tip)");
