// app.js — browser glue for the rig editor. Wires the tested core modules (model, loader, pivot,
// presets, validator, exporter) to a minimal DOM. The pure logic lives in those modules and is
// node-tested; this file is unverified UI glue, deliberately small.
//
// Part ops: rename/role/pivot/preset/merge/remove (part-level) plus drag-marquee rect-level SPLIT
// (peel colour-fused rects — e.g. land-rover wheels stuck in part-body — into their own part via
// model.assign). Geometry/selection logic is in the node-tested modules; this stays thin glue.
import { createModel, ROLES, BACKGROUND_PART } from "./model.js";
import { parseSegmented, applyPartsSpec } from "./loader.js";
import { bboxOf, dragToPivot, pivotToOrigin } from "./pivot.js";
import { presetsFor, recipeFor } from "./presets.js";
import { validate } from "./validator.js";
import { exportRig } from "./exporter.js";
import { rectsInMarquee } from "./select.js";
import { vectorizeRaster } from "./vectorize.js";
import { segment } from "./segment.js";
import { sanitizeId, toModel } from "./layer-ingest.js";

const $ = (id) => document.getElementById(id);
const SVGNS = "http://www.w3.org/2000/svg";

let model = null;
let assetName = "mascot";
let selected = null;        // selected part id
let pivotMode = false;      // next canvas click places the selected part's pivot
let rectSel = [];           // marquee rect-selection (rect ids) pending a split/move
let clickMode = null;       // null | "paint" | "erase" — per-shape reassignment by clicking
const colours = new Map();  // partId -> hsl colour

// ---------- load -------------------------------------------------------------------------------
function paletteFor(ids) {
  colours.clear();
  ids.forEach((id, i) => colours.set(id, `hsl(${(i * 67) % 360} 70% 55%)`));
}

function loadText(text, name) {
  assetName = (name || "mascot").replace(/-segmented\.svg$/i, "").replace(/\.svg$/i, "");
  model = parseSegmented(text);
  showModel(`Loaded ${model.rects().length} rects, ${visibleParts().length} proposed parts.`);
}

// Reveal the editor chrome and draw the current `model`. Shared by every loader.
function showModel(msg) {
  selected = null;
  pivotMode = false;
  rectSel = [];
  $("dropzone").hidden = true;
  $("stagewrap").hidden = false;
  $("states").hidden = false;
  $("panel").hidden = false;
  $("exportbar").hidden = false;
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
  const used = new Set();
  const elements = [];
  let eid = 0, layerN = 0;
  const groups = [...svgEl.children].filter((n) => n.tagName && n.tagName.toLowerCase() === "g");
  const layers = groups.length ? groups : [svgEl]; // no groups → one implicit layer
  for (const g of layers) {
    const label = g.getAttribute("inkscape:label") || g.getAttribute("id") || g.getAttribute("data-name") || `layer-${++layerN}`;
    const part = sanitizeId(label, used);
    for (const el of g.querySelectorAll(DRAW)) {
      let bb; try { bb = el.getBBox(); } catch { bb = { x: 0, y: 0, width: 0, height: 0 }; }
      elements.push({ id: `e${eid++}`, part, markup: el.outerHTML, bbox: { x: bb.x, y: bb.y, w: bb.width, h: bb.height } });
    }
  }
  document.body.removeChild(wrap);
  if (!elements.length) { status("No shapes found in that SVG."); return; }

  model = toModel({ viewBox, elements });
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
        node.setAttribute("fill", colours.get(id)); // colour-by-part view (rect inputs)
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

function drawPivot() {
  $("stage").querySelectorAll(".pivot").forEach((n) => n.remove());
  if (!selected) return;
  const meta = model.parts()[selected];
  const pv = meta && meta.pivot ? meta.pivot : centreOf(selected);
  const c = document.createElementNS(SVGNS, "circle");
  c.setAttribute("class", "pivot");
  c.setAttribute("cx", pv.x); c.setAttribute("cy", pv.y); c.setAttribute("r", 3);
  $("stage").appendChild(c);
}

function centreOf(id) {
  const bb = bboxOf(model.rectsOf(id));
  return { x: bb.x + bb.w / 2, y: bb.y + bb.h / 2 };
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
$("role").onchange = (e) => { if (selected) { model.setRole(selected, e.target.value); refreshPresetPickers(); regenCss(); } };
$("bone").onchange = (e) => { if (selected) model.setBone(selected, e.target.value.trim()); };
for (const s of ["idle", "active", "alert"]) {
  $(`preset-${s}`).onchange = (e) => { if (selected) { model.setPreset(s, selected, e.target.value || null); regenCss(); } };
}
$("rename").onclick = () => {
  if (!selected) return;
  const next = prompt("Rename part id to:", selected);
  if (!next || next === selected) return;
  model.rename(selected, next);
  const was = selected; selected = next;
  render(); renderParts(); selectPart(next); regenCss();
  status(`Renamed ${was} → ${next}.`);
};
$("remove").onclick = () => {
  if (!selected || selected === BACKGROUND_PART) return;
  model.remove(selected);
  status(`Removed ${selected} → ${BACKGROUND_PART}.`);
  selected = null; $("partedit").hidden = true;
  render(); renderParts(); regenCss();
};
$("addpart").onclick = () => {
  const id = $("newname").value.trim();
  if (!id) return;
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
  const target = $("splitname").value.trim();
  if (!target) { status("Enter a target part id first."); return; }
  const n = rectSel.length;
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
      model.assign([el.dataset.rid], selected);
    } else {
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
  let rig;
  try { rig = exportRig(model, { assetName, recipeFor }).riggedJson; } catch { return; }
  const css = [`#stage g.part { transform-box: fill-box; }`];
  for (const p of rig.parts) css.push(`#stage #${p.id} { transform-origin: ${p.origin}; }`);
  for (const s of rig.states) {
    for (const rec of rig.animations[s]) {
      css.push(`#stage[data-state="${s}"] #${rec.part} { animation: ${rec.name} ${rec.durationMs}ms ${rec.timing} ${rec.iteration}; }`);
      const kf = rec.keyframes.map((k) => `${k.offset} { transform: ${k.transform}; }`).join(" ");
      css.push(`@keyframes ${rec.name} { ${kf} }`);
    }
  }
  css.push(`#stage.force-reduced-motion g.part { animation: none !important; }`);
  css.push(`@media (prefers-reduced-motion: reduce) { #stage g.part { animation: none !important; } }`);
  let style = $("anim");
  if (!style) { style = document.createElement("style"); style.id = "anim"; document.head.appendChild(style); }
  style.textContent = css.join("\n");
}

$("states").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-state]");
  if (!b) return;
  $("stage").setAttribute("data-state", b.dataset.state);
  $("states").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
});
$("reduce").onchange = (e) => $("stage").classList.toggle("force-reduced-motion", e.target.checked);

// ---------- export -----------------------------------------------------------------------------
$("export").onclick = () => {
  const ungrouped = model.ungroupedRects();
  if (ungrouped.length && !confirm(`${ungrouped.length} rect(s) are unassigned and will go to part-background. Export anyway?`)) return;
  const out = exportRig(model, { assetName, recipeFor });
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
window.__rigEditor = { loadText, loadLayeredSvg, loadFile, loadExample, get model() { return model; }, exportRig, validate, recipeFor, rectsInMarquee, vectorizeRaster, segment, get rectSel() { return rectSel.slice(); } };
