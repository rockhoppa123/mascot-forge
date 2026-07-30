// check-all.mjs — the canonical regression gate. One command that runs every pipeline check,
// fail-fast, with a per-check summary. Pure Node, zero dependencies, no build step: a contributor on
// any OS can verify this repo with the toolchain a JS project already requires.
//
// This replaces tools/check-all.ps1 as the real gate; that script survives as a thin shim because
// `mf.ps1 check`, CONTRIBUTING and existing muscle memory all invoke it, and because its exact
// "RESULT: PASS" line is asserted by docs and CI. Both entry points must print identical output.
//
// Structure deliberately mirrors the PowerShell it replaces — an ordered list of named checks, run in
// sequence, fail-fast on the first non-zero exit — so the two can be compared row by row.
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const gate = (name) => join(repoRoot, "tools", "gate", name);
const nodeTest = (...seg) => join(repoRoot, ...seg);

// Run one node script; a row fails when the child exits non-zero. stdio is inherited so each check's
// own output reaches the terminal exactly as it did under PowerShell.
function run(scriptPath, args = []) {
  return spawnSync("node", [scriptPath, ...args], { stdio: "inherit" }).status === 0;
}

// Run several node self-checks in sequence, stopping at the first failure — the same shape as the
// PowerShell's `foreach ($t in ...) { & node ...; if ($LASTEXITCODE -ne 0) { break } }` rows.
function runAll(dir, names) {
  for (const n of names) {
    if (!run(nodeTest(...dir, `${n}.test.mjs`))) return false;
  }
  return true;
}

// ponytail: ordered list of (name, run); add a row here if a new phase check ever lands.
// The test-file lists are copied verbatim from the PowerShell's P5/P6/P7 rows — a dropped entry is a
// silently weakened gate, which is exactly the failure mode this repo keeps hitting.
const checks = [
  { name: "P1 flat-svg", run: () => run(gate("check-flat-svg.mjs")) },
  { name: "P2 segmented", run: () => run(gate("check-segmented.mjs")) },
  { name: "P3 slice", run: () => run(gate("check-buildable-slice.mjs")) },
  { name: "P3 land-rover-emit", run: () => run(gate("emit-land-rover.mjs")) },
  { name: "P4 orchestrator", run: () => run(gate("check-orchestrator.mjs")) },
  { name: "P4 determinism", run: () => run(nodeTest("runtime", "mascot-state.test.mjs")) },
  {
    name: "P5 rig-editor", // browser rig editor: all pure-logic node self-checks (model -> exporter golden)
    run: () => runAll(["tools", "rig-editor"], [
      "model", "loader", "pivot", "presets", "validator", "exporter", "select",
      "vectorize", "segment", "segment-quality", "path-bbox", "layer-ingest", "emit", "grade",
    ]),
  },
  {
    name: "P6 mcp", // MCP tool chain + VTracer integration node self-checks (deps in mcp/node_modules)
    run: () => runAll(["mcp"], [
      "tools", "server", "protocol", "vectorize-vtracer", "regions-preview", "smiley-golden", "robot-golden",
    ]),
  },
  {
    name: "P7 react-gsap", // second Output Target: pure-core golden + the cross-target pivot proof
    run: () => runAll(["tools", "emit-react-gsap"], ["emit-react", "cross-target-pivot"]),
  },
  // Docs are part of the product here — the README is the pitch and the guides are the contract. 25
  // broken relative links shipped because nothing checked them.
  { name: "P8 docs-links", run: () => run(gate("check-links.mjs")) },
];

const results = [];
let failed = false;
for (const c of checks) {
  console.log(`--- ${c.name} ---`);
  const ok = c.run();
  results.push({ name: c.name, ok });
  if (!ok) { failed = true; break; } // fail-fast on first non-zero exit
}

console.log("");
console.log("==== check-all summary ====");
for (const r of results) console.log(`  ${r.ok ? "✅" : "❌"} ${r.name}`);
if (failed) {
  console.log("RESULT: FAIL");
  process.exit(1);
}
console.log("RESULT: PASS (all pipeline checks green)");
console.log("  (browser e2e is separate, by design: pwsh -NoProfile -File tools/check-e2e.ps1)");
