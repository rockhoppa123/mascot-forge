// app.js — browser glue for the rig editor. Wires the tested core modules (model, loader, pivot,
// presets, validator, exporter) to a minimal DOM. The pure logic lives in those modules and is
// node-tested; this file is unverified UI glue, deliberately small.
//
// Part ops: rename/role/pivot/preset/merge/remove (part-level) plus drag-marquee rect-level SPLIT
// (peel colour-fused rects — e.g. land-rover wheels stuck in part-body — into their own part via
// model.assign). Geometry/selection logic is in the node-tested modules; this stays thin glue.
import { createModel, ROLES, BACKGROUND_PART, STANDARD_STATES, SIGNAL_STATES } from "./model.js";
import { parseSegmented, applyPartsSpec } from "./loader.js";
import { bboxOf, dragToPivot, pivotToOrigin, defaultPivotFor } from "./pivot.js";
import { presetsFor, recipeFor, kindDefaultPreset } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";
import { rectsInMarquee } from "./select.js";
import { vectorizeRaster } from "./vectorize.js";
import { segment } from "./segment.js";
import { sanitizeId, toModel } from "./layer-ingest.js";
import { emitCss, emitAnimatedSvg, emitDemoHtml } from "./emit.js";

const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

let model = null;
let assetName = "mascot";
let selected = null;        // selected part id
let pivotMode = false;      // next canvas click places the selected part's pivot
let rectSel = [];           // marquee rect-selection (rect ids) pending a split/move
let clickMode = null;       // null | "paint" | "erase" — per-shape reassignment by clicking
const colours = new Map();  // partId -> hsl colour

// Undo (P4): snapshot the model BEFORE each mutating op; Ctrl+Z pops + restores. Capped so a long
// session can't grow without bound. Cleared on load (a fresh model has no history).
const undoStack = [];
const UNDO_CAP = 50;
function pushUndo() {
  if (!model) return;
  undoStack.push(model.snapshot());
  if (undoStack.length > UNDO_CAP) undoStack.shift();
}
// Re-render the whole view after an in-place model.restore() (selection may no longer exist).
function refreshModelView() {
  render();
  renderParts();
  if (selected && model.parts()[selected]) selectPart(selected);
  else { selected = null; $("partedit").hidden = true; }
  regenCss();
  updateBanner();
}

// ---------- load -------------------------------------------------------------------------------
function paletteFor(ids) {
  colours.clear();
  ids.forEach((id, i) => colours.set(id, `hsl(${(i * 67) % 360} 70% 55%)`));
}

function loadText(text, name, states) {
  assetName = (name || "mascot").replace(/-segmented\.svg$/i, "").replace(/\.svg$/i, "");
  model = parseSegmented(text, { states }); // states optional — declares the rig vocabulary up front
  showModel(`Loaded ${model.rects().length} rects, ${visibleParts().length} proposed parts.`);
}

// Reveal the editor chrome and draw the current `model`. Shared by every loader.
function showModel(msg) {
  selected = null;
  pivotMode = false;
  rectSel = [];
  undoStack.length = 0;      // a freshly loaded model starts with no undo history
  $("dropzone").hidden = true;
  $("stagewrap").hidden = false;
  $("states").hidden = false;
  $("panel").hidden = false;
  $("exportbar").hidden = false;
  renderStateControls();
  render();
  renderParts();
  regenCss();
  updateBanner();
  status(msg);
}

// ---------- onboarding helpers -----------------------------------------------------------------
// After a load, if few parts were detected, tell the user auto-detect is a starting point and how to
// split — the single most-missed step (council 2026-06-22).
function updateBanner() {
  const b = $("banner");
  const n = visibleParts().length;
  if (n <= 3) {
    b.innerHTML = `Auto-detect found <strong>${n}</strong> part(s). If parts look fused, ` +
      `<strong>drag a box</strong> over a region on the canvas, then press <em>move</em> to split it ` +
      `into its own part. <button id="banner-x" type="button">got it</button>`;
    b.hidden = false;
    $("banner-x").onclick = () => { b.hidden = true; };
  } else {
    b.hidden = true;
  }
}

function setState(s) {
  $("stage").setAttribute("data-state", s);
  $("states").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x.dataset.state === s));
}

