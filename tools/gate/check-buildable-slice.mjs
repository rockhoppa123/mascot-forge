// check-buildable-slice.mjs — structural checks for the buildable-slice fixture set: the Manual Part
// SVG, rigged.json (schema v2), the emitted CSS+demo, the same suite re-run against generated/, and
// showcase.html reference integrity. This is the largest and most-load-bearing gate checker — see
// docs/buildable-slice/README.md for what the fixture proves.
//
// Port of tools/check-buildable-slice.ps1 — keep assertions and messages recognisable so a contributor
// who hits a failure can find the old message in git history. This is a PORT: assertions are preserved
// as-is, including one (source.path, below) that already cannot pass on a fresh clone. Do not fix it
// here — see the comment at that assertion.
//
// Case-sensitivity note (applies throughout this file): PowerShell's `-eq`, `-match`, `-notmatch`,
// `-contains`, and its default string Sort-Object are all case-INSENSITIVE. This port's `===`, regex
// (no /i flag), `.includes`, and `Array.prototype.sort` are all case-SENSITIVE. Several assertions
// below are therefore stricter here than the message in the original ever actually enforced. This is
// the same deliberate divergence already established in check-flat-svg.mjs (data-color) and
// check-segmented.mjs (data-part): keep the stricter behaviour, since every value compared below is
// emitted verbatim (lowercase ids, exact JSON strings) by this repo's own tooling — never loosen these
// back to match the original's accidental laxity.
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";
import { join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { readSvg, rootTag, attrOf, elements, allGroups } from "./svg-scan.mjs";

function fail(message) {
  throw new Error(`Buildable Slice check failed: ${message}`);
}

function assertTrue(condition, message) {
  if (!condition) fail(message);
}

function assertFile(path) {
  let ok = false;
  try { ok = statSync(path).isFile(); } catch { ok = false; }
  assertTrue(ok, `Missing required file: ${path}`);
}

function assertDirectory(path) {
  let ok = false;
  try { ok = statSync(path).isDirectory(); } catch { ok = false; }
  assertTrue(ok, `Missing required directory: ${path}`);
}

function readJsonFile(path) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    fail(`Could not read JSON at ${path}. ${e.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    fail(`Could not parse JSON at ${path}. ${e.message}`);
  }
}

// See the file-level case-sensitivity note: PS's Assert-Sequence/Assert-Set compare joined,
// (for Set) sorted strings with `-eq`, which is case-insensitive. These use strict `===`.
function assertSequence(actual, expected, message) {
  assertTrue(actual.join(",") === expected.join(","), message);
}

function assertSet(actual, expected, message) {
  const a = [...actual].sort().join(",");
  const e = [...expected].sort().join(",");
  assertTrue(a === e, message);
}

// --- Path resolution: root defaults to the repo root, overridable with --root <dir> so the mutation
// matrix can aim the whole checker at a copied tree without touching a committed file. ------------
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

function parseRootArg(argv) {
  const i = argv.indexOf("--root");
  if (i === -1) return undefined;
  return argv[i + 1];
}

const rootArg = parseRootArg(process.argv.slice(2));
const root = rootArg === undefined
  ? REPO_ROOT
  : (isAbsolute(rootArg) ? rootArg : join(process.cwd(), rootArg));

console.log(`Buildable Slice check running against: ${root}`);

// Trap 1 (Windows path literals): every path below is built as SEPARATE segments via path.join.
// The source has `Join-Path $repoRoot "docs\buildable-slice"` etc — those only work because
// PowerShell accepts '\' as a separator on Windows. A literal "docs\\buildable-slice" here would be
// a single filename containing a backslash on Linux, defeating the whole point of this port.
const sliceRoot = join(root, "docs", "buildable-slice");
const readmePath = join(sliceRoot, "README.md");
const svgPath = join(sliceRoot, "devbrain-manual-part.svg");
const rigPath = join(sliceRoot, "devbrain-rigged.json");
const cssPath = join(sliceRoot, "devbrain-svg-css.css");
const demoPath = join(sliceRoot, "devbrain-svg-css-demo.html");
const goldensPath = join(sliceRoot, "goldens");
const generatedPath = join(sliceRoot, "generated");
const generatedSvgPath = join(generatedPath, "devbrain-svg-css.generated.svg");
const generatedCssPath = join(generatedPath, "devbrain-svg-css.generated.css");
const generatedDemoPath = join(generatedPath, "devbrain-svg-css.generated-demo.html");
// Line 85 in the source: an existence assertion on the legacy PowerShell emitter. It is marked
// legacy (not deleted) as of this plan's Task 5, so this assertion must survive the port.
const emitterPath = join(root, "tools", "emit-svg-css.ps1");

// --- Group 1: required files/dirs exist ------------------------------------------------------
const requiredFiles = [readmePath, svgPath, rigPath, cssPath, demoPath, emitterPath];
for (const p of requiredFiles) assertFile(p);
assertDirectory(goldensPath);
assertDirectory(generatedPath);
assertFile(generatedSvgPath);
assertFile(generatedCssPath);
assertFile(generatedDemoPath);

// --- Group 2: generated/ contains EXACTLY this set of filenames — no extras, no missing -------
const generatedFileNames = readdirSync(generatedPath, { withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => d.name);
const expectedGeneratedFileNames = [
  "devbrain-svg-css.generated.svg",
  "devbrain-svg-css.generated.css",
  "devbrain-svg-css.generated-demo.html",
  "devbrain-flat.svg",
  "devbrain-segmented.svg",
  "devbrain-segmented-review.html",
];
assertSet(
  generatedFileNames,
  expectedGeneratedFileNames,
  "generated/ must contain only the generated SVG+CSS demo files, the Phase 1 flat.svg, and the Phase 2 segmentation artifacts."
);

// --- Group 3: zero-dependency guard — no root package.json ------------------------------------
assertTrue(!existsSync(join(root, "package.json")), "Root package.json must not be created for this pass.");

console.log("Groups 1-3 (files, generated/ set, zero-dependency guard) passed.");

// --- Shared SVG lookups (used by groups 4/5 and again, against generated/, in group 9) --------
// Semantic parts and #rig-root are all <g> elements in this fixture, so allGroups() (any depth,
// matches PowerShell's //*[local-name()='g']) is sufficient for id lookups by group.
function findGroupById(svgText, id) {
  return allGroups(svgText).find((g) => attrOf(g.attrs, "id") === id);
}

// Matches PowerShell's `$null -ne $svg.SelectSingleNode("//*[@id='$id']")` for ANY element (not just
// <g>) — a plain attribute-text scan rather than a group lookup, since "impact" must never appear as
// an id anywhere in the document, on any tag.
function hasElementWithId(svgText, id) {
  return new RegExp(`<[a-zA-Z][^>]*\\bid="${id}"`).test(svgText);
}

const expectedStates = ["idle", "active", "alert"];
const expectedPartIds = [
  "part-body",
  "part-leg-left",
  "part-leg-right",
  "part-antenna",
  "part-eyes",
  "part-moustache",
];

const svgText = readSvg(svgPath);
const svgRoot = rootTag(svgText);

// --- Group 4: Manual Part SVG structure --------------------------------------------------------
assertTrue(attrOf(svgRoot, "id") === "mascot", "Manual Part SVG root must use id='mascot'.");
assertTrue(attrOf(svgRoot, "viewBox") === "0 0 192 192", "Manual Part SVG must use viewBox='0 0 192 192'.");
assertTrue(attrOf(svgRoot, "data-state") === "idle", "Manual Part SVG must default to data-state='idle'.");
assertTrue(
  attrOf(svgRoot, "data-render-method") === "source-pixel-rle",
  "Manual Part SVG must use source-pixel RLE geometry, not a freehand approximation."
);
assertTrue(
  attrOf(svgRoot, "data-source-bounds") === "21,77,170,177",
  "Manual Part SVG must record the approved Clean Mascot Source visible bounds."
);
assertTrue(findGroupById(svgText, "rig-root") !== undefined, "Manual Part SVG must include #rig-root.");
assertTrue(elements(svgText, "path").length === 0, "Manual Part SVG source-pixel fixture must not contain freehand path geometry.");

const manualRectTotal = elements(svgText, "rect").length;
assertTrue(manualRectTotal > 100, "Manual Part SVG source-pixel fixture must include enough pixel-run rects to preserve likeness.");

const moustacheGroup = findGroupById(svgText, "part-moustache");
const bodyGroup = findGroupById(svgText, "part-body");
const moustacheRectCount = moustacheGroup ? elements(moustacheGroup.inner, "rect").length : 0;
const bodyRectCount = bodyGroup ? elements(bodyGroup.inner, "rect").length : 0;
assertTrue(moustacheRectCount < 1200, "part-moustache must be a narrow recoil accent, not the whole lower body.");
assertTrue(bodyRectCount > moustacheRectCount, "part-body must retain the main orange silhouette when alert recoil moves part-moustache.");
assertTrue(bodyRectCount > 5500, "part-body must include the full orange base silhouette beneath the recoil accent.");

// --- Group 5: every semantic part id carries class="part" + data-origin/data-pivot-x/-y --------
for (const id of expectedPartIds) {
  const g = findGroupById(svgText, id);
  assertTrue(g !== undefined, `Manual Part SVG missing semantic part id: ${id}`);
  // Case-sensitive by design (see file-level note): PS's -match "(^| )part( |$)" is case-insensitive,
  // so it would also accept class="PART". This fixture's generator only ever emits lowercase "part".
  assertTrue(/(^| )part( |$)/.test(attrOf(g.attrs, "class") || ""), `${id} must include class='part'.`);
  assertTrue(attrOf(g.attrs, "data-origin") !== undefined, `${id} must include data-origin metadata.`);
  assertTrue(attrOf(g.attrs, "data-pivot-x") !== undefined, `${id} must include data-pivot-x metadata.`);
  assertTrue(attrOf(g.attrs, "data-pivot-y") !== undefined, `${id} must include data-pivot-y metadata.`);
}

assertTrue(!hasElementWithId(svgText, "impact"), "Manual Part SVG must not expose impact as a semantic state or part id.");

console.log("Groups 4-5 (Manual Part SVG structure + per-part attributes) passed.");

// --- Group 6: rigged.json schema v2 (the whole lock) -------------------------------------------
function nonBlank(s) {
  return typeof s === "string" && s.trim().length > 0;
}

function isFiniteNumber(n) {
  return typeof n === "number" ? Number.isFinite(n) : Number.isFinite(Number(n)) && nonBlank(String(n));
}

const rig = readJsonFile(rigPath);

assertTrue(rig.version === 2, "rigged.json version must be 2 (schema-lock: canonical pivots + structured channels + explicit yoyo/iteration).");
assertTrue(rig.source?.kind === "clean-mascot-source", "rigged.json source.kind must be clean-mascot-source.");
// Trap 2 (verbatim, on purpose): this exact absolute author-machine path already cannot pass on
// anyone else's clone. Ported verbatim anyway — this is a port, not a fix — and flagged as a
// follow-up in the task report. Do not relax this assertion here.
assertTrue(
  rig.source?.path === "C:\\Users\\student1\\Dev\\DevBrain\\public\\mascot\\default.png",
  "rigged.json source.path must record the approved Clean Mascot Source."
);
assertTrue(rig.source?.metadata?.width === 192, "Clean Mascot Source width must be recorded as 192.");
assertTrue(rig.source?.metadata?.height === 192, "Clean Mascot Source height must be recorded as 192.");
assertTrue(rig.source?.metadata?.pixelFormat === "Format32bppArgb", "Clean Mascot Source pixel format must be Format32bppArgb.");
assertTrue(Boolean(rig.source?.metadata?.hasAlpha), "Clean Mascot Source alpha metadata must be true.");

const states = Array.isArray(rig.states) ? rig.states : [];
assertSequence(states, expectedStates, `rigged.json states must be exactly: ${expectedStates.join(", ")}.`);
assertTrue(!states.includes("impact"), "impact must stay outside rigged.json states.");
assertTrue(rig.accents !== undefined && rig.accents !== null, "rigged.json must include accents.");
assertTrue(Object.prototype.hasOwnProperty.call(rig.accents || {}, "impact"), "impact must be represented under accents.");

const bones = Array.isArray(rig.bones) ? rig.bones : [];
const boneNames = bones.map((b) => b.name);
assertTrue(boneNames.length > 0, "rigged.json must include bones.");
assertTrue(new Set(boneNames).size === boneNames.length, "Bone names must be unique.");

const seenBones = new Set();
for (const bone of bones) {
  if (bone.parent) {
    assertTrue(seenBones.has(bone.parent), `Parent bone '${bone.parent}' must appear before child bone '${bone.name}'.`);
  }
  seenBones.add(bone.name);
}

const parts = Array.isArray(rig.parts) ? rig.parts : [];
const partIds = parts.map((p) => p.id);
assertSet(partIds, expectedPartIds, "rigged.json parts must match the semantic SVG part IDs.");

for (const part of parts) {
  assertTrue(expectedPartIds.includes(part.id), `Unexpected rigged.json part id: ${part.id}`);
  assertTrue(boneNames.includes(part.bone), `Part '${part.id}' references missing bone '${part.bone}'.`);
  assertTrue(nonBlank(part.origin), `Part '${part.id}' must include a CSS origin string.`);
  assertTrue(part.pivot !== undefined && part.pivot !== null, `Part '${part.id}' must include numeric pivot metadata.`);
  assertTrue(isFiniteNumber(part.pivot?.x), `Part '${part.id}' pivot.x must be numeric.`);
  assertTrue(isFiniteNumber(part.pivot?.y), `Part '${part.id}' pivot.y must be numeric.`);

  const svgPart = findGroupById(svgText, part.id);
  assertTrue(attrOf(svgPart?.attrs, "data-origin") === part.origin, `SVG data-origin for '${part.id}' must match rigged.json.`);
  assertTrue(Number(attrOf(svgPart?.attrs, "data-pivot-x")) === Number(part.pivot?.x), `SVG data-pivot-x for '${part.id}' must match rigged.json.`);
  assertTrue(Number(attrOf(svgPart?.attrs, "data-pivot-y")) === Number(part.pivot?.y), `SVG data-pivot-y for '${part.id}' must match rigged.json.`);
}

const animationStates = Object.keys(rig.animations || {});
assertSequence(animationStates, expectedStates, `rigged.json animations keys must be exactly: ${expectedStates.join(", ")}.`);

const allRecipes = [];
const keyframeNames = new Set();
for (const state of expectedStates) {
  for (const recipe of rig.animations[state] || []) {
    allRecipes.push({ state, recipe });

    for (const requiredProperty of ["part", "name", "durationMs", "timing", "iteration", "keyframes"]) {
      assertTrue(
        Object.prototype.hasOwnProperty.call(recipe, requiredProperty),
        `Animation recipe in '${state}' is missing required property '${requiredProperty}'.`
      );
      assertTrue(recipe[requiredProperty] !== null && recipe[requiredProperty] !== undefined, `Animation recipe '${recipe.name}' in '${state}' has null '${requiredProperty}'.`);
    }

    assertTrue(partIds.includes(recipe.part), `Animation recipe '${recipe.name}' references unknown part '${recipe.part}'.`);
    assertTrue(!keyframeNames.has(recipe.name), `Animation keyframe name '${recipe.name}' must be unique.`);
    keyframeNames.add(recipe.name);
    assertTrue(isFiniteNumber(recipe.durationMs), `Animation recipe '${recipe.name}' durationMs must be numeric.`);
    assertTrue(nonBlank(recipe.timing), `Animation recipe '${recipe.name}' must include timing.`);
    assertTrue(nonBlank(recipe.iteration), `Animation recipe '${recipe.name}' must include iteration.`);
    assertTrue(Array.isArray(recipe.keyframes) && recipe.keyframes.length > 0, `Animation recipe '${recipe.name}' must include at least one keyframe.`);

    for (const keyframe of recipe.keyframes) {
      assertTrue(nonBlank(keyframe.offset), `Animation recipe '${recipe.name}' has a keyframe without offset.`);
      assertTrue(nonBlank(keyframe.transform), `Animation recipe '${recipe.name}' has a keyframe without transform.`);
    }
  }
}

assertTrue(allRecipes.length === 6, "rigged.json must include the six minimal SVG+CSS motion recipes.");

// --- Schema v2: structured channels + explicit loop semantics (emitter-neutral contract) -------
const channelKeys = ["rotate", "scaleX", "scaleY", "x", "y"];
for (const entry of allRecipes) {
  const recipe = entry.recipe;
  for (const v2Property of ["ease", "repeat", "yoyo", "channels", "reducedChannel"]) {
    assertTrue(Object.prototype.hasOwnProperty.call(recipe, v2Property), `v2 recipe '${recipe.name}' is missing required property '${v2Property}'.`);
  }
  assertTrue(nonBlank(recipe.ease), `v2 recipe '${recipe.name}' must include a GSAP ease.`);
  assertTrue(typeof recipe.yoyo === "boolean", `v2 recipe '${recipe.name}' yoyo must be a boolean.`);
  assertTrue(isFiniteNumber(recipe.repeat), `v2 recipe '${recipe.name}' repeat must be numeric.`);

  const channels = Array.isArray(recipe.channels) ? recipe.channels : [];
  assertTrue(channels.length >= 2, `v2 recipe '${recipe.name}' must include at least two channel keyframes.`);
  let previousOffset = -1;
  for (const channel of channels) {
    assertTrue(isFiniteNumber(channel.offset), `v2 recipe '${recipe.name}' channel keyframe has a non-numeric offset.`);
    const offset = Number(channel.offset);
    assertTrue(offset >= previousOffset, `v2 recipe '${recipe.name}' channel offsets must be non-decreasing.`);
    previousOffset = offset;
    for (const key of channelKeys) {
      assertTrue(Object.prototype.hasOwnProperty.call(channel, key), `v2 recipe '${recipe.name}' channel keyframe missing '${key}'.`);
    }
  }
  assertTrue(Number(channels[0]?.offset) === 0, `v2 recipe '${recipe.name}' first channel offset must be 0.`);
  assertTrue(Number(channels[channels.length - 1]?.offset) === 1, `v2 recipe '${recipe.name}' last channel offset must be 1.`);
}

// Pivot is canonical and must resolve back to the accepted CSS origin (no drift between targets).
assertTrue(parts[0]?.pivot?.x !== undefined && parts[0]?.pivot?.x !== null, "Parts must carry canonical absolute pivots for the React+GSAP target.");

// reactGsap accents are an optional, Output-Target-specific block. If present, validate lightly:
// the SVG+CSS emitter ignores it, so it must not smuggle new states or unknown parts.
if (Object.prototype.hasOwnProperty.call(rig, "reactGsap")) {
  const accentStates = Object.keys(rig.reactGsap?.accents || {});
  for (const state of accentStates) {
    assertTrue(expectedStates.includes(state), `reactGsap accent state '${state}' is not an allowed Animation State.`);
    for (const accent of rig.reactGsap.accents[state] || []) {
      assertTrue(partIds.includes(accent.part), `reactGsap accent '${accent.name}' references unknown part '${accent.part}'.`);
      assertTrue(Array.isArray(accent.channels) && accent.channels.length >= 2, `reactGsap accent '${accent.name}' must include channel keyframes.`);
    }
  }
}

console.log("Group 6 (rigged.json schema v2) passed.");

// --- Shared CSS/HTML baseline assertions, reused by group 7 (manual) and group 9 (generated) ----
// so the two copies cannot drift the same way the two emitters already did once in this repo.
function assertCssBaseline(css, label, rigForBaseline, statesForBaseline) {
  assertTrue(/transform-box:\s*fill-box/.test(css), `${label} must use transform-box: fill-box.`);
  assertTrue(/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css), `${label} must include a prefers-reduced-motion reduce branch.`);
  assertTrue(/\.force-reduced-motion/.test(css), `${label} must include a forced reduced-motion selector.`);

  for (const state of statesForBaseline) {
    assertTrue(css.includes(`data-state="${state}"`), `${label} must include data-state selector for '${state}'.`);
  }
  assertTrue(!css.includes('data-state="impact"'), `${label} must not include impact as a data-state selector.`);

  for (const part of rigForBaseline.parts) {
    assertTrue(css.includes(`#${part.id}`), `${label} must include selector for #${part.id}.`);
    assertTrue(css.includes(`transform-origin: ${part.origin}`), `${label} transform-origin for '${part.id}' must match rigged.json origin '${part.origin}'.`);
  }
}

