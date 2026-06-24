// tools.mjs — the mascot-forge MCP tool handlers (M1: start_from_image, assign_region, emit).
// Pure-ish: a session store over the SAME node-tested modules the browser editor uses. server.mjs wires
// these to the MCP SDK; tools.test.mjs drives them directly (agent simulation), so the chain is provable
// without a live agent. Runtime artifact stays zero-dep; this package's deps (pngjs) are integration-only.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { vectorizeRaster } from "../tools/rig-editor/vectorize.js";
import { segment } from "../tools/rig-editor/segment.js";
import { parseSegmented } from "../tools/rig-editor/loader.js";
import { vtracerSvg, elementsFromVtracerSvg } from "./vectorize-vtracer.mjs";
import { createModel } from "../tools/rig-editor/model.js";
import { parseLayered, toModel } from "../tools/rig-editor/layer-ingest.js";
import { rectsInMarquee } from "../tools/rig-editor/select.js";
import { bboxOf, defaultPivotFor } from "../tools/rig-editor/pivot.js";
import { recipeFor, presetsFor } from "../tools/rig-editor/presets.js";
import { validate } from "../tools/rig-editor/validator.js";
import { exportRig } from "../tools/rig-editor/exporter.js";
import { emitAnimatedSvg, emitDemoHtml } from "../tools/rig-editor/emit.js";

const PROJECT_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sessions = new Map();      // id -> { model, vb }
let nextId = 1;
const MAX_SESSIONS = 20;         // simple cap so a long-lived server can't leak

// roles alone yield a valid animated rig (M1): each role gets a default preset in its natural state.
const DEFAULT_PRESET = { core: ["idle", "breathe"], limb: ["active", "walk"], accent: ["alert", "pulse"] };

function getSession(id) {
  const s = sessions.get(id);
  if (!s) throw new Error(`unknown session '${id}'`);
  return s;
}
// enforce a stable part- prefix so agent-chosen ids can't collide (e.g. "body" vs "part-body").
function normPartId(id) {
  return typeof id === "string" && id && !id.startsWith("part-") ? `part-${id}` : id;
}
function parseVB(s) { const [x, y, w, h] = s.split(/\s+/).map(Number); return { x, y, w, h }; }
function partList(model) {
  return Object.keys(model.parts())
    .filter((id) => model.rectsOf(id).length > 0)
    .map((id) => ({ id, role: model.parts()[id].role, rectCount: model.rectsOf(id).length, bbox: bboxOf(model.rectsOf(id)) }));
}
function hasPreset(model, id) {
  const sel = model.selections();
  return model.states().some((st) => sel[st] && sel[st][id]);
}

// rigStatus: per-state preset coverage + how many parts animate at all, over rect-bearing parts.
function rigStatus(model) {
  const sel = model.selections();
  const ids = Object.keys(model.parts()).filter((id) => model.rectsOf(id).length > 0);
  const status = { total: ids.length, animated: 0 };
  for (const st of model.states()) status[st] = ids.filter((id) => sel[st] && sel[st][id]).length;
  status.animated = ids.filter((id) => model.states().some((st) => sel[st] && sel[st][id])).length;
  return status;
}
// reject paths outside the project (no arbitrary fs)
function safePath(p) {
  const r = resolve(p);
  if (r !== PROJECT_ROOT && !r.startsWith(PROJECT_ROOT + sep)) throw new Error(`path outside project root: ${p}`);
  return r;
}

function decodePng(buf) {
  const png = PNG.sync.read(buf);
  return { rgba: png.data, w: png.width, h: png.height };
}
function downscale({ rgba, w, h }, maxDim) {
  const scale = Math.min(1, maxDim / Math.max(w, h));
  if (scale >= 1) return { rgba, w, h };
  const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
  const out = new Uint8ClampedArray(nw * nh * 4);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const sx = Math.min(w - 1, Math.floor(x / scale)), sy = Math.min(h - 1, Math.floor(y / scale));
    const si = (sy * w + sx) * 4, di = (y * nw + x) * 4;
    out[di] = rgba[si]; out[di + 1] = rgba[si + 1]; out[di + 2] = rgba[si + 2]; out[di + 3] = rgba[si + 3];
  }
  return { rgba: out, w: nw, h: nh };
}

