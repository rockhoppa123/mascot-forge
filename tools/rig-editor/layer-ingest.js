// layer-ingest.js — turn a LAYERED vector SVG (Figma / Inkscape / Illustrator) into the editor model:
// each top-level <g> is a part, its drawable children are geometry-agnostic elements (ADR-0011). Part
// ids come from the layer name; geometry is carried as opaque `markup` + a cached `bbox`. Pure ESM.
//
// ponytail: a regex tokenizer for the known-shape case (tests + real exports). The browser (app.js)
// uses DOMParser + getBBox for arbitrary files — it handles messy whitespace and computes path bboxes
// — but reuses the naming/sanitize/dedupe + model assembly here so both paths agree.
// Nested <g> FLATTENS: a top-level layer owns every drawable in its subtree, at any depth, except
// inside non-rendered subtrees (<defs>/<clipPath>/<mask>/…), which define rather than draw. Metadata
// (data-role/kind/bone/pivot/preset-*) is read from the TOP-LEVEL <g> only — a nested group
// contributes geometry, never a part of its own.
// Known v1 limit: transforms are not RESOLVED. Any `transform=` in a layer's subtree is refused by
// name rather than silently misplacing the art (getBBox reports own-user-space, and `markup` is
// re-parented away from its ancestors on export, so a dropped transform is invisibly wrong).
// A `>` inside an attribute VALUE still confuses this tokenizer — pre-existing, browser path is safe.
import { createModel } from "./model.js";
import { pathBBox } from "./path-bbox.js";

const DRAWABLE = "rect|path|circle|ellipse|polygon|polyline|line";
const G_TOKEN = /<g\b([^>]*?)(\/?)>|<\/g\s*>/g;
const EL_RE = new RegExp(`<(${DRAWABLE})\\b([^>]*?)\\/?>`, "g");

const attr = (s, n) => { const m = s.match(new RegExp(`\\b${n}="([^"]*)"`)); return m ? m[1] : undefined; };
const inkLabel = (s) => { const m = s.match(/\binkscape:label="([^"]*)"/); return m ? m[1] : undefined; };

// The TOP-LEVEL <g> layers, each with its COMPLETE subtree. A non-greedy `<g>…</g>` regex ends the
// outer group at the first inner </g> and so silently drops the outer group's own geometry (audit
// I3) — tracking depth instead fixes that, and flattening falls out for free: EL_RE below scans the
// whole subtree, so a drawable at any depth joins this layer's part. Metadata is still read from the
// top-level attrs only, so a nested group can never become a part.
export function topLevelGroups(svgText) {
  const out = [];
  let depth = 0, start = -1, attrs = "";
  let m;
  G_TOKEN.lastIndex = 0;
  while ((m = G_TOKEN.exec(svgText)) !== null) {
    if (m[0][1] === "/") {                       // </g>
      if (depth === 0) continue;                 // stray close — clamp, don't throw on a counter
      if (--depth === 0) out.push({ attrs, inner: svgText.slice(start, m.index) });
      continue;
    }
    if (m[2] === "/") continue;                  // <g/> — self-closing, carries no geometry
    if (depth === 0) { attrs = m[1]; start = G_TOKEN.lastIndex; }
    depth++;
  }
  return out;
}

// Shared wording for both ingest paths. The DETECTION differs (text regex here, hasAttribute/
// querySelector in app.js's DOM path) — abstracting over that would cost more than it saves — but a
// user must never read two different explanations of the same refusal, so the message has one home.
export function transformErrorMessage(layerNames) {
  const list = layerNames.map((n) => `"${n}"`).join(", ");
  return `layer(s) ${list} carry a transform — layered ingest does not resolve transforms, so those `
    + `shapes would be placed incorrectly. Flatten or ungroup them before export `
    + `(Figma: right-click → Flatten selection; Illustrator: Object → Expand).`;
}

// ponytail: transforms are DETECTED, not resolved. Upgrade path if real exports make this the
// dominant first-run failure: compose ancestor translate(tx,ty) into the cached bbox and wrap the
// element in `<g transform="translate(…)">` — exporter.js emits `markup` verbatim, so the wrapper
// survives. Rotate/scale/matrix would still refuse. Not built without evidence it's needed.
const HAS_TRANSFORM = /(^|\s)transform\s*=/;   // anchored on a boundary so gradientTransform is not a match

// Subtrees that define rather than draw. Stripped before scanning a layer, so a clip shape or a
// gradient stop can never be mistaken for art now that nesting flattens. Non-greedy, so a same-tag
// nest (a <mask> inside a <mask>) would end early — SVG exporters do not emit that.
const NON_RENDERED = /<(defs|clipPath|mask|symbol|pattern|marker)\b[\s\S]*?<\/\1>/gi;

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

  // U1: exporter output wraps the part groups in a single #rig-root group — descend one level so each
  // part <g> is a layer again (the editor's own export round-trips like any layered SVG). Same rule
  // the browser applies in app.js loadLayeredSvg.
  const top = topLevelGroups(svgText);
  const layers = (top.length === 1 && /\bid="rig-root"/.test(top[0].attrs)) ? topLevelGroups(top[0].inner) : top;

  // Names resolved up front so the transform refusal can report ALL offending layers in one pass.
  // The `layer-N` counter advances only for unnamed layers — matching the previous behaviour exactly.
  let layerN = 0;
  const names = layers.map((l) => inkLabel(l.attrs) || attr(l.attrs, "id") || attr(l.attrs, "data-name") || `layer-${++layerN}`);

  // Strip non-rendered subtrees ONCE, then use the result for both the transform check and the element
  // scan — so a transform living inside a <clipPath> cannot trigger a refusal for art it never places.
  const bodies = layers.map((l) => l.inner.replace(NON_RENDERED, ""));

  const offending = layers.map((l, i) => (HAS_TRANSFORM.test(l.attrs) || HAS_TRANSFORM.test(bodies[i])) ? names[i] : null).filter(Boolean);
  if (offending.length) throw new Error(transformErrorMessage(offending));

  const partsMeta = {};
  const used = new Set();
  const elements = [];
  let eid = 0;
  for (let i = 0; i < layers.length; i++) {
    const gAttrs = layers[i].attrs, inner = bodies[i];
    const part = sanitizeId(names[i], used);
    const meta = partsMeta[part] || (partsMeta[part] = {});
    const role = attr(gAttrs, "data-role"); if (role) meta.role = role;
    const kind = attr(gAttrs, "data-kind"); if (kind) meta.kind = kind;
    const bone = attr(gAttrs, "data-bone"); if (bone) meta.bone = bone;
    const piv = attr(gAttrs, "data-pivot");
    if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const pm of gAttrs.matchAll(/\bdata-preset-([a-z0-9-]+?)="([^"]*)"/g)) { (meta.presets || (meta.presets = {}))[pm[1]] = pm[2]; }
    EL_RE.lastIndex = 0;
    let m;
    while ((m = EL_RE.exec(inner)) !== null) {
      const tag = m[1], aStr = m[2];
      // rect bbox from attributes; path bbox from its `d` via pathBBox. Other non-rect shapes still
      // defer to the browser's getBBox.
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
