// Pure pose logic for the DevBrain mascot — no React, no DOM.
// The component renders whatever this resolves; tests pin the behavior.

export const MASCOT_STATES = [
  "default",
  "thinking",
  "happy",
  "diagnostic",
  "offline",
  "asleep",
  "caution",
  "critical",
];

const STATE_ALIASES = {
  reboot: "offline",
  sleepy: "asleep",
  blocked: "caution",
  alert: "critical",
};

// Ambient loop per pose. `null` = static. Hop is a separate, rarer gesture.
const POSE_LOOPS = {
  default: "breathe",
  thinking: "think",
  happy: "breathe",
  diagnostic: "breathe",
  offline: null,
  caution: "lean",
  critical: "alert",
  asleep: "zzz",
};

const HOP_POSES = new Set(["default", "happy"]);

export function normalizeMascotState(state) {
  const aliased = STATE_ALIASES[state];
  if (aliased) return aliased;
  return MASCOT_STATES.includes(state) ? state : "default";
}

/**
 * @param {{ state?: string, paused?: boolean, reducedMotion?: boolean }} [input]
 * @returns {{ pose: string, loop: string | null, hopAllowed: boolean }}
 */
export function resolveMascotPose({ state, paused = false, reducedMotion = false } = {}) {
  const known = normalizeMascotState(state);
  const pose = paused ? "asleep" : known;

  if (reducedMotion) {
    return { pose, loop: null, hopAllowed: false };
  }

  return { pose, loop: POSE_LOOPS[pose], hopAllowed: HOP_POSES.has(pose) };
}

// Overall health severity (deriveHealthSpine state) → mascot state.
const SEVERITY_STATES = {
  ok: "happy",
  degraded: "caution",
  down: "critical",
  neutral: "default",
};

export function severityToMascotState(severity) {
  return SEVERITY_STATES[severity] ?? "default";
}

/**
 * Maps the dashboard's data-refresh liveness to a mascot state. This is the
 * dashboard mascot's ONLY job — it reflects the refresh pulse, never health
 * (the health spine owns that). Truthful by construction:
 *   - a refresh is in flight        → thinking
 *   - auto-refresh off OR tab hidden → asleep (nothing is updating)
 *   - otherwise                      → default (awake, breathing between polls)
 *
 * @param {{ enabled?: boolean, documentHidden?: boolean, refreshing?: boolean }} [liveness]
 */
export function livenessToMascotState({ enabled = true, documentHidden = false, refreshing = false } = {}) {
  if (refreshing) return "thinking";
  if (!enabled || documentHidden) return "asleep";
  return "default";
}
