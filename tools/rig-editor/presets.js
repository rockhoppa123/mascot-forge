// presets.js — role-keyed animation recipe TEMPLATES, generalised from the two existing rigs
// (devbrain + land-rover). `recipeFor` stamps a template with the chosen part id at export, so a
// preset works on any named part (the Land Rover fix: wheel=limb, flag=accent, no forced names).
//
// [H] OWNER TUNING: the motion *values* below are agent-derived from devbrain-rigged.json. Final
// feel is Andrew's to tune — edit the templates here; the structure is the contract, the numbers
// are taste. Roles never touch the locked schema; they only choose which template gets written.
//
// Shape per template = a schema-v2 recipe minus { part, name } (added by recipeFor): durationMs,
// timing, iteration, ease, repeat, yoyo, keyframes[] (SVG+CSS), channels[] (React+GSAP), reduced,
// reducedChannel. Picker offers presets by [role][state].

export const PRESETS = {
  core: {
    idle: {
      breathe: {
        durationMs: 1800, timing: "ease-in-out", iteration: "infinite",
        ease: "sine.inOut", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "scale(1)" },
          { offset: "50%", transform: "scale(.985, 1.035)" },
        ],
        channels: [
          { offset: 0, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.5, rotate: 0, scaleX: 0.985, scaleY: 1.035, x: 0, y: 0 },
          { offset: 1, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "scale(1)" },
        reducedChannel: { rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      },
    },
  },
  limb: {
    active: {
      walk: {
        durationMs: 520, timing: "ease-in-out", iteration: "infinite",
        ease: "sine.inOut", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "rotate(14deg)" },
          { offset: "50%", transform: "rotate(-18deg)" },
        ],
        channels: [
          { offset: 0, rotate: 14, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.5, rotate: -18, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 1, rotate: 14, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "rotate(10deg)" },
        reducedChannel: { rotate: 10, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      },
      "walk-mirror": {
        durationMs: 520, timing: "ease-in-out", iteration: "infinite",
        ease: "sine.inOut", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "rotate(-14deg)" },
          { offset: "50%", transform: "rotate(18deg)" },
        ],
        channels: [
          { offset: 0, rotate: -14, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.5, rotate: 18, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 1, rotate: -14, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "rotate(-10deg)" },
        reducedChannel: { rotate: -10, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      },
    },
  },
  accent: {
    idle: {
      blink: {
        durationMs: 4200, timing: "step-end", iteration: "infinite",
        ease: "none", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 92%, 100%", transform: "scaleY(1)" },
          { offset: "94%, 96%", transform: "scaleY(.12)" },
        ],
        channels: [
          { offset: 0, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.92, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.94, rotate: 0, scaleX: 1, scaleY: 0.12, x: 0, y: 0 },
          { offset: 0.96, rotate: 0, scaleX: 1, scaleY: 0.12, x: 0, y: 0 },
          { offset: 1, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: {},
        reducedChannel: {},
      },
    },
    alert: {
      pulse: {
        durationMs: 420, timing: "ease-in-out", iteration: "infinite",
        ease: "sine.inOut", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "scale(1)" },
          { offset: "50%", transform: "scale(1.16)" },
        ],
        channels: [
          { offset: 0, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.5, rotate: 0, scaleX: 1.16, scaleY: 1.16, x: 0, y: 0 },
          { offset: 1, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "scale(1.08)" },
        reducedChannel: { rotate: 0, scaleX: 1.08, scaleY: 1.08, x: 0, y: 0 },
      },
      recoil: {
        durationMs: 360, timing: "cubic-bezier(.2, .8, .2, 1)", iteration: "infinite",
        ease: "power2.out", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "translateX(0)" },
          { offset: "45%", transform: "translateX(-5px)" },
        ],
        channels: [
          { offset: 0, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.45, rotate: 0, scaleX: 1, scaleY: 1, x: -5, y: 0 },
          { offset: 1, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "translateX(-4px)" },
        reducedChannel: { rotate: 0, scaleX: 1, scaleY: 1, x: -4, y: 0 },
      },
    },
  },
  passive: {},
};

export function presetsFor(role, state) {
  const byState = PRESETS[role];
  if (!byState || !byState[state]) return [];
  return Object.keys(byState[state]);
}

export function recipeFor(role, state, presetName, partId) {
  const template = PRESETS[role] && PRESETS[role][state] && PRESETS[role][state][presetName];
  if (!template) throw new Error(`recipeFor: no preset '${presetName}' for role '${role}' in state '${state}'.`);
  // deep clone the template so callers can't mutate the shared definition, then stamp identity.
  const recipe = structuredClone(template);
  recipe.part = partId;
  recipe.name = `${partId}__${presetName}`;
  return recipe;
}
