import { useEffect, useMemo, useRef } from "react";
import { prepCssSvg } from "../svgPrep";
import type { MascotState } from "../types";

import rawSvg from "../mascot.svg?raw";
import "./mascot.css";

// Emitter target B — SVG + CSS keyframes, no React-driven animation, no GSAP.
// This reuses the accepted buildable-slice stylesheet (docs/buildable-slice/
// devbrain-svg-css.css) verbatim. React here only injects the markup and toggles the
// `data-state` attribute + the force-reduced-motion class — the equivalent of the spike's
// vanilla `state.js`. All motion lives in CSS.

const markup = prepCssSvg(rawSvg);

export function Mascot({
  state,
  forceReduced = false,
}: {
  state: MascotState;
  forceReduced?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => ({ __html: markup }), []);

  useEffect(() => {
    const svg = rootRef.current?.querySelector<SVGSVGElement>("svg#mascot");
    if (!svg) return;
    svg.setAttribute("data-state", state);
    svg.classList.toggle("force-reduced-motion", forceReduced);
  }, [state, forceReduced]);

  return <div ref={rootRef} className="mascot-stage" dangerouslySetInnerHTML={html} />;
}
