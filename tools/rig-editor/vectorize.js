// vectorize.js — PNG raster → flat SVG rects, the browser port of tools/vectorize-pixel.ps1.
// Pure (no canvas, no DOM): the caller decodes the PNG to an RGBA grid; this does the deterministic
// median-cut quantization + RLE/greedy-mesh into rects. Runs identically under node (tests) and the
// browser. Equivalent-not-byte-parity with the PS script (ADR / 2026-06-22 spec): same algorithm,
// not a guaranteed identical file (canvas vs System.Drawing decode can differ).
//
// Pipeline (mirrors vectorize-pixel.ps1):
//   rgba grid + alpha threshold -> opaque histogram + bounds
//   -> deterministic median-cut (largest-GAP split, longest axis, r>g>b ties) -> palette
//   -> map every pixel to nearest palette entry -> quantized hex grid
//   -> per-row RLE + greedy vertical merge of equal (x,width,colour) runs -> rects.

const hex = (packed) =>
  "#" +
  [(packed >> 16) & 0xff, (packed >> 8) & 0xff, packed & 0xff]
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("");

// --- deterministic median-cut over a packed-RGB histogram --------------------------------------
// histogram: Map<packedRGB, count>. Returns an array of `colors` packed-RGB palette entries
// (count-weighted box averages), order-independent of input insertion order.
export function quantize(histogram, colors) {
  if (colors < 1) throw new Error("quantize: colors must be >= 1.");
  const counts = histogram;
  const uniq = [...counts.keys()].sort((a, b) => a - b); // ascending => order-independent

  const ch = (c, shift) => (c >> shift) & 0xff;
  function box(list) {
    let rMin = 255, gMin = 255, bMin = 255, rMax = 0, gMax = 0, bMax = 0, count = 0;
    for (const c of list) {
      const r = ch(c, 16), g = ch(c, 8), b = c & 0xff;
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
      count += counts.get(c);
    }
    return { colors: list, count, rRange: rMax - rMin, gRange: gMax - gMin, bRange: bMax - bMin };
  }

  const boxes = [box(uniq)];
  while (boxes.length < colors) {
    // pick the splittable box with the largest single-channel range; first wins ties (stable).
    let targetIndex = -1, bestRange = -1;
    for (let bi = 0; bi < boxes.length; bi++) {
      const b = boxes[bi];
      if (b.colors.length < 2) continue;
      const range = Math.max(b.rRange, b.gRange, b.bRange);
      if (range > bestRange) { bestRange = range; targetIndex = bi; }
    }
    if (targetIndex < 0) break; // nothing left to split

    const b = boxes[targetIndex];
    const axis = b.rRange >= b.gRange && b.rRange >= b.bRange ? 16 : b.gRange >= b.bRange ? 8 : 0;
    // longest axis decides the sort key; value tiebreak for determinism.
    const sorted = b.colors.slice().sort((x, y) => ch(x, axis) - ch(y, axis) || x - y);
    // split at the largest gap along the longest axis (isolates rare-but-salient accents instead of
    // letting the dominant mass swallow them). First-largest gap wins ties.
    let splitAt = 1, bestGap = -1;
    for (let k = 1; k < sorted.length; k++) {
      const gap = ch(sorted[k], axis) - ch(sorted[k - 1], axis);
      if (gap > bestGap) { bestGap = gap; splitAt = k; }
    }
    boxes.splice(targetIndex, 1, box(sorted.slice(0, splitAt)), box(sorted.slice(splitAt)));
  }

  return boxes.map((b) => {
    let sr = 0, sg = 0, sb = 0, sc = 0;
    for (const c of b.colors) {
      const wt = counts.get(c);
      sr += ch(c, 16) * wt; sg += ch(c, 8) * wt; sb += (c & 0xff) * wt; sc += wt;
    }
    const round = (v) => Math.round(v / sc); // round-half-up (Math.round) on non-negative values
    return (round(sr) << 16) | (round(sg) << 8) | round(sb);
  });
}

