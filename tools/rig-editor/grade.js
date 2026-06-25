// grade.js — pre-flight input quality grade. Pure, dependency-free. A flat single-colour silhouette is
// the worst-case rigging input (can't auto-separate parts); a colour-distinct image rigs cleanly.
// Heuristic: distinct opaque fills + dominant-element area share. Shared by the MCP start + propose.
export function gradeInput(model) {
  const rects = model.rects();
  const fills = new Set(rects.map((r) => r.fill).filter(Boolean));
  const total = rects.reduce((a, r) => a + r.w * r.h, 0) || 1;
  const maxShare = rects.reduce((m, r) => Math.max(m, (r.w * r.h) / total), 0);
  if (fills.size <= 2 || maxShare > 0.8) {
    return {
      grade: "silhouette",
      reason: `flat ${fills.size}-colour shape; one region is ${(maxShare * 100).toFixed(0)}% of the art`,
      recommendation: "parts can't be auto-separated — use a layered or multi-colour source, or it will animate as one body",
    };
  }
  if (fills.size >= 4 && maxShare <= 0.8) {
    return { grade: "good", reason: `${fills.size} distinct colours, no single dominant region`, recommendation: "rig away — use the vtracer engine for smooth, small output" };
  }
  return { grade: "borderline", reason: `${fills.size} colours, largest region ${(maxShare * 100).toFixed(0)}%`, recommendation: "riggable but parts may be coarse; a more colour-distinct source rigs better" };
}