// Render the preview-state buttons and the per-state preset pickers from the rig's DECLARED vocabulary
// (model.states()) rather than a hardcoded idle/active/alert trio — so a rig declaring loading/error/
// success shows those controls. Re-run on every load. states()[0] is the resting state (selected first).
function renderStateControls() {
  const row = $("states-row");
  row.replaceChildren();
  const resting = model.states()[0];
  for (const s of model.states()) {
    const b = document.createElement("button");
    b.dataset.state = s;
    b.textContent = s;
    row.appendChild(b);
    if (s !== resting) { // every non-resting state can be removed
      const x = document.createElement("button");
      x.className = "rmstate"; x.dataset.rmstate = s; x.textContent = "×"; x.title = `remove ${s}`;
      row.appendChild(x);
    }
  }
  // "+ add state": offer the standard trio + signal states not yet declared
  const addSel = $("addstate");
  addSel.replaceChildren(new Option("+ add state", ""));
  for (const s of [...STANDARD_STATES, ...SIGNAL_STATES].filter((s) => !model.states().includes(s))) addSel.appendChild(new Option(s, s));
  addSel.onchange = (e) => { const s = e.target.value; if (s) { pushUndo(); model.addState(s); renderStateControls(); regenCss(); } };
  const pk = $("preset-pickers");
  pk.replaceChildren();
  for (const s of model.states()) {
    const label = document.createElement("label");
    label.append(s + " ");
    const sel = document.createElement("select");
    sel.id = `preset-${s}`;
    sel.onchange = (e) => { if (selected) { pushUndo(); model.setPreset(s, selected, e.target.value || null); regenCss(); } };
    label.appendChild(sel);
    pk.appendChild(label);
  }
  setState(model.states()[0]);
}

// Always-visible rig health: which states have a valid animation, and how many parts animate.
// Surfaces export blockers live instead of only at export time (UX playthrough finding #2).
function updateRigStatus() {
  const el = $("rigstatus");
  if (!model || !el) return;
  const sel = model.selections();
  const parts = model.parts();
  const valid = (pid, s, name) => name && presetsFor((parts[pid] || {}).role || "passive", s).includes(name);
  const animated = new Set();
  const badges = model.states().map((s) => {
    let ok = false;
    for (const [pid, name] of Object.entries(sel[s] || {})) if (valid(pid, s, name)) { ok = true; animated.add(pid); }
    return `<span class="${ok ? "ok" : "bad"}">${s} ${ok ? "✓" : "✗"}</span>`;
  }).join(" ");
  el.innerHTML = `${badges} · ${animated.size}/${visibleParts().length} animated`;
}

const EXAMPLE_PLAN = [
  ["part-body", "body", "core", "idle", "breathe"],
  ["part-eyes", "eyes", "accent", "idle", "blink"],
  ["part-leg-left", "leg_left", "limb", "active", "walk"],
  ["part-leg-right", "leg_right", "limb", "active", "walk-mirror"],
  ["part-antenna", "antenna", "accent", "alert", "pulse"],
];

// One-click payoff: load the committed DevBrain segmented.svg and apply a known-good rig so a finished,
// animated, data-reactive mascot appears with zero decisions — "what good looks like."
async function loadExample() {
  try {
    const res = await fetch("../../docs/buildable-slice/generated/devbrain-segmented.svg");
    if (!res.ok) throw new Error("example asset not found — serve from the repo root");
    loadText(await res.text(), "devbrain");
    for (const [id, bone, role, state, preset] of EXAMPLE_PLAN) {
      if (!model.parts()[id]) continue;
      model.setRole(id, role); model.setBone(id, bone); model.setPreset(state, id, preset);
    }
    regenCss();
    setState("active");
    status("Example rigged — DevBrain is walking (active state). This is a finished rig; now load your own art.");
  } catch (e) { status("✗ " + (e && e.message ? e.message : e)); }
}
$("loadexample").onclick = loadExample;
$("placepivot").onclick = () => {
  if (!selected) { status("Select a part first, then place its pivot."); return; }
  pivotMode = true;
  status("Pivot mode: click the canvas to place the pivot.");
};