function assertQueryParamReading(html, label) {
  assertTrue(html.includes("new URLSearchParams(window.location.search)"), `${label} must read query params.`);
}

function assertReducedMotionSupport(html, label) {
  assertTrue(html.includes("reduce") && html.includes("force-reduced-motion"), `${label} must support ?reduce=1 forced reduced motion.`);
}

function assertNoImpactButton(html, label) {
  assertTrue(!html.includes('data-set-state="impact"'), `${label} must not expose impact as a state switcher button.`);
}

// --- Group 7: CSS content -----------------------------------------------------------------------
const css = readFileSync(cssPath, "utf8");
assertCssBaseline(css, "CSS", rig, expectedStates);

// --- Group 8: Demo HTML content ------------------------------------------------------------------
const demo = readFileSync(demoPath, "utf8");
assertTrue(demo.includes("devbrain-manual-part.svg"), "Demo must load the Manual Part SVG fixture.");
assertTrue(demo.includes("devbrain-svg-css.css"), "Demo must reference the SVG+CSS stylesheet.");
assertQueryParamReading(demo, "Demo");
assertReducedMotionSupport(demo, "Demo");
for (const state of expectedStates) {
  assertTrue(demo.includes(`data-set-state="${state}"`), `Demo must expose a state switcher button for '${state}'.`);
}
assertNoImpactButton(demo, "Demo");

