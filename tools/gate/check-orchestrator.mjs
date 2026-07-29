// check-orchestrator.mjs — port of tools/check-orchestrator.ps1 (P4).
//
// Structural checks for the Phase 4 State Orchestrator: the runtime API surface is present, the demo
// wires the core to the generated SVG, the demo's state list is derived from rigged.json rather than
// hardcoded separately, the React hook wraps the same core, no leftover markers, and the runtime's own
// node self-check is green.
//
// Usage: node tools/gate/check-orchestrator.mjs [--root <dir>]
// --root aims every relative path at a copied tree, which is what lets the mutation matrix prove these
// assertions still have teeth without ever touching a committed file.
//
// PORT NOTE — string comparison. PowerShell's `.Contains()` on a String is ordinal and case-SENSITIVE
// (unlike its `-eq`/`-match`/`-contains` operators, which are case-insensitive by default and made the
// other three checkers' ports stricter than their originals). So the substring assertions here are
// faithful, not tightened. Do not "fix" them in either direction.
import { existsSync, statSync, readFileSync } from "node:fs";
import { join, isAbsolute, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function fail(message) {
  throw new Error(`orchestrator check failed: ${message}`);
}
function assertTrue(condition, message) {
  if (!condition) fail(message);
}

const argv = process.argv.slice(2);
const rootFlag = argv.indexOf("--root");
const repoRoot = rootFlag !== -1 && argv[rootFlag + 1]
  ? argv[rootFlag + 1]
  : join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const resolveRepoPath = (p) => (isAbsolute(p) ? p : join(repoRoot, ...p.split("/")));

// Same defaults as the .ps1's param() block.
const core = resolveRepoPath("runtime/mascot-state.js");
const test = resolveRepoPath("runtime/mascot-state.test.mjs");
const demo = resolveRepoPath("docs/buildable-slice/orchestrator-demo.html");
const hook = resolveRepoPath("tools/emit-react-gsap/src/useMascotState.ts");
const rigPath = resolveRepoPath("docs/buildable-slice/devbrain-rigged.json");

// --- 1. Required files exist -----------------------------------------------------------------
for (const p of [core, test, demo, hook, rigPath]) {
  assertTrue(existsSync(p) && statSync(p).isFile(), `Missing required file: ${p}`);
}

// --- 2-3. Core: the documented runtime API surface is present ---------------------------------
const coreText = readFileSync(core, "utf8");
for (const symbol of [
  "export function createMascot", "setState", "bind", "getState", "destroy",
  "export function pollJson", "export function fromEvents",
]) {
  assertTrue(coreText.includes(symbol), `Core must expose '${symbol}'.`);
}
assertTrue(coreText.includes("dataset.state"), "Core must drive the existing data-state surface (root.dataset.state).");

// --- 4. States come from rigged.json (no separate states manifest) -----------------------------
const rig = JSON.parse(readFileSync(rigPath, "utf8"));
const states = rig.states || [];
assertTrue(states.length >= 1, "rigged.json must declare states.");

// --- 5-6. Demo: wires the core + the locked generated SVG, states match rigged.json ------------
const demoText = readFileSync(demo, "utf8");
assertTrue(demoText.includes("../../runtime/mascot-state.js"), "Demo must import the orchestrator core.");
assertTrue(demoText.includes("createMascot"), "Demo must create a mascot from the core.");
assertTrue(demoText.includes("devbrain-svg-css.generated.svg"), "Demo must reuse the generated SVG Output Target.");
assertTrue(demoText.includes(".bind("), "Demo must bind a source (reacts to live data).");
// Built from rigged.json at runtime, never hardcoded here — that derivation IS the assertion: it ties
// the demo's state list to the rig's, so adding a state to one without the other fails the gate.
const demoStatesLiteral = `[${states.map((s) => `"${s}"`).join(", ")}]`;
assertTrue(
  demoText.includes(demoStatesLiteral),
  `Demo STATES must match rigged.json states exactly: ${demoStatesLiteral}.`
);

// --- 7. React hook: wraps the same core --------------------------------------------------------
const hookText = readFileSync(hook, "utf8");
assertTrue(hookText.includes("useMascotState"), "Hook must export useMascotState.");
assertTrue(hookText.includes("runtime/mascot-state.js"), "Hook must wrap the same orchestrator core.");

// --- 8. No regressions of the YAGNI guard: no npm at the repo root ------------------------------
assertTrue(
  !existsSync(join(repoRoot, "package.json")),
  "Root package.json must not be created by Phase 4."
);

// --- 9. Scan changed Phase 4 files for leftover markers ----------------------------------------
for (const p of [core, test, demo, hook]) {
  const body = readFileSync(p, "utf8");
  for (const marker of ["TODO", "TBD", "FIXME"]) {
    assertTrue(!body.includes(marker), `${basename(p)} contains a leftover '${marker}' marker.`);
  }
}

// --- 10. Deterministic core self-check (node:assert, zero npm) ---------------------------------
// The .ps1 shelled out to `node` and checked $LASTEXITCODE plus stdout. spawnSync is the direct
// equivalent, and is the one assertion that gets SIMPLER in Node rather than harder.
const run = spawnSync("node", [test], { encoding: "utf8" });
assertTrue(run.error === undefined, `node is required to run the orchestrator self-check: ${run.error && run.error.message}`);
assertTrue(run.status === 0, `node self-check failed (exit ${run.status}).`);
assertTrue(
  `${run.stdout}\n${run.stderr}`.includes("all assertions passed"),
  "node self-check did not report success."
);

console.log("orchestrator structural checks passed.");
console.log(`  states : ${states.join(", ")}`);
console.log("  files  : core, test, demo, hook all present; self-check green");