// --- TOOLS ---------------------------------------------------------------------------------------

export function startFromImage({ base64, path, colors = 8, maxDim = 256, engine = "scanline" } = {}) {
  if (!base64 && !path) throw new Error("provide base64 or path (PNG)");
  const buf = base64 ? Buffer.from(base64, "base64") : readFileSync(safePath(path));

  let model;
  if (engine === "vtracer") {
    // path-based: VTracer -> geometry-agnostic elements -> one passive part the agent re-assigns.
    const { viewBox, elements } = elementsFromVtracerSvg(vtracerSvg(buf, { colorPrecision: Math.max(1, Math.round(Math.log2(colors))) }));
    const rects = elements.map((e) => ({ ...e, part: "part-body" }));
    model = createModel({ viewBox, rects, parts: { "part-body": { role: "core" } } });
  } else {
    const grid = downscale(decodePng(buf), maxDim);
    const flat = vectorizeRaster({ rgba: grid.rgba, w: grid.w, h: grid.h }, { colors });
    const seg = segment(flat.rects, { viewBoxSize: Math.max(grid.w, grid.h) });
    model = parseSegmented(seg.svg);
  }

  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value); // evict oldest
  const session = "s" + nextId++;
  // keep the source PNG as a data URI so the demo page can show it beside the animated mascot.
  const sourceDataUri = `data:image/png;base64,${base64 || buf.toString("base64")}`;
  sessions.set(session, { model, vb: parseVB(model.viewBox()), sourceDataUri });
  return {
    session, viewBox: model.viewBox(), parts: partList(model),
    note: "Parts are a coarse first pass. Coords in assign_region are 0..1 fractions of the viewBox — reassign by what you SEE in the image. Pick presets by anatomy: ears/antennae -> twitch, tail -> wag, eyes -> blink. Part ids are auto-prefixed with 'part-'.",
  };
}

// Alt entry (M3): a LAYERED vector SVG the agent traced/exported (Figma/Inkscape/Illustrator) — each
// top-level <g> becomes a named part from its layer name, no segmentation needed. v1 is rect-bearing
// only: a non-rect element (path/circle/…) needs a node rasterizer to compute its bbox (deferred), so
// we reject it with a clear message rather than emit broken geometry. The agent then set_part + emit.
export function startFromLayeredSvg({ svg, path } = {}) {
  if (!svg && !path) throw new Error("provide svg (string) or path (.svg)");
  const text = svg ? svg : readFileSync(safePath(path), "utf8");
  const { viewBox, elements } = parseLayered(text);
  if (!elements.length) throw new Error("no drawable shapes found — need top-level <g> layers containing shapes");
  const noBox = elements.filter((e) => !e.bbox);
  if (noBox.length) {
    throw new Error(
      `layered ingest handles rect + path layers; ${noBox.length} element(s) are circle/ellipse/polygon ` +
      `which need a node rasterizer (deferred). Rig this in the browser editor, or trace to paths/rects.`
    );
  }
  const model = toModel({ viewBox, elements });
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value); // evict oldest
  const session = "s" + nextId++;
  sessions.set(session, { model, vb: parseVB(model.viewBox()) });
  return {
    session, viewBox: model.viewBox(), parts: partList(model),
    note: "Parts come from the SVG layer names. Set roles/presets with set_part (per state), then forge_emit.",
  };
}

export function assignRegion({ session, box, partId, role } = {}) {
  const s = getSession(session);
  for (const k of ["x", "y", "w", "h"]) if (typeof box?.[k] !== "number") throw new Error("box needs numeric x,y,w,h in 0..1");
  const abs = { x: s.vb.x + box.x * s.vb.w, y: s.vb.y + box.y * s.vb.h, w: box.w * s.vb.w, h: box.h * s.vb.h };
  const ids = rectsInMarquee(s.model.rects(), abs);
  partId = normPartId(partId);
  s.model.assign(ids, partId);
  if (role) s.model.setRole(partId, role);
  const res = { moved: ids.length, parts: partList(s.model) };
  // a region that grabs nothing yields an empty part that silently drops from the export — surface it
  // so the agent re-aims instead of shipping a missing limb. (marquee is full-containment, ADR select.js)
  if (ids.length === 0) res.warning = `region for '${partId}' grabbed 0 rects — box may miss the art or be too tight (marquee needs full rect containment); widen or move it`;
  return res;
}

