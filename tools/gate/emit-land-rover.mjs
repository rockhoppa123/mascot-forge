// emit-land-rover.mjs — cross-asset proof: the SVG+CSS emitter is not hardcoded to one fixture.
//
// Replaces the gate row that shelled out to tools/emit-svg-css.ps1. That PowerShell script is a SECOND
// implementation of this same Output Target, kept for the `mf emit` batch path; tools/rig-editor/emit.js
// is the one the MCP server and the browser editor actually ship. The gate should prove the emitter
// that ships, which is also what makes this row runnable without PowerShell.
//
// Honest scope of the "cross-asset" claim: land-rover is a genuinely different asset — different source
// image, different geometry (236KB of manual-part SVG), and different pivots (its origins are all
// "50% 50%" where DevBrain's are hand-placed hinges like "50% 0%"). It does, however, reuse DevBrain's
// part-id vocabulary, because the segmenter's vocabulary is a fixed list. So this proves the emitter
// generalises across geometry and pivots, NOT across arbitrary part names.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { emitCss, emitAnimatedSvg, emitDemoHtml } from "../rig-editor/emit.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const base = join(root, "spikes", "03-second-asset");

const rig = JSON.parse(readFileSync(join(base, "land-rover-rigged.json"), "utf8"));
const manualSvg = readFileSync(join(base, "generated", "land-rover-manual-part.svg"), "utf8");

const css = emitCss(rig);
const animated = emitAnimatedSvg(rig, manualSvg);
const demo = emitDemoHtml(rig, animated, "land-rover");

// Assert the output is REAL, not merely produced. A row that only checked the exit code would pass on
// an emitter that returned empty strings — which is exactly how a silently-broken emitter ships, and
// this repo has shipped one before (a hero demo rotted two feature waves because nothing verified it).
const partIds = rig.parts.map((p) => p.id);
for (const id of partIds) {
  if (!css.includes(id)) throw new Error(`land-rover emit: CSS is missing part '${id}'`);
  if (!animated.includes(id)) throw new Error(`land-rover emit: animated SVG is missing part '${id}'`);
}
if (!/@keyframes/.test(css)) throw new Error("land-rover emit: CSS contains no @keyframes");
if (!animated.includes("<style>")) throw new Error("land-rover emit: animated SVG did not inline its CSS");
for (const state of rig.states) {
  if (!demo.includes(`data-s="${state}"`)) throw new Error(`land-rover emit: demo HTML has no control for state '${state}'`);
}
if (demo.length < 500) throw new Error(`land-rover emit: demo HTML is implausibly small (${demo.length} bytes)`);

// Write to a temp dir so the emit path is exercised end to end, then discard — the gate must leave no
// artifact behind, and nothing here is a golden.
const out = mkdtempSync(join(tmpdir(), "mf-lr-"));
try {
  writeFileSync(join(out, "land-rover-svg-css.generated.css"), css);
  writeFileSync(join(out, "land-rover-svg-css.generated.svg"), animated);
  writeFileSync(join(out, "land-rover-svg-css.generated-demo.html"), demo);
  console.log("land-rover cross-asset emit passed.");
  console.log(`  parts   : ${partIds.length}`);
  console.log(`  states  : ${rig.states.join(", ")}`);
  console.log(`  css     : ${css.length}b, svg: ${animated.length}b, demo: ${demo.length}b`);
} finally {
  rmSync(out, { recursive: true, force: true });
}
