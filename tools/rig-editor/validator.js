// validator.js — pre-flight the load-bearing rigged.json v2 invariants in the browser so the
// operator gets an instant, clear reason before export. NOT a second source of truth:
// tools/gate/check-buildable-slice.mjs (`mf check`) stays canonical. Dependency-free; pure.
//
// The 6 invariants (subset of check-buildable-slice.mjs that the editor can break):
//   1. version === 2
//   2. states is a non-empty array
//   3. each part has an id, a CSS origin string, and a numeric pivot {x, y}
//   4. states are open: any declared state is allowed, and animations declare no undeclared state.
//      The rig must have >= 1 animation overall (else error); a declared state with no recipe WARNS
//      (it animates as inert) rather than failing — so partial/custom state sets are allowed.
//   5. every recipe carries part/name/durationMs/timing/iteration/keyframes
//   6. every recipe.part references a real parts[] id

export function validate(rig) {
  const errors = [];
  const warnings = [];
  const fail = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  if (!rig || typeof rig !== "object") return { ok: false, errors: ["rig is not an object"], warnings: [] };

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
  let totalRecipes = 0;
  for (const s of states) {
    const recipes = Array.isArray(anim[s]) ? anim[s] : [];
    if (recipes.length === 0) { warn(`state '${s}' has no animation recipe — it will render inert`); continue; }
    totalRecipes += recipes.length;
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
  if (totalRecipes === 0) fail("rig has no animation in any state — at least one state needs a recipe");
  for (const k of Object.keys(anim)) {
    if (!states.includes(k)) fail(`animations has state '${k}' not declared in states`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
