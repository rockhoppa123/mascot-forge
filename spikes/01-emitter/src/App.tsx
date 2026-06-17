import { useState } from "react";
import { Mascot as GsapMascot } from "./react-gsap/Mascot";
import { Mascot as CssMascot } from "./svg-css/Mascot";
import { STATES, type MascotState } from "./types";
import "./App.css";

export default function App() {
  const [state, setState] = useState<MascotState>("idle");
  const [forceReduced, setForceReduced] = useState(false);

  return (
    <div className="app">
      <h1>Spike 01 — Emitter Shoot-out</h1>
      <p className="sub">
        Same DevBrain mascot, same rig (<code>rigged.json</code>), same hand-segmented{" "}
        <code>mascot.svg</code> — built twice. Compare the two Output Targets, then read{" "}
        <code>FINDINGS.md</code> for the verdict.
      </p>

      <div className="controls">
        {STATES.map((s) => (
          <button
            key={s}
            aria-pressed={state === s}
            onClick={() => setState(s)}
          >
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <span className="spacer" />
        <label>
          <input
            type="checkbox"
            checked={forceReduced}
            onChange={(e) => setForceReduced(e.target.checked)}
          />
          Force reduced motion
        </label>
      </div>

      <div className="targets">
        <section className="target">
          <h2>A · React + GSAP</h2>
          <p className="runtime">runtime: GSAP timelines</p>
          <GsapMascot state={state} forceReduced={forceReduced} />
        </section>
        <section className="target">
          <h2>B · SVG + CSS</h2>
          <p className="runtime">runtime: none (CSS keyframes)</p>
          <CssMascot state={state} forceReduced={forceReduced} />
        </section>
      </div>
    </div>
  );
}
