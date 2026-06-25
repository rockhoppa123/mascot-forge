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

// channel helper — every channel keyframe carries the full transform vector (rotate/scale/x/y).
const ch = (offset, { r = 0, sx = 1, sy = 1, x = 0, y = 0 } = {}) => ({ offset, rotate: r, scaleX: sx, scaleY: sy, x, y });

// Subject-aware motion templates (Phase 2a). Pure whole-part CSS transforms (no mesh, no path-split).
// Shared by reference across the limb/accent families so a kind (wheel/flag/mouth) resolves real
// motion; recipeFor names each recipe by the chosen preset key, so one template can sit in many slots.
const SPIN = { // wheel: continuous 360deg, constant velocity — the land-rover wheels-rock fix
  durationMs: 1100, timing: "linear", iteration: "infinite", ease: "none", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%", transform: "rotate(0deg)" }, { offset: "100%", transform: "rotate(360deg)" }],
  channels: [ch(0, { r: 0 }), ch(1, { r: 360 })],
  reduced: {}, reducedChannel: {},
};
const WAVE = { // flag: a slow wide whole-part sway
  durationMs: 1200, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "rotate(-6deg)" }, { offset: "50%", transform: "rotate(6deg)" }],
  channels: [ch(0, { r: -6 }), ch(0.5, { r: 6 }), ch(1, { r: -6 })],
  reduced: { transform: "rotate(0deg)" }, reducedChannel: ch(0, {}),
};
const TALK = { // mouth: quick open/close on the vertical axis
  durationMs: 320, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "scaleY(1)" }, { offset: "50%", transform: "scaleY(.6)" }],
  channels: [ch(0, { sy: 1 }), ch(0.5, { sy: 0.6 }), ch(1, { sy: 1 })],
  reduced: {}, reducedChannel: {},
};
const BOUNCE = {
  durationMs: 700, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "translateY(0)" }, { offset: "50%", transform: "translateY(-12px)" }],
  channels: [ch(0, {}), ch(0.5, { y: -12 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const SHAKE = {
  durationMs: 420, timing: "ease-in-out", iteration: "infinite", ease: "power1.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "translateX(0)" }, { offset: "25%", transform: "translateX(-4px)" }, { offset: "75%", transform: "translateX(4px)" }],
  channels: [ch(0, {}), ch(0.25, { x: -4 }), ch(0.75, { x: 4 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const NOD = {
  durationMs: 900, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "rotate(0deg)" }, { offset: "50%", transform: "rotate(10deg)" }],
  channels: [ch(0, {}), ch(0.5, { r: 10 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const FLOAT = {
  durationMs: 2600, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "translateY(0)" }, { offset: "50%", transform: "translateY(-6px)" }],
  channels: [ch(0, {}), ch(0.5, { y: -6 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const JUMP = {
  durationMs: 800, timing: "cubic-bezier(.3, .7, .4, 1)", iteration: "infinite", ease: "power2.out", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "translateY(0)" }, { offset: "40%", transform: "translateY(-20px)" }],
  channels: [ch(0, {}), ch(0.4, { y: -20 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};
const WOBBLE = {
  durationMs: 600, timing: "ease-in-out", iteration: "infinite", ease: "sine.inOut", repeat: -1, yoyo: false,
  keyframes: [{ offset: "0%, 100%", transform: "rotate(0deg)" }, { offset: "30%", transform: "rotate(-6deg)" }, { offset: "70%", transform: "rotate(6deg)" }],
  channels: [ch(0, {}), ch(0.3, { r: -6 }), ch(0.7, { r: 6 }), ch(1, {})],
  reduced: {}, reducedChannel: {},
};

// A kind is an optional subject overlay over a role; it resolves to the role family that owns its
// presets. limb/accent are both roles and kinds → resolve to themselves via PRESETS first.
const KIND_FAMILY = { wheel: "limb", flag: "accent", mouth: "accent", eye: "accent", limb: "limb", body: "core", accent: "accent" };
function resolveFamily(roleOrKind) {
  if (PRESETS[roleOrKind]) return roleOrKind;            // already a role
  return KIND_FAMILY[roleOrKind] || roleOrKind;          // a kind → its family (else pass through to fail)
}

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
      // anatomy preset: a tail/flag wags faster and wider than a walking leg, pivoting at its base.
      wag: {
        durationMs: 360, timing: "ease-in-out", iteration: "infinite",
        ease: "sine.inOut", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 100%", transform: "rotate(-22deg)" },
          { offset: "50%", transform: "rotate(22deg)" },
        ],
        channels: [
          { offset: 0, rotate: -22, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.5, rotate: 22, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 1, rotate: -22, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: { transform: "rotate(12deg)" },
        reducedChannel: { rotate: 12, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      },
      // subject-aware + generic movers (shared templates) — wheel->spin, plus motion any limb can use.
      spin: SPIN, bounce: BOUNCE, shake: SHAKE, nod: NOD, float: FLOAT, jump: JUMP, wobble: WOBBLE,
    },
  },
  accent: {
    idle: {
      // anatomy preset: ears/antennae twitch — a quick rotational flick, not an eye blink.
      twitch: {
        durationMs: 3200, timing: "ease-in-out", iteration: "infinite",
        ease: "power2.out", repeat: -1, yoyo: false,
        keyframes: [
          { offset: "0%, 88%, 100%", transform: "rotate(0deg)" },
          { offset: "92%", transform: "rotate(-9deg)" },
          { offset: "96%", transform: "rotate(6deg)" },
        ],
        channels: [
          { offset: 0, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.88, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.92, rotate: -9, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 0.96, rotate: 6, scaleX: 1, scaleY: 1, x: 0, y: 0 },
          { offset: 1, rotate: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
        ],
        reduced: {},
        reducedChannel: {},
      },
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
    active: {
      // mouth->talk, plus generic movers usable by any accent part.
      talk: TALK, bounce: BOUNCE, float: FLOAT, jump: JUMP,
    },
    alert: {
      // flag->wave + alert-flavoured generic movers.
      wave: WAVE, shake: SHAKE, nod: NOD, wobble: WOBBLE,
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

// A kind's signature [state, presetName] — the motion that makes it read as itself. Single source of
// truth for both the MCP auto-fill (defaultPresetFor) and the browser editor's kind selector, so the
// two can't drift. Kinds without a signature (limb/eye/body/accent) fall back to role-based defaults.
const KIND_DEFAULT = { wheel: ["active", "spin"], flag: ["alert", "wave"], mouth: ["active", "talk"] };
export function kindDefaultPreset(kind) {
  return KIND_DEFAULT[kind] ? [...KIND_DEFAULT[kind]] : null;
}

export function presetsFor(roleOrKind, state) {
  const byState = PRESETS[resolveFamily(roleOrKind)];
  if (!byState || !byState[state]) return [];
  return Object.keys(byState[state]);
}

export function recipeFor(roleOrKind, state, presetName, partId) {
  const role = resolveFamily(roleOrKind);
  const template = PRESETS[role] && PRESETS[role][state] && PRESETS[role][state][presetName];
  if (!template) throw new Error(`recipeFor: no preset '${presetName}' for role '${roleOrKind}' in state '${state}'.`);
  // deep clone the template so callers can't mutate the shared definition, then stamp identity.
  const recipe = structuredClone(template);
  recipe.part = partId;
  recipe.name = `${partId}__${presetName}`;
  return recipe;
}
