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
    elements.push({ id: `p${n++}`, x: bb.x, y: bb.y, w: bb.w, h: bb.h, markup, fill: attr(markup, "fill") || "#000000" });
  }
  return { viewBox, elements };
}
