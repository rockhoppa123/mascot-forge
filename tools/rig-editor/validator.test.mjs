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

// a single state with zero recipes now WARNS, not fails — open/partial state sets are allowed as
// long as the rig has >=1 animation overall (Phase 2b: open state vocabulary).
{
  const res = brokenWith((r) => (r.animations.alert = []));
  assert.equal(res.ok, true, "one empty state no longer hard-fails");
  assert.ok(res.warnings.some((w) => /alert/.test(w)), "the empty state is reported as a warning naming it");
}

// but a rig with NO animation in any state is still an error
{
  const res = brokenWith((r) => { for (const s of r.states) r.animations[s] = []; });
  assert.equal(res.ok, false, "zero animations across all states fails");
  assert.ok(res.errors.some((e) => /no animation/i.test(e)), "the error explains the rig is inert");
}

// arbitrary (non-default) state names are allowed; an empty declared state warns but validates
{
  const rig = { version: 2, source: {}, states: ["idle", "error"], bones: [{ name: "root", x: 0, y: 0 }],
    parts: [{ id: "part-body", bone: "root", origin: "50% 50%", pivot: { x: 1, y: 1 } }],
    animations: { idle: [{ part: "part-body", name: "part-body__breathe", durationMs: 1, timing: "ease", iteration: "infinite", keyframes: [{ offset: "0%", transform: "scale(1)" }] }], error: [] },
    accents: { impact: [] } };
  const v = validate(rig);
  assert.equal(v.ok, true, "a rig with >=1 animation and a custom state validates");
  assert.ok(v.warnings.some((w) => /error/.test(w)), "the empty 'error' state is a warning");
}

// the committed golden raises no warnings (all states covered)
assert.deepEqual(ok.warnings, [], "a fully-covered rig has no warnings");

// non-numeric pivot
assert.equal(brokenWith((r) => (r.parts[0].pivot = { x: "oops", y: 1 })).ok, false);

// part missing an origin
assert.equal(brokenWith((r) => delete r.parts[0].origin).ok, false);

console.log("validator.test.mjs: all assertions passed.");