function nodeFromMarkup(markup) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVGNS}">${markup}</svg>`, "image/svg+xml");
  return doc.documentElement.firstElementChild;
}

// ADR-0011: ingest a LAYERED vector SVG (Figma/Inkscape/Illustrator) — each top-level <g> is a part,
// its drawable children are geometry-agnostic elements. getBBox needs the nodes rendered, so we parse
// to a hidden offscreen SVG, measure, then build the model (the naming/assembly is shared with the
// node-tested layer-ingest module).
function loadLayeredSvg(svgText, name) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) { status("Could not parse that SVG."); return; }
  const svgEl = doc.documentElement;
  const viewBox = svgEl.getAttribute("viewBox") || `0 0 ${svgEl.getAttribute("width") || 192} ${svgEl.getAttribute("height") || 192}`;
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden";
  wrap.appendChild(svgEl);
  document.body.appendChild(wrap);

  const DRAW = "rect,path,circle,ellipse,polygon,polyline,line";
  // self-describing handoff rig: root data-states + per-group role/bone/pivot/preset-* rebuild a live,
  // ANIMATED model. A plain layered SVG (Figma/Inkscape) lacks these attrs → partsMeta stays empty → same
  // geometry-only behaviour as before.
  const rootStates = svgEl.getAttribute("data-states");
  const states = rootStates ? rootStates.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const partsMeta = {};
  const used = new Set();
  const elements = [];
  let eid = 0, layerN = 0;
  let groups = [...svgEl.children].filter((n) => n.tagName && n.tagName.toLowerCase() === "g");
  // U1: an exporter re-import wraps parts in a single #rig-root group — descend into it so each
  // part group is a layer (matches parseLayered's unwrap).
  if (groups.length === 1 && groups[0].id === "rig-root") {
    groups = [...groups[0].children].filter((n) => n.tagName && n.tagName.toLowerCase() === "g");
  }
  const layers = groups.length ? groups : [svgEl]; // no groups → one implicit layer
  for (const g of layers) {
    const label = g.getAttribute("inkscape:label") || g.getAttribute("id") || g.getAttribute("data-name") || `layer-${++layerN}`;
    const part = sanitizeId(label, used);
    const meta = partsMeta[part] || (partsMeta[part] = {});
    const role = g.getAttribute("data-role"); if (role) meta.role = role;
    const kind = g.getAttribute("data-kind"); if (kind) meta.kind = kind;
    const bone = g.getAttribute("data-bone"); if (bone) meta.bone = bone;
    const piv = g.getAttribute("data-pivot"); if (piv) { const [x, y] = piv.split(",").map(Number); meta.pivot = { x, y }; }
    for (const a of g.getAttributeNames()) if (a.startsWith("data-preset-")) (meta.presets || (meta.presets = {}))[a.slice("data-preset-".length)] = g.getAttribute(a);
    for (const el of g.querySelectorAll(DRAW)) {
      let bb; try { bb = el.getBBox(); } catch { bb = { x: 0, y: 0, width: 0, height: 0 }; }
      elements.push({ id: `e${eid++}`, part, markup: el.outerHTML, bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } });
    }
  }
  document.body.removeChild(wrap);
  if (!elements.length) { status("No shapes found in that SVG."); return; }

  model = toModel({ viewBox, elements, parts: partsMeta, states });
  assetName = (name || "mascot").replace(/\.svg$/i, "");
  showModel(`Loaded ${elements.length} shapes across ${visibleParts().length} layer-parts. Set roles/pivots/presets, then export.`);
}

// ---------- render canvas ----------------------------------------------------------------------
function visibleParts() {
  const p = model.parts();
  return Object.keys(p).filter((id) => model.rectsOf(id).length > 0);
}

