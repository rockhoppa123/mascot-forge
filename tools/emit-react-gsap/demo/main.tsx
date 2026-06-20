import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { Mascot } from "../generated/Mascot";
import { PART_ORIGINS, type MascotState } from "../generated/mascotRig";
import { useMascotState, type MascotSource } from "../src/useMascotState";

const STATES: MascotState[] = ["idle", "active", "alert"];

// Phase 4 proof for the React Output Target: a mock telemetry feed (the shape DevBrain would
// push) drives the SAME orchestrator core, and useMascotState hands the resolved state to the
// locked <Mascot> component unchanged. Module-level so the binding effect runs once.
const liveSource: MascotSource = (emit) => {
  const start = performance.now();
  const id = setInterval(() => {
    const t = ((performance.now() - start) / 9000) % 1; // 9s loop
    const load = 1 - Math.abs(t * 2 - 1); // triangle wave 0 -> 1 -> 0
    emit(load > 0.66 ? "alert" : load > 0.25 ? "active" : null);
  }, 150);
  return () => clearInterval(id);
};

// Probe helper for live verification: reads GSAP's resolved svgOrigin + current transform per
// part and compares against the canonical pivots. Exposed on window for preview_eval.
function probe() {
  const out: Record<string, unknown> = {};
  for (const part in PART_ORIGINS) {
    const el = document.querySelector(`[id$="${part}"]`) as SVGElement | null;
    if (!el) {
      out[part] = "MISSING";
      continue;
    }
    out[part] = {
      svgOrigin: gsap.getProperty(el, "svgOrigin"),
      rotation: Number(gsap.getProperty(el, "rotation")),
      scaleX: Number(gsap.getProperty(el, "scaleX")),
      scaleY: Number(gsap.getProperty(el, "scaleY")),
      x: Number(gsap.getProperty(el, "x")),
      y: Number(gsap.getProperty(el, "y")),
    };
  }
  out["__canonicalPivots"] = PART_ORIGINS;
  return out;
}

declare global {
  interface Window {
    __probe: typeof probe;
  }
}
window.__probe = probe;

function App() {
  const [state, setState] = useState<MascotState>("idle");
  const [reduced, setReduced] = useState(false);
  const liveState = useMascotState(liveSource); // bound to the mock telemetry feed

  return (
    <main>
      <section className="stage" aria-label="Generated React+GSAP mascot stage">
        <Mascot state={state} forceReduced={reduced} idPrefix="probe-" />
      </section>
      <aside className="panel">
        <h1>React+GSAP (generated)</h1>
        <div className="controls" aria-label="Animation State">
          {STATES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === state}
              data-set-state={s}
              onClick={() => setState(s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="controls">
          <button type="button" aria-pressed={reduced} onClick={() => setReduced((r) => !r)}>
            reduced: {reduced ? "on" : "off"}
          </button>
        </div>
        <pre id="probe">state: {state}{reduced ? " / reduced" : ""}</pre>
      </aside>

      <section className="stage" aria-label="React+GSAP mascot bound to a live telemetry source">
        <Mascot state={liveState} idPrefix="live-" />
      </section>
      <aside className="panel">
        <h1>Bound (live data)</h1>
        <p>Driven by <code>useMascotState</code> over a mock telemetry feed — no manual buttons.</p>
        <pre id="probe-live">bound: {liveState}</pre>
      </aside>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
