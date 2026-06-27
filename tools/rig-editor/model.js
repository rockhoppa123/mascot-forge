// model.js — rig-editor in-memory state at RECT granularity (D5), dependency-free ESM.
//
// Holds the editable rig: which part each <rect> belongs to, per-part metadata (role, bone,
// pivot, origin), and the per-state preset selection. Every op keeps the D6 invariant — a rect
// always belongs to exactly one part — so geometry can never be silently lost on export.
// Pure data + closures (mirrors runtime/mascot-state.js); no DOM, so it runs under `node`.

export const ROLES = ["core", "limb", "accent", "passive"];
export const KINDS = ["wheel", "flag", "limb", "eye", "mouth", "body", "accent"]; // optional subject overlay
export const BACKGROUND_PART = "part-background";
// The default rig vocabulary. SIGNAL_STATES are the opt-in app-signal states a rig can additionally
// declare at creation (they reuse alert/active motion via presets.js STATE_FAMILY).
export const SIMPLE_STATES = ["idle"]; // Simple tier: one looping animation, no state machine
export const STANDARD_STATES = ["idle", "active", "alert"];
export const SIGNAL_STATES = ["loading", "error", "success"];
const DEFAULT_STATES = STANDARD_STATES;

export function createModel({ viewBox = "0 0 192 192", rects = [], parts = {}, states = DEFAULT_STATES } = {}) {
  // rects: clone so callers can't mutate our store from underneath us.
  const rectList = rects.map((r) => ({ ...r }));
  const partMap = {};
  for (const [id, meta] of Object.entries(parts)) partMap[id] = normPart(id, meta);
  // selections: { state: { partId: presetName } }
  const selections = {};
  for (const s of states) selections[s] = {};

  function normPart(id, meta = {}) {
    return {
      id,
      role: meta.role && ROLES.includes(meta.role) ? meta.role : "passive",
      kind: meta.kind && KINDS.includes(meta.kind) ? meta.kind : null,
      bone: meta.bone || null,
      pivot: meta.pivot || null,
      origin: meta.origin || null,
      tint: meta.tint || null,
    };
  }
  function ensurePart(id) {
    if (!partMap[id]) partMap[id] = normPart(id);
    return partMap[id];
  }

  function partOf(rectId) {
    const r = rectList.find((x) => x.id === rectId);
    return r ? r.part : undefined;
  }
  function rectsOf(partId) {
    return rectList.filter((r) => r.part === partId);
  }

  function assign(rectIds, partId) {
    ensurePart(partId);
    const set = new Set(rectIds);
    for (const r of rectList) if (set.has(r.id)) r.part = partId;
  }

  function rename(oldId, newId) {
    if (oldId === newId) return;
    if (!partMap[oldId]) throw new Error(`rename: unknown part '${oldId}'.`);
    const meta = partMap[oldId];
    delete partMap[oldId];
    partMap[newId] = { ...meta, id: newId };
    for (const r of rectList) if (r.part === oldId) r.part = newId;
    for (const s of Object.keys(selections)) {
      if (selections[s][oldId] !== undefined) {
        selections[s][newId] = selections[s][oldId];
        delete selections[s][oldId];
      }
    }
  }

  function remove(partId) {
    if (partId === BACKGROUND_PART) return; // background is the floor; never removable
    ensurePart(BACKGROUND_PART);
    for (const r of rectList) if (r.part === partId) r.part = BACKGROUND_PART;
    delete partMap[partId];
    for (const s of Object.keys(selections)) delete selections[s][partId];
  }

  function setRole(partId, role) {
    if (!ROLES.includes(role)) throw new Error(`setRole: unknown role '${role}'.`);
    ensurePart(partId).role = role;
  }
  function setKind(partId, kind) {
    if (kind != null && !KINDS.includes(kind)) throw new Error(`setKind: unknown kind '${kind}'.`);
    ensurePart(partId).kind = kind || null; // null/"" clears the overlay
  }
  function setPivot(partId, pivot, origin) {
    const p = ensurePart(partId);
    p.pivot = { x: Number(pivot.x), y: Number(pivot.y) };
    if (origin !== undefined) p.origin = origin;
  }
  function setBone(partId, bone) {
    ensurePart(partId).bone = bone;
  }

  function setPreset(state, partId, presetName) {
    if (!selections[state]) throw new Error(`setPreset: unknown state '${state}'.`);
    if (presetName == null) delete selections[state][partId];
    else selections[state][partId] = presetName;
  }
  function preset(state, partId) {
    return selections[state] ? selections[state][partId] : undefined;
  }

  // Undo support (P4): a deep, serialisable copy of the full mutable state, and an in-place restore.
  // restore() mutates the SAME closures (no object swap) so existing references to this model stay
  // valid. viewBox/states are immutable, so they're not snapshotted. Pure data — node-testable.
  function snapshot() {
    return JSON.parse(JSON.stringify({ rects: rectList, parts: partMap, selections }));
  }
  function restore(snap) {
    rectList.length = 0;
    for (const r of snap.rects) rectList.push({ ...r });
    for (const k of Object.keys(partMap)) delete partMap[k];
    for (const [id, p] of Object.entries(snap.parts)) partMap[id] = { ...p };
    for (const s of Object.keys(selections)) for (const k of Object.keys(selections[s])) delete selections[s][k];
    for (const [s, sel] of Object.entries(snap.selections)) {
      if (!selections[s]) selections[s] = {};
      for (const [pid, name] of Object.entries(sel)) selections[s][pid] = name;
    }
  }

  function ungroupedRects() {
    return rectList.filter((r) => !r.part);
  }
  function everyRectGrouped() {
    return ungroupedRects().length === 0;
  }

  return {
    viewBox: () => viewBox,
    states: () => states.slice(),
    rects: () => rectList.map((r) => ({ ...r })),
    parts: () => {
      const out = {};
      for (const [id, p] of Object.entries(partMap)) out[id] = { ...p };
      return out;
    },
    selections: () => JSON.parse(JSON.stringify(selections)),
    partOf,
    rectsOf,
    assign,
    rename,
    remove,
    setRole,
    setKind,
    setPivot,
    setBone,
    setPreset,
    preset,
    snapshot,
    restore,
    ungroupedRects,
    everyRectGrouped,
  };
}