function render() {
  const stage = $("stage");
  stage.setAttribute("viewBox", model.viewBox());
  stage.replaceChildren();
  paletteFor([...visibleParts(), BACKGROUND_PART]);

  const root = document.createElementNS(SVGNS, "g");
  root.id = "rig-root";
  for (const id of visibleParts()) {
    const g = document.createElementNS(SVGNS, "g");
    g.setAttribute("class", "part");
    g.setAttribute("id", id);
    g.setAttribute("data-part", id);
    for (const r of model.rectsOf(id)) {
      let node;
      if (r.markup) {
        node = nodeFromMarkup(r.markup); // geometry-agnostic element (path/circle/…) — keep real art
      } else {
        node = document.createElementNS(SVGNS, "rect");
        node.setAttribute("x", r.x); node.setAttribute("y", r.y);
        node.setAttribute("width", r.w); node.setAttribute("height", r.h);
        // colour-by-part for boundaries, or the rect's real source colour when the toggle is on
        node.setAttribute("fill", showRealColours ? (r.fill || colours.get(id)) : colours.get(id));
      }
      if (!node) continue;
      node.setAttribute("data-rid", r.id);
      g.appendChild(node);
    }
    root.appendChild(g);
  }
  stage.appendChild(root);
  drawPivot();
  highlight();
  highlightRects();
}

// The pivot handle is always visible for the selected part and directly draggable (P5): no mode
// toggle needed. Its resting position is the role-aware default (defaultPivotFor) until the user
// places one. The p-key / "Place pivot" click flow still works as an alternative.
function drawPivot() {
  $("stage").querySelectorAll(".pivot").forEach((n) => n.remove());
  if (!selected) return;
  const meta = model.parts()[selected];
  const pv = meta && meta.pivot ? meta.pivot : defaultPivotFor(meta && meta.role || "passive", bboxOf(model.rectsOf(selected)));
  const c = document.createElementNS(SVGNS, "circle");
  c.setAttribute("class", "pivot");
  c.setAttribute("cx", pv.x); c.setAttribute("cy", pv.y); c.setAttribute("r", 3);
  let dragging = false;
  c.addEventListener("pointerdown", (e) => {
    e.stopPropagation();                 // don't start a marquee on the stage
    pushUndo();                          // one undo entry per drag (snapshot at drag start)
    dragging = true;
    c.setPointerCapture(e.pointerId);
  });
  c.addEventListener("pointermove", (e) => {
    if (!dragging || !selected) return;
    const { pivot, origin } = dragToPivot(svgPoint(e), bboxOf(model.rectsOf(selected)));
    model.setPivot(selected, pivot, origin);
    c.setAttribute("cx", pivot.x); c.setAttribute("cy", pivot.y);
    refreshPivotInfo();
  });
  c.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    c.releasePointerCapture(e.pointerId);
    const p = model.parts()[selected].pivot;
    regenCss();
    status(`Pivot for ${selected} set to ${p.x}, ${p.y}.`);
  });
  c.addEventListener("click", (e) => e.stopPropagation()); // a drag must not deselect the part
  $("stage").appendChild(c);
}

function highlight() {
  $("stage").querySelectorAll("g.part").forEach((g) => g.classList.toggle("sel", g.id === selected));
  $("parts").querySelectorAll("li").forEach((li) => li.classList.toggle("sel", li.dataset.id === selected));
}

// ---------- parts panel ------------------------------------------------------------------------
function renderParts() {
  const ul = $("parts");
  ul.replaceChildren();
  for (const id of visibleParts()) {
    const li = document.createElement("li");
    li.dataset.id = id;
    li.innerHTML = `<span class="swatch" style="background:${colours.get(id)}"></span>` +
      `<span class="name">${id}</span><span class="count">${model.rectsOf(id).length}</span>`;
    li.onclick = () => selectPart(id);
    ul.appendChild(li);
  }
  highlight();
}

function selectPart(id) {
  selected = id;
  pivotMode = false;
  clearRectSel();
  const meta = model.parts()[id] || {};
  $("partedit").hidden = false;
  $("selname").textContent = id;
  $("role").value = meta.role || "passive";
  $("kind").value = meta.kind || "";
  $("bone").value = meta.bone || "";
  refreshPresetPickers();
  refreshPivotInfo();
  drawPivot();
  highlight();
}

function refreshPresetPickers() {
  const meta = model.parts()[selected] || {};
  for (const s of model.states()) {
    const sel = $(`preset-${s}`);
    const names = presetsFor(meta.role || "passive", s);
    sel.replaceChildren();
    const none = new Option("(none)", "");
    sel.appendChild(none);
    for (const n of names) sel.appendChild(new Option(n, n));
    sel.value = model.preset(s, selected) || "";
    sel.disabled = names.length === 0;
  }
}