console.log("Groups 7-8 (CSS content, demo HTML content) passed.");

// --- Group 9: the same suite again, against generated/ — proves the emitter reproduces the fixture
// Factored as a function taking a directory (per the brief) rather than pasted inline: this repo
// already shipped two emitters (SVG+CSS and React+GSAP) that drifted apart once, and two copy-pasted
// assertion blocks here would be the same failure mode waiting to happen again.
function checkGeneratedSuite(dir, ctx) {
  const { manualSvgRoot, manualSvgText, manualRectTotal: manualRects, rig: rigForSuite, expectedStates: states, expectedPartIds: ids, allRecipes: recipes } = ctx;

  const svgFilePath = join(dir, "devbrain-svg-css.generated.svg");
  const cssFilePath = join(dir, "devbrain-svg-css.generated.css");
  const demoFilePath = join(dir, "devbrain-svg-css.generated-demo.html");

  const generatedSvgText = readSvg(svgFilePath);
  const generatedSvgRoot = rootTag(generatedSvgText);

  assertTrue(attrOf(generatedSvgRoot, "id") === "mascot", "Generated SVG root must use id='mascot'.");
  assertTrue(attrOf(generatedSvgRoot, "viewBox") === attrOf(manualSvgRoot, "viewBox"), "Generated SVG must preserve the Manual Part SVG viewBox.");
  assertTrue(attrOf(generatedSvgRoot, "data-state") === "idle", "Generated SVG must default to data-state='idle'.");
  assertTrue(
    attrOf(generatedSvgRoot, "data-render-method") === attrOf(manualSvgRoot, "data-render-method"),
    "Generated SVG must preserve the Manual Part SVG render method."
  );
  assertTrue(
    attrOf(generatedSvgRoot, "data-source-bounds") === attrOf(manualSvgRoot, "data-source-bounds"),
    "Generated SVG must preserve the Manual Part SVG source bounds."
  );
  assertTrue(elements(generatedSvgText, "path").length === 0, "Generated SVG must not contain stale freehand path geometry.");
  assertTrue(
    elements(generatedSvgText, "rect").length === manualRects,
    "Generated SVG must preserve the Manual Part SVG pixel-run rect count."
  );
  assertTrue(generatedSvgText.includes("devbrain-svg-css.generated.css"), "Generated SVG must link to the generated CSS file.");
  assertTrue(findGroupById(generatedSvgText, "rig-root") !== undefined, "Generated SVG must preserve #rig-root.");

  for (const id of ids) {
    const g = findGroupById(generatedSvgText, id);
    assertTrue(g !== undefined, `Generated SVG missing semantic part id: ${id}`);
    assertTrue(/(^| )part( |$)/.test(attrOf(g.attrs, "class") || ""), `Generated SVG ${id} must include class='part'.`);
  }

  assertTrue(!hasElementWithId(generatedSvgText, "impact"), "Generated SVG must not expose impact as a semantic state or part id.");

  const generatedCss = readFileSync(cssFilePath, "utf8");
  assertCssBaseline(generatedCss, "Generated CSS", rigForSuite, states);

  for (const entry of recipes) {
    const { state, recipe } = entry;
    const animationDeclaration = `animation: ${recipe.name} ${recipe.durationMs}ms ${recipe.timing} ${recipe.iteration};`;
    assertTrue(
      generatedCss.includes(`#mascot[data-state="${state}"] #${recipe.part}`),
      `Generated CSS missing selector for '${state}' recipe '${recipe.name}'.`
    );
    assertTrue(generatedCss.includes(animationDeclaration), `Generated CSS animation declaration for '${recipe.name}' must come from rigged.json.`);
    assertTrue(generatedCss.includes(`@keyframes ${recipe.name}`), `Generated CSS missing @keyframes for '${recipe.name}'.`);

    for (const keyframe of recipe.keyframes) {
      const keyframeLine = `${keyframe.offset} { transform: ${keyframe.transform}; }`;
      assertTrue(generatedCss.includes(keyframeLine), `Generated CSS missing keyframe '${keyframeLine}' for '${recipe.name}'.`);
    }

    if (Object.prototype.hasOwnProperty.call(recipe, "reduced") && Object.prototype.hasOwnProperty.call(recipe.reduced || {}, "transform")) {
      assertTrue(
        generatedCss.includes(`transform: ${recipe.reduced.transform};`),
        `Generated CSS missing reduced transform for '${recipe.name}'.`
      );
    }
  }

  const generatedDemo = readFileSync(demoFilePath, "utf8");
  assertTrue(generatedDemo.includes("devbrain-svg-css.generated.svg"), "Generated demo must load the generated SVG file.");
  assertQueryParamReading(generatedDemo, "Generated demo");
  assertReducedMotionSupport(generatedDemo, "Generated demo");
  assertTrue(
    generatedDemo.includes('return "devbrain-svg-css.generated.svg?state=" + encodeURIComponent(state) + suffix;'),
    "Generated demo must route selected states into the generated SVG query string."
  );
  assertTrue(
    generatedDemo.includes('statusText.textContent = selectedState + (forceReduce ? " / reduced" : "");'),
    "Generated demo must render status text without broken template interpolation."
  );
  const generatedDemoStates = [...generatedDemo.matchAll(/data-set-state="([^"]+)"/g)].map((m) => m[1]);
  assertSequence(generatedDemoStates, states, "Generated demo state controls must come from rigged.json states.");
  assertNoImpactButton(generatedDemo, "Generated demo");
}

