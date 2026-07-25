// segment.js — flat rects → proposed named parts, the browser port of tools/segment-parts.ps1.
// Pure (no DOM): connected-component labeling over same-colour adjacent rects, geometry-based
// naming (body/legs/antenna/eyes, with an optional per-asset parts-spec vocab — ADR-0010), joint
// pivots, and sliver absorption so every rect lands in exactly one part (D6). Emits the SAME
// `<g data-part data-pivot fill>`/`<rect>` segmented-SVG shape `mf forge` produces, so the existing
// loader.parseSegmented() consumes it unchanged — PNG-upload and SVG-drop converge there.
//
// Deterministic, no ML (ADR-0002: the tool proposes, the editor is the human confirm step). The CCL
// union is O(n^2), guarded by maxRects.
import { defaultPivotFor } from "./pivot.js";

// Positional, not anatomical: without a parts-spec the segmenter knows WHERE a blob sits, never WHAT
// it is. Naming a ghost's head-top "part-antenna" invents anatomy and misleads the rigging agent.
const DEFAULT_VOCAB = ["part-body", "part-lower-left", "part-lower-right", "part-upper", "part-island-1", "part-island-2"];
const DEFAULT_TINT = {
  "part-body": "#c9ced1", "part-lower-left": "#ff7f0e", "part-lower-right": "#1f77b4",
  "part-upper": "#2ca02c", "part-island-1": "#d62728", "part-island-2": "#9467bd",
  "part-moustache": "#9467bd", "part-leg-left": "#ff7f0e", "part-leg-right": "#1f77b4",
  "part-antenna": "#2ca02c", "part-eyes": "#d62728",
};
const EXTRA_TINTS = ["#e377c2", "#7f7f7f", "#bcbd22", "#17becf", "#aec7e8", "#ffbb78"];

const fmtNum = (v) => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
};

// 8-connected: expand a by 1px and test overlap with b (MaxX/MaxY exclusive pixel boxes).
const adjacent = (a, b) =>
  a.minX - 1 < b.maxX && b.minX < a.maxX + 1 && a.minY - 1 < b.maxY && b.minY < a.maxY + 1;

