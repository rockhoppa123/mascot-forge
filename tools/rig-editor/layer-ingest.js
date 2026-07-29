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

// Subtrees that define rather than draw. Stripped once at the DOCUMENT level, before topLevelGroups
// picks layers — not per-layer — so a clip shape or a gradient stop can never be mistaken for art now
// that nesting flattens, AND a <g> sitting inside a ROOT-level <defs>/<clipPath> can never be chosen as
// a layer in the first place (in the browser it is never a child of <svg>, so it was never a layer
// there either — a per-layer strip ran after topLevelGroups had already picked it, too late). A
// self-closing instance (<clipPath id="empty"/>) is consumed on its own — otherwise a lazy
// `<tag>…</tag>` match would pair it with a LATER same-name close tag and swallow every real drawable
// in between (the self-closer has no partner of its own, so the regex would keep looking until it
// found one). A same-tag NEST (a <mask> inside a <mask>) ends the OUTER tag's match at the INNER tag's
// close — so the outer tag's own trailing content (after the inner </mask>, before the outer </mask>)
// is left unstripped and leaks into the node scan as real, phantom art; the browser (which never
// renders mask/clipPath/etc. content at all, nesting or not) does not see it — the two paths disagree
// on that input. No known exporter emits same-tag nesting, so this stays an honest, disclosed ceiling
// rather than a depth-aware scanner built against a defect nobody has reproduced from a real export.
const NON_RENDERED = /<(defs|clipPath|mask|symbol|pattern|marker)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/gi;

// SVG comments must be gone before NON_RENDERED runs, and before topLevelGroups sees the text at all —
// a comment can contain a `<g>`-shaped fragment (design notes, disabled markup) that the browser never
// renders (DOMParser drops comments before layer selection) but this text scanner would otherwise read
// as a real layer or non-rendered subtree. An unbalanced comment (e.g. `<!-- <g id="old"> -->`, whose
// `<g` never got its matching close before ` -->`) must not be allowed to leave a depth counter open
// either — stripping the whole comment span up front removes the stray `<g` before anything counts it.
const COMMENT_RE = /<!--[\s\S]*?-->/g;

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
  // Strip comments, then non-rendered (<defs>/<clipPath>/<mask>/…) subtrees ONCE, at the DOCUMENT
  // level — before topLevelGroups chooses which <g> elements are layers. Order matters: a comment can
  // contain what looks like a <defs> fragment, so it must go first. Doing this once, up front, replaces
  // the old per-layer strip entirely — a document-level strip already removes any non-rendered content
  // from INSIDE a chosen layer's inner text too, so a second, per-layer pass would just repeat work
  // already done. It also means a root-level <defs>/<clipPath> can never be selected as a layer, since
  // topLevelGroups never sees it.
  const scanText = svgText.replace(COMMENT_RE, "").replace(NON_RENDERED, "");

  // Read the root attrs from the STRIPPED text, not the raw source: a comment preceding the root
  // element may itself contain an `<svg …>` fragment (a commented-out wrapper, a banner quoting one),
  // and matching the raw text would take viewBox/data-states from the comment. DOMParser drops
  // comments before the browser path ever looks, so raw-text matching is exactly where the two paths
  // would silently disagree about the document's own coordinate system.
  const svgOpen = scanText.match(/<svg\b[^>]*>/);
  const viewBox = (svgOpen && attr(svgOpen[0], "viewBox")) || "0 0 192 192";
  const statesAttr = svgOpen && attr(svgOpen[0], "data-states");
  const states = statesAttr ? statesAttr.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  // U1: exporter output wraps the part groups in a single #rig-root group — descend one level so each
  // part <g> is a layer again (the editor's own export round-trips like any layered SVG). Same rule
  // the browser applies in app.js loadLayeredSvg.
  const top = topLevelGroups(scanText);
  const layers = (top.length === 1 && /\bid="rig-root"/.test(top[0].attrs)) ? topLevelGroups(top[0].inner) : top;

  // Names resolved up front so the transform refusal can report ALL offending layers in one pass.
  // The `layer-N` counter advances only for unnamed layers — matching the previous behaviour exactly.
  let layerN = 0;
  const names = layers.map((l) => inkLabel(l.attrs) || attr(l.attrs, "id") || attr(l.attrs, "data-name") || `layer-${++layerN}`);

  // `l.inner` is already free of comments and non-rendered subtrees (scanText was stripped before
  // topLevelGroups ran), so a transform living inside a <clipPath> — or in a root-level <defs> that
  // never became a layer at all — cannot trigger a refusal for art it never places.
  const offending = layers.map((l, i) => (HAS_TRANSFORM.test(l.attrs) || HAS_TRANSFORM.test(l.inner)) ? names[i] : null).filter(Boolean);
  if (offending.length) throw new Error(transformErrorMessage(offending));

  const partsMeta = {};
  const used = new Set();
  const elements = [];
  let eid = 0;
  for (let i = 0; i < layers.length; i++) {
    const gAttrs = layers[i].attrs, inner = layers[i].inner;
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
