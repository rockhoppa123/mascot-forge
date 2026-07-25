import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import gsap from "gsap";
import { Mascot } from "../generated/Mascot";
import { PART_ORIGINS, type MascotState } from "../generated/mascotRig";
import { useMascotState, type MascotSource } from "../src/useMascotState";
// The real SVG+CSS Output Target (docs/buildable-slice/generated/, a committed golden — not
// regenerated here). Raw text so the iframe below can render it byte-for-byte, CSS included.
import svgCssMarkupRaw from "../../../docs/buildable-slice/generated/devbrain-svg-css.generated.svg?raw";
import svgCssStyles from "../../../docs/buildable-slice/generated/devbrain-svg-css.generated.css?raw";

const STATES: MascotState[] = ["idle", "active", "alert"];

// Strip the leading XML PIs: `<?xml ...?>` parses fine standalone but `<?xml-stylesheet ...?>`
// points at a relative .css path that can't resolve inside an iframe's `srcDoc` document — the
// CSS is inlined into a real <style> tag instead (below).
const SVG_CSS_MARKUP = svgCssMarkupRaw.replace(/<\?xml[\s\S]*?\?>\s*/g, "");

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

// ADR-0003 made visible: ONE rig contract, TWO Output Targets. The React+GSAP <Mascot> and the
// real emitted SVG+CSS artifact render side by side off the same rig, driven by one shared state
// control — so a pivot or timing divergence between the targets would be visible, not just asserted.
//
// The SVG+CSS panel renders inside an <iframe srcDoc>, not inline: the emitted CSS uses unprefixed
// selectors (`svg#mascot`, `#part-body`, `.part`) that would otherwise leak onto the React <Mascot>
// instances on this same page, which also carry `class="part"`. The iframe gives complete style
// isolation and renders the artifact exactly as a real consumer would embed it.
function SideBySide({ state }: { state: MascotState }) {
  const srcDoc = useMemo(() => {
    const svg = SVG_CSS_MARKUP.replace(/data-state="[^"]*"/, `data-state="${state}"`);
    return (
      `<!doctype html><html><head><meta charset="utf-8" />` +
      `<style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;}` +
      `svg{width:100%;height:auto;}${svgCssStyles}</style>` +
      `</head><body>${svg}</body></html>`
    );
  }, [state]);
  return (
    <>
      <section className="stage" aria-label="React+GSAP target">
        <Mascot state={state} idPrefix="sbs-react-" />
      </section>
      <aside className="panel">
        <h1>One rig → two targets</h1>
        <p>Left: <strong>React+GSAP</strong> (GSAP timelines, absolute <code>svgOrigin</code> pivots).</p>
        <p>Right: the <strong>SVG+CSS Output Target</strong>, emitted from the same <code>rigged.json</code>.
          Both animate off one rig.</p>
        <pre id="probe-sbs">both: {state}</pre>
      </aside>
      <section className="stage" aria-label="SVG+CSS target">
        <iframe
          className="mascot-stage"
          style={{ width: "100%", height: "100%", minHeight: 300, border: 0 }}
          srcDoc={srcDoc}
          title="SVG+CSS Output Target (generated)"
        />
      </section>
      <aside className="panel">
        <h1>SVG+CSS (generated)</h1>
        <p>The <strong>SVG+CSS Output Target</strong> — dependency-free, CSS <code>@keyframes</code>
          instead of GSAP, and the project's default (ADR-0007). Rendered here from the committed
          generated artifact, unmodified.</p>
        <p>P7 proves both targets rotate every part around the identical canonical pivot — the
          pivot-fidelity property, not visual identity.</p>
      </aside>
    </>
  );
}

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

      <SideBySide state={state} />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
