// useMascotState — thin React wrapper over the dependency-free orchestrator core
// (runtime/mascot-state.js). Returns the current Animation State so a component can render
// <Mascot state={...} />. The core decides the state from an injectable signal `source`, so the
// mascot is reusable outside DevBrain. No new dependency: this lives inside the existing package.
import { useEffect, useState } from "react";
// @ts-ignore — dependency-free JS core; its types live in JSDoc (ponytail: no .d.ts by design).
import { createMascot } from "../../../runtime/mascot-state.js";
import type { MascotState } from "../generated/mascotRig";

/** A signal source: `(emit) => unsubscribe`. `emit(asserted, ts?)` pushes a reading. */
export type MascotSource = (emit: (asserted: unknown, ts?: number) => void) => (() => void) | void;

export interface UseMascotStateOptions {
  states?: MascotState[];
  initial?: MascotState;
  minDwellMs?: number;
}

export function useMascotState(
  source: MascotSource | null | undefined,
  opts: UseMascotStateOptions = {},
): MascotState {
  const [state, setState] = useState<MascotState>(opts.initial ?? "idle");

  useEffect(() => {
    const mascot = createMascot({
      states: opts.states ?? ["idle", "active", "alert"],
      rules: { minDwellMs: opts.minDwellMs, onState: (s: MascotState) => setState(s) },
    });
    if (source) mascot.bind(source);
    return () => mascot.destroy();
  }, [source, opts.states, opts.initial, opts.minDwellMs]);

  return state;
}
