import { useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import rig from "../rigged.json";
import { prepGsapSvg } from "../svgPrep";
import type { MascotState } from "../types";

import rawSvg from "../mascot.svg?raw";

// Emitter target A — React + TypeScript + GSAP.
// Renders the shared, hand-segmented mascot.svg and animates the rig part groups with
// GSAP timelines. Timing and pivots are pulled from the shared rigged.json contract; the
// motion itself is authored in GSAP. `alert` hard-interrupts whatever is playing.

const { markup, prefix } = prepGsapSvg(rawSvg);

/** Look up a part's `durationMs` for a state from the rig contract (falls back sensibly). */
function durSec(state: MascotState, partId: string, fallback: number): number {
  const recipe = rig.animations[state]?.find((a) => a.part === partId);
  return recipe ? recipe.durationMs / 1000 : fallback;
}

/** Per-part transform-origin from the rig contract, e.g. "50% 0%". */
function origin(partId: string, fallback: string): string {
  return rig.parts.find((p) => p.id === partId)?.origin ?? fallback;
}

const sel = (part: string) => `#${prefix}${part}`;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function Mascot({
  state,
  forceReduced = false,
}: {
  state: MascotState;
  forceReduced?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => ({ __html: markup }), []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = forceReduced || prefersReducedMotion();

    const ctx = gsap.context(() => {
      // Set every part's transform-origin from the contract up front.
      for (const p of rig.parts) {
        gsap.set(sel(p.id), { transformOrigin: origin(p.id, "50% 50%") });
      }

      if (reduced) {
        // Static near-rest poses — mirror the SVG+CSS reduced-motion fallbacks exactly.
        gsap.set(sel("part-body"), { scale: 1, x: 0, y: 0 });
        gsap.set(sel("part-eyes"), { scaleY: 1 });
        gsap.set(sel("part-leg-left"), { rotation: state === "active" ? 10 : 0 });
        gsap.set(sel("part-leg-right"), { rotation: state === "active" ? -10 : 0 });
        gsap.set(sel("part-antenna"), { scale: state === "alert" ? 1.08 : 1 });
        gsap.set(sel("part-moustache"), { x: state === "alert" ? -4 : 0 });
        return;
      }

      // Reset transient channels so a previous state doesn't leak in.
      // NOTE: reset the channels explicitly rather than `clearProps: "transform"` —
      // clearProps also wipes the transformOrigin set above, which made every part
      // rotate/scale around its bbox top-left corner (legs detached from the body, eyes
      // collapsed into a white gap). Explicit channel resets preserve the pivot.
      gsap.set(
        [
          sel("part-body"),
          sel("part-eyes"),
          sel("part-leg-left"),
          sel("part-leg-right"),
          sel("part-antenna"),
          sel("part-moustache"),
        ],
        { rotation: 0, scaleX: 1, scaleY: 1, x: 0, y: 0 },
      );

      if (state === "idle") {
        // Subtle breathing on the whole body.
        gsap.to(sel("part-body"), {
          scaleX: 0.985,
          scaleY: 1.035,
          duration: durSec("idle", "part-body", 1.8) / 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        // Periodic blink (quick squash on the eyes).
        gsap
          .timeline({ repeat: -1, repeatDelay: 4 })
          .to(sel("part-eyes"), { scaleY: 0.12, duration: 0.06, ease: "power1.in" })
          .to(sel("part-eyes"), { scaleY: 1, duration: 0.06, ease: "power1.out" });
      } else if (state === "active") {
        // Walk cycle — legs rotate INDEPENDENTLY and OUT OF PHASE at their hip pivots.
        // This is the headline proof: a PNG flipbook physically cannot do this.
        const legDur = durSec("active", "part-leg-left", 0.52) / 2;
        gsap.to(sel("part-leg-left"), {
          rotation: -18,
          duration: legDur,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          startAt: { rotation: 14 },
        });
        gsap.to(sel("part-leg-right"), {
          rotation: 18,
          duration: legDur,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          startAt: { rotation: -14 },
        });
        // Slight body bob synced to the stride.
        gsap.to(sel("part-body"), {
          y: -2,
          duration: legDur,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      } else if (state === "alert") {
        // Rapid antenna pulse at its base...
        gsap.to(sel("part-antenna"), {
          scale: 1.16,
          duration: durSec("alert", "part-antenna", 0.42) / 2,
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
        // ...short moustache recoil...
        gsap.to(sel("part-moustache"), {
          x: -5,
          duration: durSec("alert", "part-moustache", 0.36) / 2,
          ease: "power2.out",
          repeat: -1,
          yoyo: true,
        });
        // ...plus a brief whole-body jitter.
        gsap.to(sel("part-body"), {
          x: "+=1.2",
          duration: 0.05,
          ease: "rough({ strength: 2, points: 12, randomize: true })",
          repeat: -1,
          yoyo: true,
        });
      }
    }, root);

    // ctx.revert() kills tweens AND restores inline styles → clean state interrupts,
    // which is exactly what `alert` overriding `active` needs.
    return () => ctx.revert();
  }, [state, forceReduced]);

  return <div ref={rootRef} className="mascot-stage" dangerouslySetInnerHTML={html} />;
}
