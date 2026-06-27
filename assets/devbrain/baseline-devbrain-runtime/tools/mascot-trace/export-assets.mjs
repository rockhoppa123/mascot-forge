// Exports each production mascot pose from the reference PNG sheets into a clean,
// transparent, baseline-normalised PNG under public/mascot/. The cream sheet
// background is feathered to alpha, the character is isolated from its label and
// neighbours, and every pose is composited so the body width and the feet line
// are consistent — so swapping states never makes the mascot jump.
//
//   node tools/mascot-trace/export-assets.mjs
//
// The app renders these via next/image (optimised to WebP/AVIF at request time).

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodePng } from "./png.mjs";

const DESIGN = "docs/design";
const OUT_DIR = "public/mascot";

// pose id -> source sheet + grid cell (cols x rows, 0-indexed col,row).
const POSES = [
  { id: "default", file: "reference", cols: 5, rows: 1, col: 0, row: 0 },
  { id: "thinking", file: "reference", cols: 5, rows: 1, col: 1, row: 0 },
  { id: "happy", file: "reference", cols: 5, rows: 1, col: 2, row: 0 },
  { id: "diagnostic", file: "reference", cols: 5, rows: 1, col: 3, row: 0 },
  { id: "offline", file: "reference", cols: 5, rows: 1, col: 4, row: 0 },
  { id: "asleep", file: "emotions", cols: 2, rows: 2, col: 0, row: 0 },
  { id: "caution", file: "gestures", cols: 4, rows: 2, col: 1, row: 1 },
  { id: "critical", file: "gestures", cols: 4, rows: 2, col: 2, row: 1 },
];

const FILES = {
  reference: "devbrain-mascot-reference-v1.png",
  emotions: "devbrain-mascot-emotions-v1.png",
  gestures: "devbrain-mascot-gestures-v1.png",
};

// Output canvas + layout (high-res; next/image downscales crisply). Sized to hug
// the character — just enough headroom for the thought bubble / antenna / alert
// marks — so the mascot fills its frame instead of floating in dead space.
const CW = 192;
const CH = 192;
const BODY_W = 150; // amber body normalised to this width across all poses
const FEET_Y = 178; // bottom of the character sits here in every pose

function near(p, bg, tol) {
  return Math.abs(p[0] - bg[0]) < tol && Math.abs(p[1] - bg[1]) < tol && Math.abs(p[2] - bg[2]) < tol;
}
function isChip(p, bg) {
  const max = Math.max(p[0], p[1], p[2]);
  const min = Math.min(p[0], p[1], p[2]);
  return max - min < 28 && max > 150 && !near(p, bg, 16);
}
function isAmber(p) {
  return p[0] > 120 && p[0] > p[2] + 30 && p[1] > p[2];
}
function pix(img, x, y) {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function encodeRgba(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function exportPose(pose) {
  const img = decodePng(`${DESIGN}/${FILES[pose.file]}`);
  const bg = [img.data[0], img.data[1], img.data[2]];
  const cw = img.width / pose.cols;
  const ch = img.height / pose.rows;
  const insetX = Math.round(cw * 0.04); // trim cell edges so neighbours don't bleed in
  const cx = Math.round(pose.col * cw) + insetX;
  const cy = Math.round(pose.row * ch);
  const cxEnd = Math.round((pose.col + 1) * cw) - insetX;
  const cyEnd = Math.round((pose.row + 1) * ch);

  // Label chip top within the cell — the character is everything above it.
  let chipTop = cyEnd;
  for (let y = cy; y < cyEnd; y++) {
    let n = 0;
    for (let x = cx; x < cxEnd; x++) if (isChip(pix(img, x, y), bg)) n++;
    if (n > (cxEnd - cx) * 0.2) {
      chipTop = y;
      break;
    }
  }

  const inInk = (x, y) => {
    if (x < cx || x >= cxEnd || y < cy || y >= chipTop) return false;
    const p = pix(img, x, y);
    return p[3] > 80 && !near(p, bg, 28) && !isChip(p, bg);
  };

  // Full-ink bbox (body + legs + antenna + marks) and amber-only bbox (the body).
  let ix0 = cxEnd;
  let iy0 = chipTop;
  let ix1 = cx;
  let iy1 = cy;
  let ax0 = cxEnd;
  let ax1 = cx;
  for (let y = cy; y < chipTop; y++) {
    for (let x = cx; x < cxEnd; x++) {
      if (!inInk(x, y)) continue;
      if (x < ix0) ix0 = x;
      if (x > ix1) ix1 = x;
      if (y < iy0) iy0 = y;
      if (y > iy1) iy1 = y;
      if (isAmber(pix(img, x, y))) {
        if (x < ax0) ax0 = x;
        if (x > ax1) ax1 = x;
      }
    }
  }
  const amberW = Math.max(1, ax1 - ax0 + 1);
  const amberCx = (ax0 + ax1) / 2;
  const scale = BODY_W / amberW;
  const feetSrcY = iy1 + 1;

  // Compose onto the normalised canvas (nearest sampling; cream feathered to alpha).
  const rgba = Buffer.alloc(CW * CH * 4);
  for (let dy = 0; dy < CH; dy++) {
    for (let dx = 0; dx < CW; dx++) {
      const sx = Math.round(amberCx + (dx - CW / 2) / scale);
      const sy = Math.round(feetSrcY + (dy - FEET_Y) / scale);
      const di = (dy * CW + dx) * 4;
      if (sx < cx || sx >= cxEnd || sy < cy || sy >= chipTop) continue; // transparent
      const p = pix(img, sx, sy);
      if (p[3] < 40 || isChip(p, bg)) continue;
      const d = Math.max(Math.abs(p[0] - bg[0]), Math.abs(p[1] - bg[1]), Math.abs(p[2] - bg[2]));
      const a = d <= 26 ? 0 : d >= 70 ? 255 : Math.round(((d - 26) / 44) * 255);
      if (a === 0) continue;
      rgba[di] = p[0];
      rgba[di + 1] = p[1];
      rgba[di + 2] = p[2];
      rgba[di + 3] = a;
    }
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/${pose.id}.png`, encodeRgba(CW, CH, rgba));
  console.log(`  ${pose.id}.png  amberW=${amberW} scale=${scale.toFixed(2)}`);
}

console.log(`Exporting ${POSES.length} mascot poses to ${OUT_DIR}/`);
for (const pose of POSES) exportPose(pose);
console.log("done.");
