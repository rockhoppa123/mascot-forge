// layer-ingest.js — turn a LAYERED vector SVG (Figma / Inkscape / Illustrator) into the editor model:
// each top-level <g> is a part, its drawable children are geometry-agnostic elements (ADR-0011). Part
// ids come from the layer name; geometry is carried as opaque `markup` + a cached `bbox`. Pure ESM.
//
// ponytail: a regex tokenizer for the flat/known-shape case (tests + simple exports). The browser
// (app.js) uses DOMParser + getBBox for real files — it handles messy whitespace and computes path
// bboxes — but reuses the naming/sanitize/dedupe + model assembly here so both paths agree.
// Known v1 limit: per-group/element transforms are not resolved (assume flat exports).
import { createModel } from "./model.js";
import { pathBBox } from "./path-bbox.js";

const DRAWABLE = "rect|path|circle|ellipse|polygon|polyline|line";
const GROUP_RE = /<g\b([^>]*)>([\s\S]*?)<\/g>/g;
const EL_RE = new RegExp(`<(${DRAWABLE})\\b([^>]*?)\\/?>`, "g");

const attr = (s, n) => { const m = s.match(new RegExp(`\\b${n}="([^"]*)"`)); return m ? m[1] : undefined; };
const inkLabel = (s) => { const m = s.match(/\binkscape:label="([^"]*)"/); return m ? m[1] : undefined; };

// A layer name -> a valid, unique part id ("Left Arm" -> "part-left-arm"). Dedupes with -2, -3 …
export function sanitizeId(name, used = new Set()) {
  let base = String(name == null ? "" : name).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!base) base = "part";
  if (!/^part(-|$)/.test(base)) base = `part-${base}`;
  let id = base, n = 2;
  while (used.has(id)) id = `${base}-${n++}`;
  used.add(id);
  return id;
}

function rectBBox(attrsStr) {
  return {
    x: Number(attr(attrsStr, "x") || 0), y: Number(attr(attrsStr, "y") || 0),
    w: Number(attr(attrsStr, "width") || 0), h: Number(attr(attrsStr, "height") || 0),
  };
}

// Pure parser for flat layered SVGs. Rect + path bbox are computed here (path via pathBBox); other
// non-rect shapes (circle/ellipse/…) leave bbox `null` for the browser to fill via getBBox.
export function parseLayered(svgText) {
  const svgOpen = svgText.match(/<svg\b[^>]*>/);
  const viewBox = (svgOpen && attr(svgOpen[0], "viewBox")) || "0 0 192 192";
  const statesAttr = svgOpen && attr(svgOpen[0], "data-states");
  const states = statesAttr ? statesAttr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const partsMeta = {};
  const used = new Set();
  const elements = [];
  let eid = 0, layerN = 0;
  GROUP_RE.lastIndex = 0;
  let g;
  while ((g = GROUP_RE.exec(svgText)) !== null) {
    const gAttrs = g[1], inner = g[2];
    const name = inkLabel(gAttrs) || attr(gAttrs, "id") || attr(gAttrs, "data-name") || `layer-${++layerN}`;
    const part = sanitizeId(name, used);
    const meta = partsMeta[part] || (partsMeta[part] = {});
    const role = attr(gAttrs, "data-role"); if (role) meta.role = role;
    const kind = attr(gAttrs, "data-kind"); if (kind) meta.kind = kind;
    const bone = attr(gAttrs, "data-bone"); if (bone) meta.bone = bone;
    const piv = attr(gAttrs, "data-pivot");
    if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const pm of gAttrs.matchAll(/\bdata-preset-([a-z]+)="([^"]*)"/g)) { (meta.presets || (meta.presets = {}))[pm[1]] = pm[2]; }
    EL_RE.lastIndex = 0;
    let m;
    while ((m = EL_RE.exec(inner)) !== null) {
      const tag = m[1], aStr = m[2];
      // rect bbox from attributes; path bbox from its `d` via pathBBox (premium named-path-layer
      // ingest, Phase 3 Task 0). Other non-rect shapes still defer to the browser's getBBox.
      const d = attr(aStr, "d");
      const bbox = tag === "rect" ? rectBBox(aStr) : (tag === "path" && d ? pathBBox(d) : null);
      elements.push({ id: `e${eid++}`, part, markup: m[0], bbox });
    }
  }
  return { viewBox, elements, parts: partsMeta, states };
}

export function toModel({ viewBox, elements, parts: meta = {}, states } = {}) {
  const parts = {};
  for (const el of elements) parts[el.part] = parts[el.part] || {};
  const model = createModel({ viewBox, rects: elements, parts, ...(states ? { states } : {}) });
  for (const [id, m] of Object.entries(meta)) {
    if (!(id in parts)) continue;
    if (m.role) model.setRole(id, m.role);
    if (m.kind) model.setKind(id, m.kind);
    if (m.bone) model.setBone(id, m.bone);
    if (m.pivot) model.setPivot(id, m.pivot);
    if (m.presets) for (const [st, name] of Object.entries(m.presets)) if (model.states().includes(st)) model.setPreset(st, id, name);
  }
  return model;
}

// text -> model. Rect bboxes are filled; any non-rect element still needs its bbox injected (via
// getBBox in the browser) before export — `parseLayered` leaves those null on purpose.
export function ingestLayered(svgText) {
  return toModel(parseLayered(svgText));
}
