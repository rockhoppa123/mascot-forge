// validator.js — pre-flight the load-bearing rigged.json v2 invariants in the browser so the
// operator gets an instant, clear reason before export. NOT a second source of truth:
// tools/check-buildable-slice.ps1 (`mf check`) stays canonical. Dependency-free; pure.
//
// The 6 invariants (subset of check-buildable-slice.ps1 that the editor can break):
//   1. version === 2
//   2. states is a non-empty array
//   3. each part has an id, a CSS origin string, and a numeric pivot {x, y}
//   4. animations cover exactly the states, and every state has >= 1 recipe
//   5. every recipe carries part/name/durationMs/timing/iteration/keyframes
//   6. every recipe.part references a real parts[] id

export function validate(rig) {
  const errors = [];
  const fail = (m) => errors.push(m);

  if (!rig || typeof rig !== "object") return { ok: false, errors: ["rig is not an object"] };

  if (rig.version !== 2) fail(`version must be 2 (got ${JSON.stringify(rig.version)})`);

  const states = Array.isArray(rig.states) ? rig.states : [];
  if (states.length === 0) fail("states must be a non-empty array");

  const parts = Array.isArray(rig.parts) ? rig.parts : [];
  const partIds = new Set();
  if (parts.length === 0) fail("parts must be a non-empty array");
  for (const p of parts) {
    if (!p || !p.id) { fail("a part is missing its id"); continue; }
    partIds.add(p.id);
    if (typeof p.origin !== "string" || p.origin.trim() === "") fail(`part '${p.id}' must have a CSS origin string`);
    if (!p.pivot || !Number.isFinite(Number(p.pivot.x)) || !Number.isFinite(Number(p.pivot.y))) {
      fail(`part '${p.id}' must have a numeric pivot {x, y}`);
    }
  }

  const anim = rig.animations && typeof rig.animations === "object" ? rig.animations : {};
  for (const s of states) {
    const recipes = Array.isArray(anim[s]) ? anim[s] : [];
    if (recipes.length === 0) { fail(`state '${s}' must have at least one animation recipe`); continue; }
    for (const rec of recipes) {
      for (const k of ["part", "name", "durationMs", "timing", "iteration", "keyframes"]) {
        if (rec[k] === undefined || rec[k] === null) fail(`recipe '${rec.name || "?"}' in '${s}' is missing '${k}'`);
      }
      if (!Array.isArray(rec.keyframes) || rec.keyframes.length === 0) {
        fail(`recipe '${rec.name || "?"}' in '${s}' must have >= 1 keyframe`);
      }
      if (rec.part && !partIds.has(rec.part)) {
        fail(`recipe '${rec.name || "?"}' in '${s}' references unknown part '${rec.part}'`);
      }
    }
  }
  for (const k of Object.keys(anim)) {
    if (!states.includes(k)) fail(`animations has state '${k}' not declared in states`);
  }

  return { ok: errors.length === 0, errors };
}
