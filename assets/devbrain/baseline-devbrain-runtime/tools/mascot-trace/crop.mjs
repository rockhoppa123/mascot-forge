// Dev-only: crop one reference pose, upscale, and save a PNG for visual review.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodePng } from "./png.mjs";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc(height * (width * 3 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const si = (y * width + x) * 3;
      const di = y * (width * 3 + 1) + 1 + x * 3;
      raw[di] = rgb[si];
      raw[di + 1] = rgb[si + 1];
      raw[di + 2] = rgb[si + 2];
    }
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const [file, cx, cy, cw, ch, scale, out] = process.argv.slice(2);
const img = decodePng(file);
const X = +cx;
const Y = +cy;
const W = +cw;
const Hh = +ch;
const S = +scale;
const rgb = Buffer.alloc(W * S * Hh * S * 3);
for (let y = 0; y < Hh * S; y++) {
  for (let x = 0; x < W * S; x++) {
    const sx = Math.min(img.width - 1, X + Math.floor(x / S));
    const sy = Math.min(img.height - 1, Y + Math.floor(y / S));
    const si = (sy * img.width + sx) * 4;
    const di = (y * W * S + x) * 3;
    rgb[di] = img.data[si];
    rgb[di + 1] = img.data[si + 1];
    rgb[di + 2] = img.data[si + 2];
  }
}
writeFileSync(out, encodePng(W * S, Hh * S, rgb));
console.log(`wrote ${out} (${W * S}x${Hh * S})`);