function refreshPivotInfo() {
  const meta = model.parts()[selected] || {};
  $("pivotinfo").textContent = meta.pivot
    ? `pivot: ${meta.pivot.x}, ${meta.pivot.y} · origin ${meta.origin || ""}`
    : "pivot: (default centre) — click canvas to place";
}

// ---------- editing ops ------------------------------------------------------------------------
$("role").onchange = (e) => {
  if (!selected) return;
  const role = e.target.value;
  pushUndo();
  model.setRole(selected, role);
  // Drop any preset no longer valid for the new role — otherwise it lingers (picker shows blank but
  // the model keeps it) and export later throws. Keep model + UI in sync. (UX playthrough bug #1.)
  for (const s of model.states()) {
    const cur = model.preset(s, selected);
    if (cur && !presetsFor(role, s).includes(cur)) model.setPreset(s, selected, null);
  }
  // P5: snap the pivot to the new role's sensible default (limb -> joint, else centre) so a limb
  // rotates at its hip the moment you assign it — no manual placement needed. The user can still
  // drag the handle afterward to override.
  const bb = bboxOf(model.rectsOf(selected));
  const pivot = defaultPivotFor(role, bb);
  model.setPivot(selected, pivot, pivotToOrigin(pivot, bb));
  refreshPresetPickers();
  refreshPivotInfo();
  drawPivot();
  regenCss();
};
// Optional subject kind: persists the overlay and, as a convenience, auto-picks the kind's signature
// preset (wheel->spin, flag->wave, mouth->talk) when that state is empty and the current role offers
// it. The user can still override via the preset dropdowns; clearing kind leaves any preset in place.
$("kind").onchange = (e) => {
  if (!selected) return;
  const kind = e.target.value;
  pushUndo();
  model.setKind(selected, kind || null);
  const def = kind ? kindDefaultPreset(kind) : null;
  if (def) {
    const [state, name] = def;
    const role = model.parts()[selected].role;
    // C1: only apply the kind's signature preset when its state is DECLARED and the picker isn't
    // already set — otherwise setPreset throws on an undeclared state (Simple-tier rig).
    if (model.states().includes(state) && presetsFor(role, state).includes(name) && !model.preset(state, selected)) {
      model.setPreset(state, selected, name);
    }
  }
  refreshPresetPickers();
  regenCss();
};
$("bone").onchange = (e) => { if (selected) { pushUndo(); model.setBone(selected, e.target.value.trim()); } };
// (preset-picker onchange handlers are wired in renderStateControls — pickers are now dynamic per state)
$("rename").onclick = () => {
  if (!selected) return;
  const rawNext = prompt("Rename part id to:", selected);
  if (!rawNext) return;
  const next = sanitizeId(rawNext); // valid CSS/SVG id (I2)
  if (next === selected) return;
  pushUndo();
  try { model.rename(selected, next); }
  catch (e) { undoStack.pop(); status("✗ " + (e && e.message ? e.message : e)); return; }
  const was = selected; selected = next;
  render(); renderParts(); selectPart(next); regenCss();
  status(`Renamed ${was} → ${next}.`);
};
$("remove").onclick = () => {
  if (!selected || selected === BACKGROUND_PART) return;
  pushUndo();
  model.remove(selected);
  status(`Removed ${selected} → ${BACKGROUND_PART}.`);
  selected = null; $("partedit").hidden = true;
  render(); renderParts(); regenCss();
};
$("addpart").onclick = () => {
  const raw = $("newname").value.trim();
  if (!raw) return;
  const id = sanitizeId(raw); // valid CSS/SVG id — "Left Arm" -> "part-left-arm" (I2)
  pushUndo();
  model.assign([], id);           // creates an empty candidate part (assign rects via merge below)
  $("newname").value = "";
  renderParts(); selectPart(id);
};

// ---------- marquee rect-selection (split fused parts) -----------------------------------------
// Drag = marquee (select rects to peel out); plain click = part-select (kept below). The enclosed
// set is computed once on release (perf note: no per-pointermove rect loop).
let marquee = null;          // { x0, y0, el } while dragging
let suppressClick = false;   // a completed drag must not fall through to the click part-select

