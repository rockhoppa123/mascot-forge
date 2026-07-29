// build-robot-demo.mjs — regenerate the layered-SVG robot artifact, the layered-path counterpart to
// build-smiley-demo.mjs. Where the smiley demo proves start_from_image -> assign_region x N ->
// set_part x N -> forge_emit (the RASTER ingest path), this proves the LAYERED path:
// start_from_layered_svg -> set_part x N -> forge_emit, from a hand-authored, already-grouped SVG
// (assets/example-layered/robot.svg) instead of a segmented PNG. No agent involved — this drives the
// SAME tool handlers an agent would call, so the committed output is a faithful, reproducible output
// of the layered-rigging path, not hand-authored.
//
// Run from mcp/ (after `npm install`):  node build-robot-demo.mjs
// Output: ../docs/buildable-slice/layered-robot/robot-mascot.svg  (+ -demo.html, the standalone preview).
// Kept alongside mcp-smiley/, not in generated/ — that dir is the LOCKED Phase-1 buildable slice
// (allowlisted by tools/gate/check-buildable-slice.mjs); this is a separate, regenerable layered-path
// artifact, gated by its own freshness golden (robot-golden.test.mjs), not that allowlist.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startFromLayeredSvg, setPart, forgeStatus, forgeEmit } from "./tools.mjs";

const SOURCE_SVG = resolve(fileURLToPath(new URL("../assets/example-layered/robot.svg", import.meta.url)));
const DEFAULT_OUT_DIR = resolve(fileURLToPath(new URL("../docs/buildable-slice/layered-robot", import.meta.url)));

// Exported so robot-golden.test.mjs can rebuild into a temp dir and prove the COMMITTED artifact
// still matches this recipe. One recipe, two callers — the same anti-drift rule build-smiley-demo.mjs
// follows for the raster path.
export function buildRobot({ outDir = DEFAULT_OUT_DIR } = {}) {
  // 1. start from the layered SVG (the agent host would pass the user's exported layers as a string)
  const s = startFromLayeredSvg({ path: SOURCE_SVG });

  // 2. assign motion per part — legs are deliberately opposite their same-side arms (walk/walk-mirror
  // swapped left-vs-right) so a gait reads as walking rather than hopping in lockstep.
  setPart({ session: s.session, partId: "part-body", role: "core", bone: "body", presets: { idle: "breathe" } });
  setPart({ session: s.session, partId: "part-head", role: "accent", bone: "head", presets: { idle: "glance", alert: "nod" } });
  setPart({ session: s.session, partId: "part-antenna", role: "accent", bone: "antenna", presets: { idle: "twitch", alert: "pulse" } });
  setPart({ session: s.session, partId: "part-left-arm", role: "limb", bone: "arm-left", presets: { active: "walk" } });
  setPart({ session: s.session, partId: "part-right-arm", role: "limb", bone: "arm-right", presets: { active: "walk-mirror" } });
  setPart({ session: s.session, partId: "part-left-leg", role: "limb", bone: "leg-left", presets: { active: "walk-mirror" } });
  setPart({ session: s.session, partId: "part-right-leg", role: "limb", bone: "leg-right", presets: { active: "walk" } });

  const st = forgeStatus({ session: s.session });
  if (!(st.rigStatus.idle && st.rigStatus.active && st.rigStatus.alert)) {
    throw new Error(`robot rig must cover all three states: ${JSON.stringify(st.rigStatus)}`);
  }

  // 3. emit the owned, self-contained animated SVG (+ standalone demo)
  const out = forgeEmit({ session: s.session, assetName: "robot", outDir });
  if (!out.ok) throw new Error(`robot emit invalid: ${JSON.stringify(out.validation || out.error)}`);

  return { written: out.written, rigStatus: st.rigStatus };
}

// CLI entry — only when run directly, so importing this module has no side effects.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = buildRobot();
  console.error(`build-robot-demo: wrote ${r.written.join(", ")} (states ${JSON.stringify(r.rigStatus)})`);
}
