// select.js — pure marquee hit-testing for the rig-editor canvas. Given a marquee box (x,y,w,h in
// viewBox coords) and the model's rects, return the ids of rects FULLY enclosed by the box.
//
// Policy: full containment, not partial overlap. A rect counts only if its whole AABB is inside the
// marquee, so a drag that merely clips a rect's edge won't grab it — predictable for peeling a
// colour-fused cluster out of a part. The box is normalised, so dragging up-left works the same as
// down-right. Dependency-free; node-testable (app.js only feeds it pointer coords).

export function rectsInMarquee(rects, box) {
  const x1 = Math.min(box.x, box.x + box.w);
  const y1 = Math.min(box.y, box.y + box.h);
  const x2 = Math.max(box.x, box.x + box.w);
  const y2 = Math.max(box.y, box.y + box.h);
  const ids = [];
  for (const r of rects) {
    if (r.x >= x1 && r.y >= y1 && r.x + r.w <= x2 && r.y + r.h <= y2) ids.push(r.id);
  }
  return ids;
}
