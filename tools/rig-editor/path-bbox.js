// path-bbox.js — bounding box of an SVG path `d` string. Pure, dependency-free ESM.
// ponytail: bbox over ALL coordinate pairs (anchors + bezier control points), a safe SUPERSET of the
// true curve bbox — fine for full-containment marquee selection (slightly conservative). Assumes
// ABSOLUTE commands (VTracer's default output); relative-command input would need a command walker.
export function pathBBox(d) {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = nums[i + 1];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  if (minX === Infinity) throw new Error("pathBBox: no coordinates in path data.");
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