function clearRectSel() {
  rectSel = [];
  highlightRects();
  $("selectbar").hidden = true;
}

// Clear both selections: the marquee rect-selection and the selected part. Bound to Esc and to a
// click on empty canvas.
function deselect() {
  pivotMode = false;
  setClickMode(null);
  clearRectSel();
  if (selected) { selected = null; $("partedit").hidden = true; }
  highlight();
}

// Per-shape reassignment modes: "paint" moves a clicked shape into the selected part; "erase" sends
// it to the static background (geometry is kept — D6). Toggling the active mode off returns to select.
function setClickMode(mode) {
  clickMode = clickMode === mode ? null : mode;
  if (clickMode) pivotMode = false;
  $("paintmode").classList.toggle("on", clickMode === "paint");
  $("erasemode").classList.toggle("on", clickMode === "erase");
  $("stage").classList.toggle("mode-paint", clickMode === "paint");
  $("stage").classList.toggle("mode-erase", clickMode === "erase");
  if (clickMode === "paint") status(`Paint: click shapes to add them to ${selected || "the selected part"}.`);
  else if (clickMode === "erase") status("Erase: click shapes to send them to the static background.");
}
$("paintmode").onclick = () => setClickMode("paint");
$("erasemode").onclick = () => setClickMode("erase");
function highlightRects() {
  const set = new Set(rectSel);
  $("stage").querySelectorAll("[data-rid]").forEach((r) => r.classList.toggle("rsel", set.has(r.dataset.rid)));
}
function showSelection() {
  $("selectbar").hidden = rectSel.length === 0;
  $("selcount").textContent = `${rectSel.length} rect(s) selected`;
}

$("stage").addEventListener("pointerdown", (e) => {
  if (pivotMode) return;                 // pivot placement uses the click handler
  suppressClick = false;                 // new interaction — never let a stale drag-suppress eat this click
  const pt = svgPoint(e);
  marquee = { x0: pt.x, y0: pt.y, el: null };
});
$("stage").addEventListener("pointermove", (e) => {
  if (!marquee) return;
  const pt = svgPoint(e);
  if (!marquee.el) {
    if (Math.hypot(pt.x - marquee.x0, pt.y - marquee.y0) < 1) return; // ignore jitter; click stays a click
    marquee.el = document.createElementNS(SVGNS, "rect");
    marquee.el.setAttribute("class", "marquee");
    $("stage").appendChild(marquee.el);
  }
  marquee.el.setAttribute("x", Math.min(pt.x, marquee.x0));
  marquee.el.setAttribute("y", Math.min(pt.y, marquee.y0));
  marquee.el.setAttribute("width", Math.abs(pt.x - marquee.x0));
  marquee.el.setAttribute("height", Math.abs(pt.y - marquee.y0));
});
$("stage").addEventListener("pointerup", (e) => {
  if (!marquee) return;
  if (marquee.el) {                       // it was a real drag, not a click
    const pt = svgPoint(e);
    rectSel = rectsInMarquee(model.rects(), { x: marquee.x0, y: marquee.y0, w: pt.x - marquee.x0, h: pt.y - marquee.y0 });
    marquee.el.remove();
    highlightRects();
    showSelection();
    suppressClick = true;
    status(`${rectSel.length} rect(s) selected — set a target part id and press move.`);
  }
  marquee = null;
});

$("split").onclick = () => {
  if (!rectSel.length) return;
  const rawTarget = $("splitname").value.trim();
  if (!rawTarget) { status("Enter a target part id first."); return; }
  const target = sanitizeId(rawTarget); // valid CSS/SVG id (I2)
  const n = rectSel.length;
  pushUndo();
  model.assign(rectSel, target);
  $("splitname").value = "";
  clearRectSel();
  render(); renderParts(); selectPart(target); regenCss();
  status(`Moved ${n} rect(s) → ${target}.`);
};

