// Minimal zero-dependency PNG decoder (8-bit, color types 2/3/6).
// Enough to read the saved mascot reference sheets into RGBA pixels.
// Dev-only tooling — never imported by the app.

import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * @param {string} path
 * @returns {{ width: number, height: number, data: Uint8Array }} RGBA, row-major.
 */
export function decodePng(path) {
  const buf = readFileSync(path);
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error(`${path}: not a PNG`);

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let trns = null;
  const idat = [];

  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const data = buf.subarray(start, start + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`${path}: only 8-bit depth supported (got ${bitDepth})`);
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      trns = data;
    } else if (type === "IDAT") {
      idat.push(Uint8Array.prototype.slice.call(data));
    } else if (type === "IEND") {
      break;
    }

    offset = start + length + 4; // skip data + CRC
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1; // 6=RGBA 2=RGB 3=palette
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);

  // Unfilter scanlines in place into `lines`.
  const lines = new Uint8Array(height * stride);
  const bpp = channels;
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const srcRow = y * (stride + 1) + 1;
    const dstRow = y * stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[srcRow + x];
      const left = x >= bpp ? lines[dstRow + x - bpp] : 0;
      const up = y > 0 ? lines[dstRow - stride + x] : 0;
      const upLeft = y > 0 && x >= bpp ? lines[dstRow - stride + x - bpp] : 0;
      let recon;
      switch (filter) {
        case 0:
          recon = value;
          break;
        case 1:
          recon = value + left;
          break;
        case 2:
          recon = value + up;
          break;
        case 3:
          recon = value + ((left + up) >> 1);
          break;
        case 4:
          recon = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`${path}: bad filter ${filter}`);
      }
      lines[dstRow + x] = recon & 0xff;
    }
  }

  // Expand to RGBA.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      if (channels === 4) {
        const si = y * stride + x * 4;
        out[di] = lines[si];
        out[di + 1] = lines[si + 1];
        out[di + 2] = lines[si + 2];
        out[di + 3] = lines[si + 3];
      } else if (channels === 3) {
        const si = y * stride + x * 3;
        out[di] = lines[si];
        out[di + 1] = lines[si + 1];
        out[di + 2] = lines[si + 2];
        out[di + 3] = 255;
      } else {
        const idx = lines[y * stride + x];
        out[di] = palette[idx * 3];
        out[di + 1] = palette[idx * 3 + 1];
        out[di + 2] = palette[idx * 3 + 2];
        out[di + 3] = trns && idx < trns.length ? trns[idx] : 255;
      }
    }
  }

  return { width, height, data: out };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}
