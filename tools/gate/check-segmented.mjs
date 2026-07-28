// check-segmented.mjs — structural checks for the Phase 2 proposed-segmentation artifact
// (devbrain-segmented.svg). Independent of check-flat-svg.mjs / check-buildable-slice; it does NOT
// touch the Manual Part SVG, rigged.json, the emitters, or any golden. See ADR-0002 (assisted, not
// full-auto).
//
// Port of tools/check-segmented.ps1 — keep assertions and messages recognisable so a contributor who
// hits a failure can find the old message in git history.
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { rootTag, attrOf, elements, allGroups, directChildren, readSvg } from "./svg-scan.mjs";

function fail(message) {
  throw new Error(`segmented.svg check failed: ${message}`);
}

function assertTrue(condition, message) {
  if (!condition) fail(message);
}

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function resolveRepoPath(p) {
  return isAbsolute(p) ? p : join(REPO_ROOT, p);
}

const segmentedPathArg = process.argv[2] || join("docs", "buildable-slice", "generated", "devbrain-segmented.svg");
const flatPathArg = process.argv[3] || join("docs", "buildable-slice", "generated", "devbrain-flat.svg");
const resolved = resolveRepoPath(segmentedPathArg);
const resolvedFlat = resolveRepoPath(flatPathArg);

assertTrue(existsSync(resolved), `Missing segmented.svg: ${resolved}`);
assertTrue(existsSync(resolvedFlat), `Missing flat.svg (coverage baseline): ${resolvedFlat}`);

const svgText = readSvg(resolved);

// --- Root contract: same canvas as flat.svg, declared CCL method -------------------------
let root;
try {
  root = rootTag(svgText);
} catch (e) {
  fail(`Could not parse segmented.svg as XML. ${e.message}`);
}

assertTrue(root.match(/^<svg\b/) != null, "Root element must be <svg>.");
assertTrue(attrOf(root, "viewBox") === "0 0 192 192", "segmented.svg must reuse viewBox='0 0 192 192'.");
assertTrue(
  attrOf(root, "data-render-method") === "ccl-color-threshold",
  "segmented.svg must record data-render-method='ccl-color-threshold' (deterministic, no ML)."
);

// --- Part groups: ids from the accepted vocabulary, unique, each with a valid pivot -------
const vocab = ["part-body", "part-leg-left", "part-leg-right", "part-antenna", "part-eyes", "part-moustache"];

// allGroups (not topLevelGroups): PowerShell selects every <g> at any depth
// (//*[local-name()='g'][@data-part]), so a <g data-part> nested inside another group must be
// visible here too, not silently folded into its parent.
const partGroups = allGroups(svgText).filter((g) => attrOf(g.attrs, "data-part") !== undefined);
assertTrue(partGroups.length >= 1, "segmented.svg must contain at least one <g data-part>.");

const seen = new Set();
const order = [];
let partRectTotal = 0;
for (const g of partGroups) {
  const part = attrOf(g.attrs, "data-part");
  assertTrue(vocab.includes(part), `Unknown part id '${part}' — must be one of the accepted vocabulary.`);
  assertTrue(!seen.has(part), `Duplicate part group '${part}' — each part appears once.`);
  seen.add(part);
  order.push(part);

  const pivot = attrOf(g.attrs, "data-pivot");
  assertTrue(
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(pivot || ""),
    `Part '${part}' must carry data-pivot='x,y'. Got '${pivot}'.`
  );
  const [px, py] = pivot.split(",").map(Number);
  assertTrue(
    px >= 0 && px <= 192 && py >= 0 && py <= 192,
    `Part '${part}' pivot (${pivot}) falls outside the 192x192 canvas.`
  );

  // Direct children only (matches PowerShell's ./*[local-name()='rect']) — a nested <g>'s rects are
  // NOT this group's own rects, they belong to that nested group's own entry in partGroups.
  const rects = directChildren(g.inner, "rect");
  assertTrue(rects.length >= 1, `Part '${part}' must contain at least one <rect>.`);
  partRectTotal += rects.length;
}

// --- Deterministic, stable ordering = vocabulary order (no hash-dependent shuffling) ------
const expected = vocab.filter((v) => seen.has(v));
assertTrue(
  order.join("|") === expected.join("|"),
  `Part groups must appear in fixed vocabulary order. Got '${order.join(", ")}'.`
);

// --- Body must be recovered (the one part that always separates) -------------------------
assertTrue(seen.has("part-body"), "segmented.svg must recover part-body.");

// --- Coverage: every flat.svg rect lands in exactly one part (no geometry lost or added) --
const flatText = readSvg(resolvedFlat);
const flatRectTotal = elements(flatText, "rect").length;
assertTrue(
  partRectTotal === flatRectTotal,
  `Part rects (${partRectTotal}) must equal flat.svg rects (${flatRectTotal}) — segmentation must regroup all geometry, losing/inventing none.`
);

console.log("segmented.svg structural checks passed.");
console.log(`  parts   : ${seen.size} (${order.join(", ")})`);
console.log(`  rects   : ${partRectTotal} (== flat.svg)`);