// canvas: click selects a part; in pivot mode the click places the selected part's pivot.
$("stage").addEventListener("click", (e) => {
  if (suppressClick) { suppressClick = false; return; }
  const pt = svgPoint(e);
  if (pivotMode && selected) {
    pushUndo();
    const { pivot, origin } = dragToPivot(pt, bboxOf(model.rectsOf(selected)));
    model.setPivot(selected, pivot, origin);
    pivotMode = false;
    refreshPivotInfo(); drawPivot(); regenCss();
    status(`Pivot for ${selected} set to ${pivot.x}, ${pivot.y}.`);
    return;
  }
  if (clickMode) {                                            // paint / erase individual shapes
    const el = e.target.closest && e.target.closest("[data-rid]");
    if (!el) return;                                          // empty click in a mode: ignore (Esc exits)
    if (clickMode === "paint") {
      if (!selected) { status("Select a part first, then paint shapes into it."); return; }
      pushUndo();
      model.assign([el.dataset.rid], selected);
    } else {
      pushUndo();
      model.assign([el.dataset.rid], BACKGROUND_PART);
    }
    render(); renderParts(); regenCss();
    return;
  }
  const g = e.target.closest && e.target.closest("g.part");   // native O(1) hit-test (perf note)
  if (g) selectPart(g.id);
  else deselect();                                            // click empty canvas to deselect
});

document.addEventListener("keydown", (e) => { if (e.key === "Escape") deselect(); });

// Ctrl+Z (Cmd+Z on macOS): revert the last mutating op from the undo stack.
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
    e.preventDefault();
    if (!undoStack.length) { status("Nothing to undo."); return; }
    model.restore(undoStack.pop());
    refreshModelView();
    status("Undid last change.");
  }
});

function svgPoint(e) {
  const stage = $("stage");
  const r = stage.getBoundingClientRect();
  const [minX, minY, w, h] = model.viewBox().split(/\s+/).map(Number);
  return { x: minX + ((e.clientX - r.left) / r.width) * w, y: minY + ((e.clientY - r.top) / r.height) * h };
}

// place-pivot toggle (added to the hint area)
document.addEventListener("keydown", (e) => { if (e.key === "p" && selected) { pivotMode = true; status("Pivot mode: click the canvas to place the pivot."); } });

// ---------- live preview -----------------------------------------------------------------------
function regenCss() {
  if (!model) return;
  updateRigStatus();
  let rig;
  try { rig = exportRig(model, { assetName, recipeFor }).riggedJson; } catch { return; }
  let style = $("anim");
  if (!style) { style = document.createElement("style"); style.id = "anim"; document.head.appendChild(style); }
  // Shared generator (P1): the live preview uses the SAME emit.js as the standalone export, scoped to
  // #stage — so what you preview is exactly what you export.
  style.textContent = emitCss(rig, { scope: "#stage" });
}

$("states").addEventListener("click", (e) => {
  const rm = e.target.closest("button[data-rmstate]");
  if (rm) { pushUndo(); model.removeState(rm.dataset.rmstate); renderStateControls(); regenCss(); return; }
  const b = e.target.closest("button[data-state]");
  if (!b) return;
  $("stage").setAttribute("data-state", b.dataset.state);
  $("states").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
});
$("reduce").onchange = (e) => $("stage").classList.toggle("force-reduced-motion", e.target.checked);

let showRealColours = false;
const realToggle = $("realcolours");
if (realToggle) realToggle.addEventListener("change", () => { showRealColours = realToggle.checked; render(); });

// ---------- export -----------------------------------------------------------------------------
// P1: one-click, self-contained animated mascot — no terminal, no mf emit. Uses the same emit.js the
// live preview uses, so the download matches what's on screen.
$("exportanim").onclick = () => {
  let out;
  try { out = exportRig(model, { assetName, recipeFor }); }
  catch (e) { status("✗ " + (e && e.message ? e.message : e)); alert("Can't export yet:\n\n" + (e && e.message ? e.message : e)); return; }
  const v = validate(out.riggedJson);
  if (!v.ok) { status("✗ " + v.errors[0]); alert("Fix the rig first:\n\n" + v.errors.join("\n")); return; }
  const svg = emitAnimatedSvg(out.riggedJson, out.manualSvg);
  download(`${assetName}-mascot.svg`, svg, "image/svg+xml");
  download(`${assetName}-mascot-demo.html`, emitDemoHtml(out.riggedJson, svg, assetName), "text/html");
  status(`✓ Exported a self-contained animated mascot — open ${assetName}-mascot-demo.html in a browser. No terminal needed.`);
};

