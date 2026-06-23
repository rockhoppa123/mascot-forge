// pivot.js — pivot geometry for the editor. A pivot is an absolute point in viewBox coords; the
// CSS transform-origin is that point expressed as a percentage of the part's fill-box (the rig
// uses `transform-box: fill-box`, so origin % is relative to the element's own bounding box).
// Dependency-free; pure functions.

// Accepts rects ({x,y,w,h}) and/or geometry-agnostic elements carrying a cached `bbox`
// ({bbox:{x,y,w,h}}) — see ADR-0011. Falls back to the rect fields when no bbox is present.
export function bboxOf(rects) {
  if (!rects || rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    const b = r.bbox || r;
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// The default pivot for a part, by role, in absolute viewBox coords. The ONE source of truth for
// "where should this part rotate from" — shared by the editor (on role-assign), the MCP (set_part),
// and segment.js (the leg = a limb joint). A limb hinges at its joint (top-edge centre = the
// hip/shoulder line); every other role rotates/scales about its bbox centre. Keep these three callers
// in lockstep by changing only this function. (segment.js keeps one extra geometry rule — the antenna
// base-centre — which is not a role default and so stays local to it.)
export function defaultPivotFor(role, bbox) {
  if (role === "limb") return { x: bbox.x + bbox.w / 2, y: bbox.y };
  return { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
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
