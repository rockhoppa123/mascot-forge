// make-blocks.mjs — regenerate blocks.png, the e2e drop fixture. Zero-dep (node:zlib + node:fs only;
// tests/ must NOT depend on mcp/node_modules). A 32x32 RGBA PNG of 4 distinct opaque colour quadrants
// so the vectoriser grades it good/borderline and segments into multiple parts. Run: `node make-blocks.mjs`.
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const W = 32, H = 32;
const quad = (x, y) => (x < W / 2
  ? (y < H / 2 ? [220, 40, 40] : [40, 70, 200])      // TL red / BL blue
  : (y < H / 2 ? [40, 170, 60] : [230, 200, 40]));   // TR green / BR yellow

// raw image: each row = filter byte (0) + W*4 RGBA bytes
const raw = Buffer.alloc(H * (1 + W * 4));
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0; // filter: none
  for (let x = 0; x < W; x++) { const [r, g, b] = quad(x, y); raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = 255; }
}

const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;   // bit depth
ihdr[9] = 6;   // colour type: RGBA
// 10,11,12 = compression/filter/interlace = 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // signature
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = fileURLToPath(new URL("./blocks.png", import.meta.url));
writeFileSync(out, png);
console.log(`wrote ${out}: ${png.length} bytes (${W}x${H} RGBA, 4 quadrants)`);
