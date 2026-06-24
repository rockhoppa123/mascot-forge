// exporter.js — serialise the editor model into the `mf emit` input pair:
//   <asset>-manual-part.svg  +  <asset>-rigged.json   (+ parts-spec.json write-back, D7)
// Dependency-free; pure (recipeFor is injected so this stays node-testable). Geometry is never
// lost: any rect with no part is routed to a passive `part-background` group (D6).
import { bboxOf, pivotToOrigin } from "./pivot.js";
import { BACKGROUND_PART } from "./model.js";

export function exportRig(model, opts = {}) {
  const { assetName = "mascot", recipeFor, source = null } = opts;
  const viewBox = model.viewBox();
  const states = model.states();

  // 1. effective rect membership — empty part -> background (never drop geometry, D6).
  const rects = model.rects().map((r) => ({ ...r, part: r.part || BACKGROUND_PART }));
  const hasBackground = rects.some((r) => r.part === BACKGROUND_PART);

  // 2. parts present in the output (have >=1 rect), background ordered last.
  const partMeta = model.parts();
  const partIds = Object.keys(partMeta).filter((id) => id !== BACKGROUND_PART && rects.some((r) => r.part === id));
  const orderedIds = [...partIds, ...(hasBackground ? [BACKGROUND_PART] : [])];

  // resolve per-part {bone, origin, pivot}, defaulting from the rect bbox where the user left blanks.
  const resolved = {};
  for (const id of orderedIds) {
    const meta = partMeta[id] || {};
    const bb = bboxOf(rects.filter((r) => r.part === id));
    const centre = { x: round(bb.x + bb.w / 2), y: round(bb.y + bb.h / 2) };
    let pivot = meta.pivot || centre;
    // guard: a stale pivot (a part re-carved smaller AFTER its pivot was set) can fall outside the
    // current bbox, producing a wild transform-origin (the 588% eyes bug). Reset to the bbox centre.
    // A 1px margin keeps legitimate edge pivots (e.g. a limb's top-edge hinge) intact.
    if (pivot.x < bb.x - 1 || pivot.x > bb.x + bb.w + 1 || pivot.y < bb.y - 1 || pivot.y > bb.y + bb.h + 1) pivot = centre;
    const origin = meta.origin || pivotToOrigin(pivot, bb);
    const bone = meta.bone || "root";
    resolved[id] = { id, bone, origin, pivot, role: meta.role || "passive" };
  }

  // 3. bones — a flat skeleton: root + one bone per distinct part bone (parent root, root first).
  const center = viewBoxCenter(viewBox);
  const bones = [{ name: "root", x: center.x, y: center.y }];
  const seen = new Set(["root"]);
  for (const id of orderedIds) {
    const b = resolved[id].bone;
    if (b && b !== "root" && !seen.has(b)) {
      seen.add(b);
      bones.push({ name: b, parent: "root", x: resolved[id].pivot.x, y: resolved[id].pivot.y });
    }
  }

  // 4. animations — turn each per-state preset selection into a concrete, part-stamped recipe.
  const selections = model.selections();
  const animations = {};
  for (const s of states) {
    animations[s] = [];
    const sel = selections[s] || {};
    for (const id of partIds) {
      const presetName = sel[id];
      if (!presetName) continue;
      if (typeof recipeFor !== "function") throw new Error("exportRig: opts.recipeFor is required to emit animations.");
      animations[s].push(recipeFor(resolved[id].role, s, presetName, id));
    }
  }

  // 5. rigged.json (schema v2).
  const riggedJson = {
    version: 2,
    source: source || { kind: "rig-editor", path: assetName, metadata: {} },
    states,
    bones,
    parts: orderedIds.map((id) => ({
      id,
      bone: resolved[id].bone,
      origin: resolved[id].origin,
      pivot: { x: round(num(resolved[id].pivot.x)), y: round(num(resolved[id].pivot.y)) },
    })),
    animations,
    accents: { impact: [] },
  };

  // 6. manual-part.svg.
  const manualSvg = serializeSvg({ assetName, viewBox, states, orderedIds, resolved, rects, opts });

  // 7. parts-spec.json write-back (D7) — final semantic part set + roles + bones (no background).
  const partsSpec = {
    assetName,
    parts: partIds.map((id) => ({ id, bone: resolved[id].bone, role: resolved[id].role })),
  };

  return { manualSvg, riggedJson, partsSpec, ungrouped: model.ungroupedRects() };
}

function serializeSvg({ assetName, viewBox, states, orderedIds, resolved, rects, opts }) {
  const renderMethod = opts.renderMethod || "ccl-color-threshold";
  const sourceBounds = opts.sourceBounds || boundsAttr(rects);
  const cssHref = opts.cssHref || `${assetName}-svg-css.css`;
  const lines = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<?xml-stylesheet type="text/css" href="${cssHref}"?>`);
  lines.push(
    `<svg id="mascot" data-state="${states[0]}" data-render-method="${renderMethod}" ` +
      `data-source-bounds="${sourceBounds}" xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" ` +
      `role="img" aria-labelledby="title desc">`
  );
  lines.push(`  <title id="title">${assetName} Manual Part SVG</title>`);
  lines.push(`  <desc id="desc">Rig-editor export: semantic rig parts for SVG and CSS animation.</desc>`);
  lines.push(`  <g id="rig-root">`);
  for (const id of orderedIds) {
    const r = resolved[id];
    lines.push(
      `    <g id="${id}" class="part" data-bone="${r.bone}" data-origin="${r.origin}" ` +
        `data-pivot-x="${round(r.pivot.x)}" data-pivot-y="${round(r.pivot.y)}">`
    );
    for (const el of rects.filter((x) => x.part === id)) {
      // ADR-0011: geometry-agnostic — emit the element's source markup if it carries any (paths,
      // circles, …); otherwise reconstruct the <rect> (rect inputs round-trip byte-identically).
      if (el.markup) lines.push(`      ${el.markup}`);
      else lines.push(`      <rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="${el.fill}"/>`);
    }
    lines.push(`    </g>`);
  }
  lines.push(`  </g>`);
  lines.push(`</svg>`);
  return lines.join("\n") + "\n";
}

function viewBoxCenter(viewBox) {
  const [minX, minY, w, h] = viewBox.split(/\s+/).map(Number);
  return { x: round(minX + w / 2), y: round(minY + h / 2) };
}
function boundsAttr(rects) {
  const bb = bboxOf(rects);
  return `${bb.x},${bb.y},${bb.x + bb.w},${bb.y + bb.h}`;
}
function round(n) {
  return Math.round(n * 100) / 100;
}
function num(v) {
  return Number(v);
}
