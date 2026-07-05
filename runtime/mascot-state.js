// mascot-state.js — Phase 4 State Orchestrator core (dependency-free ESM).
//
// Decides which Animation State is current from a stream of behavioural signals and writes it
// onto the emitters' EXISTING surface: `root.dataset.state` for the SVG+CSS Output Target (the
// CSS is keyed on `#mascot[data-state="<state>"]`). The React Output Target consumes the same
// decision via the `onState` callback (see tools/emit-react-gsap/src/useMascotState.ts).
//
// Deterministic: given the same timestamped signal sequence, the state timeline is identical
// run to run. Time enters only through `rules.now`/the emit timestamp, never read implicitly.

const DEFAULT_MIN_DWELL_MS = 600;
// ponytail: one dwell floor for all non-resting states. 600ms >= active(520ms)/alert(420ms)
// recipe durations, so a state always completes at least one loop before it can downgrade.
// Pass rules.minDwellMs if a longer-running state needs a longer floor.

/**
 * Normalize a raw signal value into asserted non-resting states.
 * Accepts null/undefined (nothing asserted), a single state name, or an array of names.
 * Drops the resting state and anything outside the vocabulary.
 */
function normalizeAsserted(value, states, resting) {
  const list = value == null ? [] : Array.isArray(value) ? value : [value];
  return list.filter((s) => s !== resting && states.includes(s));
}

/**
 * @param {object} cfg
 * @param {{dataset: Record<string,string>}|null} [cfg.root] element whose dataset.state is driven (SVG+CSS surface)
 * @param {string[]} cfg.states vocabulary in priority order, resting first (e.g. rigged.json.states)
 * @param {{minDwellMs?: number, now?: () => number, onState?: (s: string) => void}} [cfg.rules]
 * @returns {{setState: (name: string) => void, bind: (source: (emit: (asserted: unknown, ts?: number) => void) => (() => void)|void) => (() => void), getState: () => string, destroy: () => void}}
 */
export function createMascot({ root = null, states, rules = {} } = {}) {
  if (!Array.isArray(states) || states.length === 0) {
    throw new Error("createMascot: `states` must be a non-empty array (e.g. rigged.json.states).");
  }

  const resting = states[0];                            // states[0] is the resting state (idle)
  const rank = new Map(states.map((s, i) => [s, i]));   // priority = vocabulary index
  const minDwellMs = rules.minDwellMs ?? DEFAULT_MIN_DWELL_MS;
  const now =
    rules.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const onState = typeof rules.onState === "function" ? rules.onState : null;

  let current = resting;
  let enteredAt = now();
  let unbind = null;

  function write() {
    if (root) root.dataset.state = current;
    if (onState) onState(current);
  }
  write(); // establish the resting state on the surface immediately

  function go(next, ts) {
    if (next === current) return;
    current = next;
    enteredAt = ts;
    write();
  }

  // Pure given (asserted, ts, current, enteredAt): the highest-priority asserted state wins.
  // Upgrade is immediate (an interrupt). Downgrade waits minDwellMs in the current state; a
  // lower target already implies the current state's signal has cleared (it is not asserted).
  function evaluate(asserted, ts) {
    let target = resting;
    for (const s of asserted) {
      if (rank.get(s) > rank.get(target)) target = s;
    }
    const targetRank = rank.get(target);
    const currentRank = rank.get(current);
    if (targetRank > currentRank) {
      go(target, ts);                               // upgrade — immediate interrupt
    } else if (targetRank < currentRank && ts - enteredAt >= minDwellMs) {
      go(target, ts);                               // downgrade — hysteresis satisfied
    }
    // targetRank === currentRank, or dwell not yet elapsed -> hold
  }

  function setState(name) {
    if (!rank.has(name)) throw new Error(`setState: unknown state '${name}'.`);
    go(name, now());                                // manual override is immediate, by design
  }

  function bind(source) {
    if (unbind) unbind();
    const emit = (asserted, ts = now()) =>
      evaluate(normalizeAsserted(asserted, states, resting), ts);
    const off = source(emit);
    unbind = typeof off === "function" ? off : null;
    return () => {
      if (unbind) {
        unbind();
        unbind = null;
      }
    };
  }

  function destroy() {
    if (unbind) {
      unbind();
      unbind = null;
    }
  }

  return { setState, bind, getState: () => current, destroy };
}

// --- Built-in source adapters -----------------------------------------------------------------
// A "source" is `(emit) => unsubscribe`. `mapFn` turns raw data into asserted state(s): a state
// name, an array of names, or null/undefined for "nothing asserted" (falls back to resting).
// (WebSocket adapter is a Future Expansion Note — add when DevBrain exposes a WS telemetry feed.)

/** Poll a JSON endpoint on an interval and map each response to asserted state(s). */
export function pollJson(url, mapFn, intervalMs = 1000) {
  return (emit) => {
    async function tick() {
      try {
        const res = await fetch(url);
        if (!res.ok) { emit(null); return; } // a failed request asserts nothing -> resting under hysteresis
        emit(mapFn(await res.json()));
      } catch {
        emit(null); // a dead feed asserts nothing -> falls back to resting under hysteresis
      }
    }
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  };
}

/** Subscribe to an EventTarget (EventSource, postMessage, custom) and map events to state(s). */
export function fromEvents(target, mapFn, eventName = "message") {
  return (emit) => {
    const handler = (event) => emit(mapFn(event));
    target.addEventListener(eventName, handler);
    return () => target.removeEventListener(eventName, handler);
  };
}