function nearestHexFactory(palette) {
  const cache = new Map();
  return (packed) => {
    const cached = cache.get(packed);
    if (cached !== undefined) return cached;
    const r = (packed >> 16) & 0xff, g = (packed >> 8) & 0xff, b = packed & 0xff;
    let bestIdx = 0, bestDist = Infinity;
    for (let pi = 0; pi < palette.length; pi++) {
      const p = palette[pi];
      const dr = r - ((p >> 16) & 0xff), dg = g - ((p >> 8) & 0xff), db = b - (p & 0xff);
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) { bestDist = dist; bestIdx = pi; }
    }
    const h = hex(palette[bestIdx]);
    cache.set(packed, h);
    return h;
  };
}

// --- per-row RLE + greedy vertical merge --------------------------------------------------------
// quantGrid[y*w+x] = hex string for opaque pixels, null for transparent. Returns rects grouped by
// colour ascending, (y,x) ascending within a colour (mirrors the flat.svg emit order).
export function meshRects(quantGrid, w, h) {
  const rectsByColor = new Map(); // hex -> [{x,y,w,h}]
  const open = new Map();         // "x|w|hex" -> {x,w,hex,startY}
  const close = (rect, endYExclusive) => {
    if (!rectsByColor.has(rect.hex)) rectsByColor.set(rect.hex, []);
    rectsByColor.get(rect.hex).push({ x: rect.x, y: rect.startY, w: rect.w, h: endYExclusive - rect.startY });
  };

  for (let y = 0; y < h; y++) {
    const base = y * w;
    const rowKeys = new Set();
    let x = 0;
    while (x < w) {
      const c = quantGrid[base + x];
      if (!c) { x++; continue; }
      let x2 = x + 1;
      while (x2 < w && quantGrid[base + x2] === c) x2++;
      const runW = x2 - x;
      const key = `${x}|${runW}|${c}`;
      rowKeys.add(key);
      if (!open.has(key)) open.set(key, { x, w: runW, hex: c, startY: y });
      x = x2;
    }
    for (const [key, rect] of [...open]) {
      if (!rowKeys.has(key)) { close(rect, y); open.delete(key); }
    }
  }
  for (const [, rect] of open) close(rect, h);

  const rects = [];
  for (const hexColor of [...rectsByColor.keys()].sort()) {
    const ordered = rectsByColor.get(hexColor).sort((a, b) => a.y - b.y || a.x - b.x);
    for (const r of ordered) rects.push({ x: r.x, y: r.y, w: r.w, h: r.h, fill: hexColor });
  }
  return rects;
}

// --- orchestrator: RGBA grid -> { rects, palette, bounds, viewBox } -----------------------------
export function vectorizeRaster({ rgba, w, h }, { colors = 6, alphaThreshold = 1 } = {}) {
  if (colors < 1) throw new Error("vectorizeRaster: colors must be >= 1.");
  const histogram = new Map();
  const packedGrid = new Int32Array(w * h);
  let opaque = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (rgba[i + 3] < alphaThreshold) { packedGrid[y * w + x] = -1; continue; }
      const packed = (rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2];
      packedGrid[y * w + x] = packed;
      histogram.set(packed, (histogram.get(packed) || 0) + 1);
      opaque++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (opaque === 0) throw new Error("vectorizeRaster: source has no opaque pixels above the alpha threshold.");

  const palette = quantize(histogram, colors);
  const nearest = nearestHexFactory(palette);
  const quantGrid = new Array(w * h);
  for (let idx = 0; idx < packedGrid.length; idx++) {
    quantGrid[idx] = packedGrid[idx] < 0 ? null : nearest(packedGrid[idx]);
  }

  return {
    rects: meshRects(quantGrid, w, h),
    palette: palette.map(hex),
    bounds: { minX, minY, maxX, maxY },
    viewBox: `0 0 ${w} ${h}`,
    width: w,
    height: h,
  };
}