export function forgeEmit({ session, assetName = "mascot", outDir } = {}) {
  const { model, sourceDataUri } = getSession(session);
  // auto-fill a default preset per role so roles alone produce a valid animated rig (M1)
  for (const id of Object.keys(model.parts())) {
    if (!model.rectsOf(id).length) continue;
    const def = DEFAULT_PRESET[model.parts()[id].role];
    if (def && !hasPreset(model, id)) model.setPreset(def[0], id, def[1]);
  }
  let out;
  try { out = exportRig(model, { assetName, recipeFor }); }
  catch (e) { return { ok: false, error: e.message }; }
  const v = validate(out.riggedJson);
  if (!v.ok) return { ok: false, validation: v };
  const svg = emitAnimatedSvg(out.riggedJson, out.manualSvg);
  const demo = emitDemoHtml(out.riggedJson, svg, assetName, sourceDataUri);
  if (outDir) {
    const dir = safePath(outDir); mkdirSync(dir, { recursive: true });
    const files = [
      [join(dir, `${assetName}-mascot.svg`), svg],
      [join(dir, `${assetName}-mascot-demo.html`), demo],
    ];
    for (const [f, c] of files) writeFileSync(f, c);
    return { ok: true, validation: v, written: files.map(([f]) => f) };
  }
  return { ok: true, validation: v, svgBytes: svg.length, demoBytes: demo.length };
}

// set a part's motion metadata in one call (M2): role, bone, pivot (0..1), presets per state.
export function setPart({ session, partId, role, bone, pivot, presets } = {}) {
  const s = getSession(session);
  if (!partId) throw new Error("partId is required");
  partId = normPartId(partId);
  const model = s.model;
  if (!(partId in model.parts()) && model.rectsOf(partId).length === 0) {
    throw new Error(`unknown part '${partId}' (assign_region it first)`);
  }

  if (role !== undefined) {
    model.setRole(partId, role); // throws on an unknown role
    // bug-#1 fix: clear any preset that is no longer valid for the new role.
    const sel = model.selections();
    for (const st of model.states()) {
      const chosen = sel[st] && sel[st][partId];
      if (chosen && !presetsFor(role, st).includes(chosen)) model.setPreset(st, partId, null);
    }
  }
  if (bone !== undefined) model.setBone(partId, bone);

  const effectiveRole = model.parts()[partId].role;
  const bb = bboxOf(model.rectsOf(partId));
  if (pivot !== undefined) {
    for (const k of ["x", "y"]) if (typeof pivot?.[k] !== "number") throw new Error("pivot needs numeric x,y in 0..1");
    model.setPivot(partId, { x: s.vb.x + pivot.x * s.vb.w, y: s.vb.y + pivot.y * s.vb.h });
  } else if (!model.parts()[partId].pivot) {
    model.setPivot(partId, defaultPivotFor(effectiveRole, bb)); // shared role-aware default
  }

  if (presets) {
    for (const [st, name] of Object.entries(presets)) {
      if (name == null) { model.setPreset(st, partId, null); continue; }
      if (!model.states().includes(st)) throw new Error(`unknown state '${st}'`);
      if (!presetsFor(effectiveRole, st).includes(name)) {
        throw new Error(`preset '${name}' is not valid for role '${effectiveRole}' in state '${st}' ` +
          `(valid: ${presetsFor(effectiveRole, st).join(", ") || "none"})`);
      }
      model.setPreset(st, partId, name);
    }
  }

  const m = model.parts()[partId];
  return {
    part: { id: partId, role: m.role, bone: m.bone, pivot: m.pivot, rectCount: model.rectsOf(partId).length, bbox: bb },
    rigStatus: rigStatus(model),
  };
}

// inspect progress (M2): the parts, per-state animation coverage, and any still-ungrouped rects.
export function forgeStatus({ session } = {}) {
  const { model } = getSession(session);
  return { parts: partList(model), rigStatus: rigStatus(model), ungroupedRects: model.ungroupedRects().length };
}

export const _sessions = sessions; // test introspection
