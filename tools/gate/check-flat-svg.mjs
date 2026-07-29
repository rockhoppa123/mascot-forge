// check-flat-svg.mjs — structural checks for the Phase 1 generated flat.svg (PNG -> colour-clustered
// geometry). Independent of check-buildable-slice; it does NOT touch the Manual Part SVG, rigged.json,
// the emitters, or any golden. See ADR-0009 for why flat.svg is quantized colour clusters.
//
// Port of tools/check-flat-svg.ps1 (retired 2026-07-28; see git history) — keep assertions and messages recognisable so a contributor who
// hits a failure can find the old message in git history.
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rootTag, attrOf, elements, countElements, allGroups, directChildren, readSvg } from "./svg-scan.mjs";

function fail(message) {
  throw new Error(`flat.svg check failed: ${message}`);
}

function assertTrue(condition, message) {
  if (!condition) fail(message);
}

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

const flatPathArg = process.argv[2] || join("docs", "buildable-slice", "generated", "devbrain-flat.svg");
const resolved = isAbsolute(flatPathArg) ? flatPathArg : join(REPO_ROOT, flatPathArg);

assertTrue(existsSync(resolved), `Missing flat.svg: ${resolved}`);

const svgText = readSvg(resolved);

// --- Root contract -----------------------------------------------------------------------
let root;
try {
  root = rootTag(svgText);
} catch (e) {
  fail(`Could not parse flat.svg as XML. ${e.message}`);
}

assertTrue(root.match(/^<svg\b/) != null, "Root element must be <svg>.");
assertTrue(attrOf(root, "viewBox") === "0 0 192 192", "flat.svg must use viewBox='0 0 192 192'.");
assertTrue(attrOf(root, "width") === "192", "flat.svg width must equal source px (192).");
assertTrue(attrOf(root, "height") === "192", "flat.svg height must equal source px (192).");
assertTrue(attrOf(root, "data-render-method") === "quantized-color-rle", "flat.svg must record data-render-method='quantized-color-rle'.");

const bounds = attrOf(root, "data-source-bounds");
assertTrue(/^\d+,\d+,\d+,\d+$/.test(bounds || ""), "flat.svg must carry data-source-bounds 'minX,minY,maxX,maxY'.");
const [minX, minY, maxX, maxY] = bounds.split(",").map(Number);
assertTrue(minX < maxX && minY < maxY, "data-source-bounds must describe a non-empty box.");

// --- No curves: pixel-exact rect geometry only ------------------------------------------
assertTrue(elements(svgText, "path").length === 0, "flat.svg must contain zero <path> (no curve-fitting).");
assertTrue(
  countElements(svgText, ["circle", "ellipse", "polygon", "polyline"]) === 0,
  "flat.svg must contain only <rect> geometry."
);

// --- Colour clusters: one <g data-color> per colour, rects nested + matching fill --------
// allGroups (not topLevelGroups): PowerShell selects every <g> at any depth
// (//*[local-name()='g']), so a nested <g> — e.g. one missing data-color — must be visible here too,
// not silently folded into its parent.
const groups = allGroups(svgText);
assertTrue(groups.length >= 1, "flat.svg must include at least one <g data-color> colour cluster.");

const seenColors = new Set();
let rectTotal = 0;
let gMinX = Infinity, gMinY = Infinity, gMaxX = -1, gMaxY = -1;
for (const g of groups) {
  const color = attrOf(g.attrs, "data-color");
  // Case-SENSITIVE on purpose: PowerShell's `-match` is case-insensitive by default, so the original
  // never actually enforced "(lowercase)" despite its own message. This port's RegExp.test enforces
  // it for real. Kept deliberately stricter — it matches the message's stated intent, and the
  // generator only ever emits lowercase hex — so do not loosen this back to match the original's
  // accidental laxity.
  assertTrue(/^#[0-9a-f]{6}$/.test(color || ""), `Each <g> must carry data-color='#rrggbb' (lowercase). Got '${color}'.`);
  assertTrue(!seenColors.has(color), `Duplicate colour group '${color}' — there must be exactly one <g> per colour.`);
  seenColors.add(color);

  // Direct children only (matches PowerShell's ./*[local-name()='rect']) — a nested <g>'s rects are
  // NOT this group's own rects, they belong to that nested group's own entry in `groups`.
  const rects = directChildren(g.inner, "rect");
  assertTrue(rects.length >= 1, `Colour group '${color}' must contain at least one <rect>.`);
  for (const rect of rects) {
    const fill = attrOf(rect, "fill");
    assertTrue(fill === color, `A <rect> in group '${color}' has a mismatched fill '${fill}'.`);
    const x = Number(attrOf(rect, "x")), y = Number(attrOf(rect, "y"));
    const w = Number(attrOf(rect, "width")), h = Number(attrOf(rect, "height"));
    assertTrue(w >= 1 && h >= 1, "Every <rect> must have positive width/height.");
    // No geometry over the fully-transparent margin: rects stay inside the visible bounds box.
    assertTrue(
      x >= minX && y >= minY && (x + w) <= (maxX + 1) && (y + h) <= (maxY + 1),
      `A <rect> at (${x},${y},${w},${h}) falls outside data-source-bounds [${bounds}] — geometry must not cover transparent pixels.`
    );
    if (x < gMinX) gMinX = x;
    if (y < gMinY) gMinY = y;
    if (x + w > gMaxX) gMaxX = x + w;
    if (y + h > gMaxY) gMaxY = y + h;
    rectTotal++;
  }
}

// Coverage reaches the recorded visible bounds (geometry isn't a shrunken subset).
assertTrue(gMinX === minX && gMinY === minY, `Geometry top-left must reach the visible bounds origin (${minX},${minY}).`);
assertTrue((gMaxX - 1) === maxX && (gMaxY - 1) === maxY, `Geometry must extend to the visible bounds extent (${maxX},${maxY}).`);

// --- Greedy meshing actually worked: rect count well below 1-per-opaque-pixel ------------
// The source has ~7.1k opaque pixels; a working RLE+greedy-mesh must be a small fraction.
assertTrue(rectTotal >= 1, "flat.svg must contain at least one <rect>.");
assertTrue(rectTotal < 2000, `flat.svg rect count (${rectTotal}) is too high — greedy meshing is not collapsing runs.`);

console.log("flat.svg structural checks passed.");
console.log(`  colours : ${seenColors.size}`);
console.log(`  rects   : ${rectTotal}`);
console.log(`  bounds  : ${bounds}`);
