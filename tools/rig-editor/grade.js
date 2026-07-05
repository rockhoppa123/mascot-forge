// grade.js — pre-flight input quality grade. Pure, dependency-free. A flat single-colour silhouette is
// the worst-case rigging input (can't auto-separate parts); a colour-distinct image rigs cleanly.
// Heuristic: distinct opaque fills + dominant-element area share. Shared by the MCP start + propose.
export function gradeInput(model) {
  const rects = model.rects();
  const fills = new Set(rects.map((r) => r.fill).filter(Boolean));
  const total = rects.reduce((a, r) => a + r.w * r.h, 0) || 1;
  const maxShare = rects.reduce((m, r) => Math.max(m, (r.w * r.h) / total), 0);
  // silhouette = too few COLOURS to separate. A dominant region alone is not a silhouette — with
  // 3+ fills the smaller colours still peel off cleanly (U2); that case falls to borderline below.
  if (fills.size <= 2) {
    return {
      grade: "silhouette",
      reason: `flat ${fills.size}-colour shape — nothing to separate`,
      recommendation: "parts can't be auto-separated — use a layered or multi-colour source, or it will animate as one body",
    };
  }
  // Colour-separable but anti-aliased/gradient source: smooth shading defeats the vectoriser's vertical
  // rect-merge, so the art comes back as a stack of ~1px strips. Flat pixel art merges into tall rects,
  // so a low mean rect height reliably flags "not flat". crispEdges now hides the seams, but thin
  // tapering features (a pointed tail, thin limbs) still shatter into detached slivers — warn first.
  const meanHeight = rects.length ? rects.reduce((a, r) => a + r.h, 0) / rects.length : 0;
  // ponytail: 2px threshold splits flat pixel art (tall merged rects) from gradient rasters (~1px
  // strips); 50-rect floor avoids tripping on tiny fixtures. Tune if a legit fine-detail sprite trips it.
  if (rects.length >= 50 && meanHeight < 2) {
    return {
      grade: "borderline",
      reason: `${fills.size} colours but heavily fragmented (mean rect height ${meanHeight.toFixed(1)}px) — a gradient/anti-aliased source, not flat pixel art`,
      recommendation: "edges will look rough and thin features (a tapered tail, thin limbs) may break into slivers — use flat hard-edged pixel art or a layered SVG for a clean rig",
    };
  }
  if (fills.size >= 4 && maxShare <= 0.8) {
    return { grade: "good", reason: `${fills.size} distinct colours, no single dominant region`, recommendation: "rig away — use the vtracer engine for smooth, small output" };
  }
  return { grade: "borderline", reason: `${fills.size} colours, largest region ${(maxShare * 100).toFixed(0)}%`, recommendation: "riggable but parts may be coarse; a more colour-distinct source rigs better" };
}
