// pivot.js — pivot geometry for the editor. A pivot is an absolute point in viewBox coords; the
// CSS transform-origin is that point expressed as a percentage of the part's fill-box (the rig
// uses `transform-box: fill-box`, so origin % is relative to the element's own bounding box).
// Dependency-free; pure functions.

export function bboxOf(rects) {
  if (!rects || rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const pct = (v, min, size) => (size === 0 ? 0 : Math.round(((v - min) / size) * 100));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function pivotToOrigin(pivot, bbox) {
  return `${pct(pivot.x, bbox.x, bbox.w)}% ${pct(pivot.y, bbox.y, bbox.h)}%`;
}

export function originToPivot(origin, bbox) {
  const [px, py] = origin.split(/\s+/).map((s) => parseFloat(s) / 100);
  return { x: bbox.x + px * bbox.w, y: bbox.y + py * bbox.h };
}

// A dragged handle -> the canonical pivot (clamped into the part) + the matching origin string.
export function dragToPivot(point, bbox) {
  const pivot = {
    x: clamp(point.x, bbox.x, bbox.x + bbox.w),
    y: clamp(point.y, bbox.y, bbox.y + bbox.h),
  };
  return { pivot, origin: pivotToOrigin(pivot, bbox) };
}
