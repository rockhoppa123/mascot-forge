// Self-check for the in-browser pre-flight validator. It re-implements the ~6 load-bearing
// rigged.json v2 invariants from tools/check-buildable-slice.ps1 as a convenience gate; the
// PowerShell `mf check` stays canonical. Run: `node tools/rig-editor/validator.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validate } from "./validator.js";

const here = dirname(fileURLToPath(import.meta.url));
const rigPath = join(here, "..", "..", "docs", "buildable-slice", "devbrain-rigged.json");
const goodRig = JSON.parse(readFileSync(rigPath, "utf8"));

// the committed golden passes
const ok = validate(goodRig);
assert.equal(ok.ok, true, `committed devbrain rig must pass: ${ok.errors.join("; ")}`);
assert.deepEqual(ok.errors, []);

function brokenWith(mutate) {
  const r = JSON.parse(JSON.stringify(goodRig));
  mutate(r);
  return validate(r);
}

// recipe referencing a missing part -> fails, naming the part (the plan's named failure case)
{
  const res = brokenWith((r) => (r.animations.idle[0].part = "part-ghost"));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => /part-ghost/.test(e)), "error names the missing part");
}

// wrong schema version
assert.equal(brokenWith((r) => (r.version = 1)).ok, false);

// empty states
assert.equal(brokenWith((r) => (r.states = [])).ok, false);

// a state with zero recipes
assert.equal(brokenWith((r) => (r.animations.alert = [])).ok, false);

// non-numeric pivot
assert.equal(brokenWith((r) => (r.parts[0].pivot = { x: "oops", y: 1 })).ok, false);

// part missing an origin
assert.equal(brokenWith((r) => delete r.parts[0].origin).ok, false);

console.log("validator.test.mjs: all assertions passed.");
