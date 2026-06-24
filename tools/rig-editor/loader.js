// loader.js — turn a `mf forge`-produced segmented.svg into the rect-granular editor model,
// and merge an asset's parts-spec.json vocabulary (D7 read side). Dependency-free ESM.
//
// ponytail: a small regex tokenizer over the KNOWN machine-generated segment-parts.ps1 shape
// (`<g data-part data-pivot fill>` wrapping `<rect x y width height fill/>`), not a general XML
// parser. It runs identically in node (tests) and the browser (no DOMParser dependency).
// Ceiling: assumes the segmenter's flat one-level group/rect output; if that emitter ever nests
// groups or emits non-rect geometry, swap this for DOMParser-based parsing in the browser layer.
import { createModel } from "./model.js";

const GROUP_RE = /<g\b([^>]*)\bdata-part="([^"]+)"([^>]*)>([\s\S]*?)<\/g>/g;
const RECT_RE = /<rect\b([^>]*?)\/?>/g;
const ATTR_RE = (name) => new RegExp(`\\b${name}="([^"]*)"`);

function attr(s, name) {
  const m = s.match(ATTR_RE(name));
  return m ? m[1] : undefined;
}

export function parseSegmented(svgText) {
  const svgOpen = svgText.match(/<svg\b[^>]*>/);
  const viewBox = (svgOpen && attr(svgOpen[0], "viewBox")) || "0 0 192 192";

  const rects = [];
  const parts = {};
  let n = 0;
  let g;
  GROUP_RE.lastIndex = 0;
  while ((g = GROUP_RE.exec(svgText)) !== null) {
    const groupAttrs = g[1] + g[3];
    const partId = g[2];
    const body = g[4];
    const pivotRaw = attr(groupAttrs, "data-pivot");
    const tintRaw = attr(groupAttrs, "data-tint");
    parts[partId] = { pivot: parsePivot(pivotRaw), ...(tintRaw ? { tint: tintRaw } : {}) };

    let r;
    RECT_RE.lastIndex = 0;
    while ((r = RECT_RE.exec(body)) !== null) {
      const a = r[1];
      rects.push({
        id: `r${n++}`,
        x: num(attr(a, "x")),
        y: num(attr(a, "y")),
        w: num(attr(a, "width")),
        h: num(attr(a, "height")),
        fill: attr(a, "fill") || "#000000",
        part: partId,
      });
    }
  }

  return createModel({ viewBox, rects, parts });
}

// D7 read side: a parts-spec.json declares candidate parts + bone hints. Merge bone onto any part
// that already exists and add vocabulary entries for declared parts that have no rects yet.
export function applyPartsSpec(model, spec) {
  if (!spec || !Array.isArray(spec.parts)) return model;
  for (const p of spec.parts) {
    if (!p || !p.id) continue;
    if (model.parts()[p.id]) {
      if (p.bone) model.setBone(p.id, p.bone);
    } else {
      // create an empty candidate part (no rects); assigning rects later fills it.
      model.assign([], p.id);
      if (p.bone) model.setBone(p.id, p.bone);
    }
  }
  return model;
}

function parsePivot(raw) {
  if (!raw) return null;
  const [x, y] = raw.split(",").map((v) => Number(v.trim()));
  if (Number.isNaN(x) || Number.isNaN(y)) return null;
  return { x, y };
}
function num(v) {
  return v === undefined ? 0 : Number(v);
}
