// vectorize-vtracer.mjs — VTracer (path) vectoriser for the mcp/ integration layer. Wraps
// @neplex/vectorizer and parses its colour-clustered <path> SVG into geometry-agnostic model
// elements (ADR-0011: each element keeps its raw markup + a bbox for marquee selection + export).
// Integration-only dep; the zero-dep runtime and the JS scanline vectoriser are untouched.
import { vectorizeSync, ColorMode, Hierarchical, PathSimplifyMode } from "@neplex/vectorizer";
import { pathBBox } from "../tools/rig-editor/path-bbox.js";

const DEFAULTS = {
  colorMode: ColorMode.Color, colorPrecision: 6, filterSpeckle: 4,
  layerDifference: 16, cornerThreshold: 60, lengthThreshold: 4.0,
  maxIterations: 10, spliceThreshold: 45,
  hierarchical: Hierarchical.Stacked, mode: PathSimplifyMode.Spline, pathPrecision: 3,
};

export function vtracerSvg(pngBuffer, opts = {}) {
  return vectorizeSync(pngBuffer, { ...DEFAULTS, ...opts });
}

const attr = (s, name) => { const m = s.match(new RegExp(`\\b${name}="([^"]*)"`)); return m ? m[1] : undefined; };

// VTracer positions each shape with transform="translate(tx,ty)" and keeps `d` in LOCAL coords, so the
// true bbox is pathBBox(d) shifted by the translate. The markup keeps its transform (renders correctly);
// only the model bbox (used for marquee selection + pivots) needs the offset folded in. ponytail: handles
// translate only — VTracer emits no rotate/scale on these path layers.
function translateOf(markup) {
  const m = markup.match(/transform="translate\(\s*(-?\d*\.?\d+)(?:[,\s]+(-?\d*\.?\d+))?\s*\)"/);
  if (!m) return { tx: 0, ty: 0 };
  return { tx: Number(m[1]), ty: m[2] !== undefined ? Number(m[2]) : 0 };
}

export function elementsFromVtracerSvg(svgText) {
  const open = svgText.match(/<svg\b[^>]*>/);
  const viewBox = (open && attr(open[0], "viewBox")) ||
    (open && `0 0 ${attr(open[0], "width") || 0} ${attr(open[0], "height") || 0}`) || "0 0 0 0";
  const elements = [];
  const pathRe = /<path\b[^>]*?\/?>/g;
  let m, n = 0;
  while ((m = pathRe.exec(svgText)) !== null) {
    const markup = m[0];
    const d = attr(markup, "d");
    if (!d) continue;
    const bb = pathBBox(d);
    const { tx, ty } = translateOf(markup);
    elements.push({ id: `p${n++}`, x: bb.x + tx, y: bb.y + ty, w: bb.w, h: bb.h, markup, fill: attr(markup, "fill") || "#000000" });
  }
  return { viewBox, elements };
}