// Advanced: the raw mf emit / React+GSAP input pair (manual-part.svg + rigged.json + parts-spec.json).
$("export").onclick = () => {
  const ungrouped = model.ungroupedRects();
  if (ungrouped.length && !confirm(`${ungrouped.length} rect(s) are unassigned and will go to part-background. Export anyway?`)) return;
  let out;
  try { out = exportRig(model, { assetName, recipeFor }); }
  catch (e) { status("✗ Export failed: " + (e && e.message ? e.message : e)); alert("Export failed:\n\n" + (e && e.message ? e.message : e)); return; }
  const v = validate(out.riggedJson);
  if (!v.ok) { status("✗ " + v.errors[0]); alert("Validation failed:\n\n" + v.errors.join("\n")); return; }
  download(`${assetName}-manual-part.svg`, out.manualSvg, "image/svg+xml");
  download(`${assetName}-rigged.json`, JSON.stringify(out.riggedJson, null, 2), "application/json");
  download(`parts-spec.json`, JSON.stringify(out.partsSpec, null, 2), "application/json");
  status(`✓ Exported 3 files (${assetName}-manual-part.svg + ${assetName}-rigged.json + parts-spec.json). Put them in assets/${assetName}/, then run:  mf emit ${assetName}`);
};

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function status(msg) { $("status").textContent = msg; }

// ---------- file intake ------------------------------------------------------------------------
// A PNG is vectorised + segmented in-browser (Phase 2) into the same segmented.svg an `mf forge`
// run would hand off; a .svg is loaded directly. Both converge at loadText (the existing path).
async function loadFile(f) {
  if (!f) return;
  const name = f.name || "mascot";
  if (/\.svg$/i.test(name)) {
    const t = await f.text();
    if (/\bdata-part=/.test(t)) loadText(t, name);  // segmenter output (named rect groups)
    else loadLayeredSvg(t, name);                    // layered vector SVG (Figma/Inkscape/Illustrator)
    return;
  }
  if (/\.png$/i.test(name)) { await loadPng(f, name); return; }
  status("Drop a PNG, a layered SVG, or a segmented .svg.");
}

async function loadPng(f, name) {
  try {
    const maxDim = Math.max(16, parseInt($("maxdim").value, 10) || 256);
    const colors = Math.max(1, parseInt($("colors").value, 10) || 6);
    const { rgba, w, h } = await decodePng(f, maxDim);
    const flat = vectorizeRaster({ rgba, w, h }, { colors });
    const { svg } = segment(flat.rects, { viewBoxSize: Math.max(w, h) }); // square canvas, padded
    loadText(svg, name.replace(/\.png$/i, "-segmented.svg"));
    status(`Vectorised ${name} (${w}×${h}, ${flat.rects.length} rects) → ${visibleParts().length} proposed parts. Refine, then export.`);
  } catch (e) {
    status("✗ " + (e && e.message ? e.message : e));
  }
}

// PNG -> nearest-neighbour-downscaled RGBA grid (mirrors prep-source.ps1; canvas is the only
// browser-only step — everything downstream is the node-tested pure pipeline).
async function decodePng(file, maxDim) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false; // nearest-neighbour downscale
  ctx.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  return { rgba: ctx.getImageData(0, 0, w, h).data, w, h };
}

$("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
const dz = $("dropzone");
["dragover", "dragenter"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); }));
dz.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

// test/debug hook: drive the editor from a script (used by preview verification).
window.__rigEditor = { loadText, loadLayeredSvg, loadFile, loadExample, get model() { return model; }, exportRig, validate, recipeFor, rectsInMarquee, vectorizeRaster, segment, emitAnimatedSvg, emitDemoHtml, get rectSel() { return rectSel.slice(); } };

// auto-load a handoff rig passed by forge_open_editor: ?rig=<project-relative path> (served from repo root)
const rigParam = new URLSearchParams(location.search).get("rig");
if (rigParam) fetch("/" + rigParam.replace(/^\/+/, "")).then((r) => r.ok ? r.text() : Promise.reject(new Error("rig not found"))).then((t) => loadLayeredSvg(t, rigParam.split("/").pop())).catch((e) => status("✗ " + e.message));