export function segment(rectsIn, { viewBoxSize, spec = null, maxRects = 8000 } = {}) {
  if (!rectsIn || rectsIn.length === 0) throw new Error("segment: no rects to segment.");
  if (rectsIn.length > maxRects) {
    throw new Error(
      `segment: ${rectsIn.length} rects (> maxRects ${maxRects}). The CCL union is O(n^2); downscale ` +
      `the source further, or rig this asset via terminal 'mf forge'.`
    );
  }

  // per-asset spec: hint -> id mapping + a fixed vocab (ADR-0010); default keeps the heuristic ids.
  const hintToId = {};
  let vocab = DEFAULT_VOCAB;
  if (spec && Array.isArray(spec.parts)) {
    for (const p of spec.parts) if (p && p.hint) hintToId[p.hint] = p.id;
    vocab = spec.parts.map((p) => p.id);
  }
  const partId = (hint, fallback) => (hint in hintToId ? hintToId[hint] : fallback);
  const vbSize = viewBoxSize != null ? viewBoxSize : (spec && spec.viewBoxSize);
  if (vbSize == null) throw new Error("segment: viewBoxSize is required (no spec.viewBoxSize fallback).");

  // index rects with derived geometry
  const rects = rectsIn.map((r, id) => ({
    id, x: r.x, y: r.y, w: r.w, h: r.h, color: r.fill,
    minX: r.x, minY: r.y, maxX: r.x + r.w, maxY: r.y + r.h,
    area: r.w * r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2,
  }));
  const n = rects.length;

  // --- union-find: union same-colour 8-adjacent rects ---
  const parent = rects.map((_, i) => i);
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (rects[i].color === rects[j].color && adjacent(rects[i], rects[j])) union(i, j);

  // --- collapse rects into blobs (one per component) ---
  const blobMap = new Map();
  for (const r of rects) {
    const root = find(r.id);
    let bl = blobMap.get(root);
    if (!bl) {
      bl = { rects: [], minX: Infinity, minY: Infinity, maxX: -1, maxY: -1, area: 0, sumCX: 0, sumCY: 0, part: null };
      blobMap.set(root, bl);
    }
    bl.rects.push(r);
    bl.minX = Math.min(bl.minX, r.minX); bl.minY = Math.min(bl.minY, r.minY);
    bl.maxX = Math.max(bl.maxX, r.maxX); bl.maxY = Math.max(bl.maxY, r.maxY);
    bl.area += r.area; bl.sumCX += r.cx * r.area; bl.sumCY += r.cy * r.area;
  }
  const blobs = [...blobMap.values()].map((b) => ({ ...b, cenX: b.sumCX / b.area, cenY: b.sumCY / b.area }))
    .sort((a, b) => a.minY - b.minY || a.minX - b.minX); // stable identity, never hash-order

  // --- name parts by geometry (fixed-order deterministic rules) ---
  const body = blobs.slice().sort((a, b) => b.area - a.area || a.minY - b.minY || a.minX - b.minX)[0];
  body.part = partId("largest-blob", "part-body");
  const rest = blobs.filter((b) => b !== body);

  const legBlobs = rest.filter((b) => b.maxY > body.maxY).sort((a, b) => a.cenX - b.cenX);
  if (legBlobs.length >= 1) legBlobs[0].part = partId("below-body-left", "part-lower-left");
  if (legBlobs.length >= 2) legBlobs[legBlobs.length - 1].part = partId("below-body-right", "part-lower-right");

  for (const a of rest.filter((b) => b.part === null && b.minY < body.minY))
    a.part = partId("above-body", "part-upper");

  const bodyMidY = (body.minY + body.maxY) / 2;
  const eyeCandidates = rest.filter((b) =>
    b.part === null && b.cenY < bodyMidY &&
    b.minX >= body.minX && b.maxX <= body.maxX && b.minY >= body.minY && b.maxY <= body.maxY
  ).sort((a, b) => b.area - a.area || a.minY - b.minY || a.minX - b.minX);
  eyeCandidates.slice(0, 2).forEach((e, i) => { e.part = partId("colour-island-upper", `part-island-${i + 1}`); });

  // --- generic blob fallback (P-seg) ---
  // The geometry heuristic is overfit to one mascot silhouette: on arbitrary art every non-matching
  // blob gets absorbed into the body, collapsing the image to a single part (16/20 battery inputs).
  // When the heuristic named ONLY the body AND there are >=2 distinct blobs, give each blob its own
  // part (part-1..N, area desc) instead. This never fires once any leg/antenna/eye matched — so the
  // named-multi goldens (e.g. DevBrain → 5 parts) are unchanged. Only the default vocab triggers it;
  // a per-asset parts-spec opts out (its named vocab is authoritative).
  let fallbackVocab = null;
  const namedCount = blobs.filter((b) => b.part !== null).length;
  const onlyBodyNamed = namedCount === 1 && body.part === partId("largest-blob", "part-body");
  if (!spec && onlyBodyNamed && blobs.length >= 2) {
    const ordered = blobs.slice().sort((a, b) => b.area - a.area || a.minY - b.minY || a.minX - b.minX);
    fallbackVocab = ordered.map((_, i) => `part-${i + 1}`);
    ordered.forEach((b, i) => { b.part = fallbackVocab[i]; });
  }

  // --- absorb leftover slivers into the nearest named blob (prefer an adjacent one) ---
  const named = blobs.filter((b) => b.part !== null);
  for (const lo of blobs.filter((b) => b.part === null)) {
    const adj = named.filter((bn) => lo.rects.some((r) => bn.rects.some((br) => adjacent(r, br))));
    const pool = adj.length ? adj : named;
    const pick = pool.slice().sort((a, b) =>
      Math.hypot(a.cenX - lo.cenX, a.cenY - lo.cenY) - Math.hypot(b.cenX - lo.cenX, b.cenY - lo.cenY) ||
      a.minY - b.minY || a.minX - b.minX)[0];
    lo.part = pick.part;
    for (const r of lo.rects) pick.rects.push(r);
    pick.minX = Math.min(pick.minX, lo.minX); pick.minY = Math.min(pick.minY, lo.minY);
    pick.maxX = Math.max(pick.maxX, lo.maxX); pick.maxY = Math.max(pick.maxY, lo.maxY);
  }

  // --- merge blobs sharing a part id; compute the joint pivot ---
  const pivotOf = (id, list) => {
    const minX = Math.min(...list.map((r) => r.minX)), minY = Math.min(...list.map((r) => r.minY));
    const maxX = Math.max(...list.map((r) => r.maxX)), maxY = Math.max(...list.map((r) => r.maxY));
    const bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    if (/^part-leg-/.test(id)) return defaultPivotFor("limb", bbox);            // hip line (top-edge centre)
    if (id === "part-antenna") {                                                // base centre (bottom row)
      const bottom = list.filter((r) => r.maxY === maxY);
      const bMin = Math.min(...bottom.map((r) => r.minX)), bMax = Math.max(...bottom.map((r) => r.maxX));
      return { x: (bMin + bMax) / 2, y: maxY };
    }
    return defaultPivotFor("core", bbox);                                       // bbox centre
  };

  // fallback parts (part-1..N) aren't in the heuristic vocab; emit those ids instead when it fired.
  const outVocab = fallbackVocab || vocab;

  const tint = { ...DEFAULT_TINT };
  let ec = 0;
  for (const id of outVocab) if (!(id in tint)) tint[id] = EXTRA_TINTS[ec++ % EXTRA_TINTS.length];

  const parts = [];
  for (const id of outVocab) {
    const pieceRects = [];
    for (const bl of named) if (bl.part === id) pieceRects.push(...bl.rects);
    if (pieceRects.length === 0) continue;
    const piv = pivotOf(id, pieceRects);
    parts.push({ id, rects: pieceRects, pivot: piv, pivotStr: `${fmtNum(piv.x)},${fmtNum(piv.y)}` });
  }

  return { svg: emitSvg(parts, vbSize, tint), parts };
}

