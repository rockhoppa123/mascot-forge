// Freshness + sanity golden for the committed hero artifact (docs/buildable-slice/mcp-smiley/), the
// agent-rigged mascot behind mcp-live-demo.html — the demo README calls "the hero".
//
// Why this exists: that artifact is REGENERABLE but was ungated, so it silently rotted two feature
// waves behind the engine. It shipped with part-eyes' transform-origin at "50% 240%" — a scale origin
// 7 units BELOW a 5-unit-tall part — because its pivot was defaulted against the auto-segmenter's
// 78-wide "eyes" band (eyes + both hands) and never recomputed after assign_region carved the hands
// out. exporter.js gained a stale-pivot guard that fixes exactly this, but the committed file predated
// it. Every blink yanked the eyes ~10.6 units down, 12% of the frame, into the middle of the face.
//
// Run: `node mcp/smiley-golden.test.mjs`
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSmiley } from "./build-smiley-demo.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const committedDir = join(here, "..", "docs", "buildable-slice", "mcp-smiley");
const norm = (s) => s.replace(/\r\n/g, "\n");

// --- 1. FRESHNESS: the committed artifact must equal a fresh build from the same recipe -----------
// Inside the repo's gitignored out/, not the OS temp dir: safePath() deliberately refuses any path
// outside the project root, and that guard is worth keeping.
const tmpRel = `out/_smiley-freshness-${process.pid}`;
const tmp = join(here, "..", tmpRel);
try {
  mkdirSync(tmp, { recursive: true });
  buildSmiley({ outDir: tmpRel });
  for (const name of ["smiley-mascot.svg", "smiley-mascot-demo.html"]) {
    const fresh = readFileSync(join(tmp, name), "utf8");
    const committed = readFileSync(join(committedDir, name), "utf8");
    assert.equal(norm(committed), norm(fresh),
      `${name} is STALE — re-run \`node mcp/build-smiley-demo.mjs\` and commit the result. ` +
      `The engine has moved on and the committed hero artifact no longer matches what it emits.`);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- 2. SANITY: no emitted part may scale/rotate about a point far outside its own box ------------
// Defence in depth: catches this class of pivot defect in ANY committed emitted mascot, even one the
// freshness check above doesn't cover. transform-box is fill-box, so a percentage far outside 0..100
// means the part pivots off itself and visibly detaches when animated. The bound is deliberately
// loose — a limb legitimately hinges at 0% (its joint) and an antenna at 100% (its base).
const LO = -25, HI = 125;
for (const rel of [
  "mcp-smiley/smiley-mascot.svg",                                  // the MCP/agent-rigged hero
  "generated/devbrain-svg-css.generated.svg",                      // the flagship showoff asset
  "generated-land-rover/land-rover-svg-css.generated.svg",         // the second-asset proof
]) {
  const svg = readFileSync(join(here, "..", "docs", "buildable-slice", rel), "utf8");
  const groups = [...svg.matchAll(/<g id="(part-[^"]+)"[^>]*data-origin="([\d.-]+)%\s+([\d.-]+)%"/g)];
  assert.ok(groups.length, `${rel}: found no part groups with a data-origin to check`);
  for (const [, id, px, py] of groups) {
    for (const [axis, v] of [["x", +px], ["y", +py]]) {
      assert.ok(v >= LO && v <= HI,
        `${rel}: ${id} transform-origin ${axis}=${v}% is outside ${LO}..${HI}% — it pivots off its own ` +
        `box and will visibly detach when animated (a stale pivot survived a re-carve).`);
    }
  }
}

console.log("smiley-golden.test.mjs: hero artifact fresh + every emitted pivot within its own box.");