checkGeneratedSuite(generatedPath, {
  manualSvgRoot: svgRoot,
  manualSvgText: svgText,
  manualRectTotal,
  rig,
  expectedStates,
  expectedPartIds,
  allRecipes,
});

console.log("Group 9 (generated/ suite) passed.");

// --- Group 10: showcase.html reference integrity --------------------------------------------------
// Scoped to the generated*/ references it injects (catches a broken copy/path before a viewer sees a
// blank panel).
const showcasePath = join(sliceRoot, "showcase.html");
assertFile(showcasePath);
const showcase = readFileSync(showcasePath, "utf8");
const showcaseRefs = [...new Set(
  [...showcase.matchAll(/"(generated[-A-Za-z0-9_/]*\/[A-Za-z0-9._-]+\.(?:svg|css))"/g)].map((m) => m[1])
)];
assertTrue(showcaseRefs.length >= 2, "showcase.html must fetch the generated SVG+CSS for both assets.");
for (const ref of showcaseRefs) {
  // Trap 1's third instance: the source inverts '/' to '\' with a single -replace. Build the path as
  // separate segments instead — a ref like "generated/x.svg" must split on '/' before joining, never
  // via a literal-backslash string, so this still works on Linux.
  assertFile(join(sliceRoot, ...ref.split("/")));
}

console.log("Group 10 (showcase.html reference integrity) passed.");

console.log("Buildable Slice structural checks passed.");