function emitSvg(parts, vbSize, tint) {
  // Per-rect fills carry the REAL image colour (r.color, set at line 50 from the vectorizer).
  // The diagnostic per-part tint survives as data-tint on each <g> for the browser editor to
  // colour-code part boundaries. Per-rect explicit fills override the group fill, so setting the
  // group fill to the tint is safe — but data-tint is the canonical tint carrier.
  const nl = "\n";
  let s = '<?xml version="1.0" encoding="UTF-8"?>' + nl;
  s += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbSize} ${vbSize}" width="${vbSize}" height="${vbSize}"` +
    ` data-render-method="ccl-color-threshold" data-parts="${parts.length}">` + nl;
  for (const p of parts) {
    s += `  <g data-part="${p.id}" data-pivot="${p.pivotStr}" data-tint="${tint[p.id]}">` + nl;
    for (const r of p.rects.slice().sort((a, b) => a.y - b.y || a.x - b.x))
      s += `    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}"/>` + nl;
    s += "  </g>" + nl;
  }
  s += '  <g data-role="pivot-markers" fill="none" stroke="#111" stroke-width="0.6">' + nl;
  for (const p of parts) s += `    <circle cx="${fmtNum(p.pivot.x)}" cy="${fmtNum(p.pivot.y)}" r="2.5"/>` + nl;
  s += "  </g>" + nl + "</svg>" + nl;
  return s;
}
