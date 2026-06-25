// Self-check for preset -> recipe generation. A (role, state, presetName, partId) must produce a
// schema-v2 recipe (the check-buildable-slice invariants) parameterised by the chosen part id, not
// a copy with a hard-coded id. Run: `node tools/rig-editor/presets.test.mjs`.
import assert from "node:assert/strict";
import { presetsFor, recipeFor, PRESETS } from "./presets.js";

// the picker offers only role-appropriate presets per state
assert.deepEqual(presetsFor("core", "idle"), ["breathe"]);
assert.ok(presetsFor("limb", "active").includes("walk"));
assert.ok(presetsFor("accent", "alert").includes("pulse"));
assert.deepEqual(presetsFor("passive", "idle"), [], "passive parts have no presets");
assert.deepEqual(presetsFor("core", "active"), [], "a core preset is idle-only");

const required = ["part", "name", "durationMs", "timing", "iteration", "keyframes"];
const v2 = ["ease", "repeat", "yoyo", "channels", "reducedChannel"];

function assertValidRecipe(rec, partId) {
  for (const k of required) assert.ok(rec[k] !== undefined && rec[k] !== null, `recipe has ${k}`);
  for (const k of v2) assert.ok(rec[k] !== undefined, `recipe has v2 ${k}`);
  assert.equal(rec.part, partId, "recipe references the chosen part");
  assert.ok(rec.name.includes(partId), "recipe name is parameterised by the part id");
  assert.equal(typeof rec.yoyo, "boolean");
  assert.ok(Array.isArray(rec.keyframes) && rec.keyframes.length >= 1);
  assert.ok(rec.channels.length >= 2, "at least two channel keyframes");
  assert.equal(Number(rec.channels[0].offset), 0, "first channel offset 0");
  assert.equal(Number(rec.channels[rec.channels.length - 1].offset), 1, "last channel offset 1");
  for (const kf of rec.keyframes) {
    assert.ok(kf.offset && kf.transform, "keyframe has offset + transform");
  }
}

const a = recipeFor("core", "idle", "breathe", "part-cabin");
assertValidRecipe(a, "part-cabin");

// parameterisation: a different part id yields a different, valid recipe of the same shape
const b = recipeFor("core", "idle", "breathe", "part-hull");
assertValidRecipe(b, "part-hull");
assert.notEqual(a.name, b.name, "names are unique per part");
assert.equal(a.durationMs, b.durationMs, "same preset = same motion params");

// limb walk on an arbitrary vehicle part (the Land Rover fix: no forced devbrain names)
assertValidRecipe(recipeFor("limb", "active", "walk", "part-front-wheel"), "part-front-wheel");

// anatomy presets: tails wag (limb/active), ears/antennae twitch (accent/idle)
assert.ok(presetsFor("limb", "active").includes("wag"), "wag offered for limbs (tails)");
assert.ok(presetsFor("accent", "idle").includes("twitch"), "twitch offered for accents (ears)");
assertValidRecipe(recipeFor("limb", "active", "wag", "part-tail"), "part-tail");
assertValidRecipe(recipeFor("accent", "idle", "twitch", "part-ear-left"), "part-ear-left");

// unknown combos throw rather than emit a broken recipe
assert.throws(() => recipeFor("core", "active", "breathe", "part-x"), /preset/);
assert.throws(() => recipeFor("limb", "active", "nope", "part-x"), /preset/);

assert.ok(PRESETS.core && PRESETS.limb && PRESETS.accent && PRESETS.passive, "all four roles keyed");

// subject-aware families (Phase 2a) -----------------------------------------------------------
// wheel spins continuously (360deg, linear, repeat) — the land-rover fix. "wheel" is a KIND that
// resolves to its family (limb).
{
  const spin = recipeFor("wheel", "active", "spin", "part-wheel");
  assertValidRecipe(spin, "part-wheel");
  assert.ok(spin.keyframes.some((k) => /rotate\(360deg\)/.test(k.transform)), "spin reaches 360deg");
  assert.equal(spin.timing, "linear", "spin is linear (constant angular velocity)");
}
// new generic presets exist and stamp valid recipes
for (const [role, state, name] of [["accent", "alert", "shake"], ["accent", "active", "bounce"], ["accent", "alert", "nod"]]) {
  assert.ok(presetsFor(role, state).includes(name), `${name} offered for ${role}/${state}`);
  assertValidRecipe(recipeFor(role, state, name, "part-x"), "part-x");
}
// existing role-keyed lookups are unchanged (back-compat: kind overlay, not replacement)
assert.deepEqual(presetsFor("core", "idle"), ["breathe"], "core/idle still exactly breathe");
assert.deepEqual(presetsFor("core", "active"), [], "core/active still empty");

console.log("presets.test.mjs: all assertions passed.");
