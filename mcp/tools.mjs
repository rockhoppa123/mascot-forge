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
import { rectsInMarquee } from "../tools/rig-editor/select.js";
import { bboxOf } from "../tools/rig-editor/pivot.js";
import { recipeFor } from "../tools/rig-editor/presets.js";
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

export function startFromImage({ base64, path, colors = 8, maxDim = 256 } = {}) {
  if (!base64 && !path) throw new Error("provide base64 or path (PNG)");
  const buf = base64 ? Buffer.from(base64, "base64") : readFileSync(safePath(path));
  const grid = downscale(decodePng(buf), maxDim);
  const flat = vectorizeRaster({ rgba: grid.rgba, w: grid.w, h: grid.h }, { colors });
  const seg = segment(flat.rects, { viewBoxSize: Math.max(grid.w, grid.h) });
  const model = parseSegmented(seg.svg);
  if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value); // evict oldest
  const session = "s" + nextId++;
  sessions.set(session, { model, vb: parseVB(model.viewBox()) });
  return {
    session, viewBox: model.viewBox(), parts: partList(model),
    note: "Parts are a coarse first pass. Coords in assign_region are 0..1 fractions of the viewBox — reassign by what you SEE in the image.",
  };
}

export function assignRegion({ session, box, partId, role } = {}) {
  const s = getSession(session);
  for (const k of ["x", "y", "w", "h"]) if (typeof box?.[k] !== "number") throw new Error("box needs numeric x,y,w,h in 0..1");
  const abs = { x: s.vb.x + box.x * s.vb.w, y: s.vb.y + box.y * s.vb.h, w: box.w * s.vb.w, h: box.h * s.vb.h };
  const ids = rectsInMarquee(s.model.rects(), abs);
  s.model.assign(ids, partId);
  if (role) s.model.setRole(partId, role);
  return { moved: ids.length, parts: partList(s.model) };
}

export function forgeEmit({ session, assetName = "mascot", outDir } = {}) {
  const { model } = getSession(session);
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
  const demo = emitDemoHtml(out.riggedJson, svg, assetName);
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

export const _sessions = sessions; // test introspection
