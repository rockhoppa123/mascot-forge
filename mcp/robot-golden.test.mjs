// Freshness + sanity golden for the committed layered-path artifact (docs/buildable-slice/layered-robot/),
// the layered-SVG counterpart to smiley-golden.test.mjs (which gates the raster path's committed hero).
//
// Why this exists: smiley-golden.test.mjs's own header records what happens when a regenerable artifact
// ships WITHOUT a freshness gate — the committed mcp-smiley SVG silently rotted two feature waves behind
// the engine, shipping with part-eyes' transform-origin at "50% 240%" (a scale origin 7 units BELOW a
// 5-unit-tall part), because its pivot was defaulted once and never recomputed. Every blink yanked the
// eyes ~10.6 units down, 12% of the frame, into the middle of the face. This file exists so the layered
// path's committed artifact (docs/buildable-slice/layered-robot/) can never rot the same way ungated:
// the generator, the artifact and this gate ship in one commit, per task-1-brief.md.
//
// Run: `node mcp/robot-golden.test.mjs`
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRobot } from "./build-robot-demo.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const committedDir = join(here, "..", "docs", "buildable-slice", "layered-robot");
const norm = (s) => s.replace(/\r\n/g, "\n");

// --- 1. FRESHNESS: the committed artifact must equal a fresh build from the same recipe -----------
// Inside the repo's gitignored out/, not the OS temp dir: safePath() deliberately refuses any path
// outside the project root, and that guard is worth keeping.
const tmpRel = `out/_robot-freshness-${process.pid}`;
const tmp = join(here, "..", tmpRel);
try {
  mkdirSync(tmp, { recursive: true });
  buildRobot({ outDir: tmpRel });
  for (const name of ["robot-mascot.svg", "robot-mascot-demo.html"]) {
    const fresh = readFileSync(join(tmp, name), "utf8");
    const committed = readFileSync(join(committedDir, name), "utf8");
    assert.equal(norm(committed), norm(fresh),
      `${name} is STALE — re-run \`node mcp/build-robot-demo.mjs\` and commit the result. ` +
      `The engine has moved on and the committed robot artifact no longer matches what it emits.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 2. SANITY: no emitted part may scale/rotate about a point far outside its own box ------------
// Defence in depth: catches this class of pivot defect in the committed layered mascot, even if the
// freshness check above doesn't cover it. transform-box is fill-box, so a percentage far outside
// 0..100 means the part pivots off itself and visibly detaches when animated. The bound is
// deliberately loose — a limb legitimately hinges at 0% (its joint) and an antenna at 100% (its base).
const LO = -25, HI = 125;
{
  const svg = readFileSync(join(committedDir, "robot-mascot.svg"), "utf8");
  const groups = [...svg.matchAll(/<g id="(part-[^"]+)"[^>]*data-origin="([\d.-]+)%\s+([\d.-]+)%"/g)];
  assert.ok(groups.length, "layered-robot/robot-mascot.svg: found no part groups with a data-origin to check");
  for (const [, id, px, py] of groups) {
    for (const [axis, v] of [["x", +px], ["y", +py]]) {
      assert.ok(v >= LO && v <= HI,
        `layered-robot/robot-mascot.svg: ${id} transform-origin ${axis}=${v}% is outside ${LO}..${HI}% — it ` +
        `pivots off its own box and will visibly detach when animated (a stale pivot survived a re-carve).`);
    }
  }
}

console.log("robot-golden.test.mjs: layered artifact fresh + every emitted pivot within its own box.");
