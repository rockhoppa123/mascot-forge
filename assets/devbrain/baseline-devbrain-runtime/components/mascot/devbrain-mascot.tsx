"use client";

import { resolveMascotPose } from "@/lib/mascot-pose.mjs";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import type { ReactNode } from "react";

export type DevBrainMascotState =
  | "default"
  | "thinking"
  | "diagnostic"
  | "offline"
  | "reboot"
  | "happy"
  | "caution"
  | "blocked"
  | "critical"
  | "alert"
  | "asleep"
  | "sleepy";

type DevBrainMascotPose =
  | "default"
  | "thinking"
  | "diagnostic"
  | "offline"
  | "happy"
  | "caution"
  | "critical"
  | "asleep";

type DevBrainMascotProps = {
  state?: DevBrainMascotState;
  className?: string;
  decorative?: boolean;
  /** Forces the asleep pose for contexts that intentionally pause mascot motion. */
  paused?: boolean;
  /** Rendered size in px (square). Omit to fill the parent width. */
  size?: number;
  /** Click/Enter handler. The mascot gets button semantics only when set. */
  onActivate?: () => void;
  /** false = static pose only (no ambient motion). */
  animated?: boolean;
  /** false = drop the playful idle hop (e.g. the calm dashboard heartbeat). */
  playful?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
  "aria-label"?: string;
};

// Each pose renders one of the artist's reference poses, exported to a clean
// transparent PNG by tools/mascot-trace/export-assets.mjs and served (and
// optimised to WebP/AVIF) by next/image. The intrinsic art canvas is square.
const ART_SIZE = 192;

const POSE_IMAGE: Record<DevBrainMascotPose, string> = {
  default: "/mascot/default.png",
  thinking: "/mascot/thinking.png",
  happy: "/mascot/happy.png",
  diagnostic: "/mascot/diagnostic.png",
  offline: "/mascot/offline.png",
  asleep: "/mascot/asleep.png",
  caution: "/mascot/caution.png",
  critical: "/mascot/critical.png",
};

const POSE_LABELS: Record<DevBrainMascotPose, string> = {
  default: "DevBrain mascot",
  thinking: "DevBrain mascot: thinking",
  diagnostic: "DevBrain mascot: diagnostics in progress",
  offline: "DevBrain mascot: rebooting",
  happy: "DevBrain mascot: all systems normal",
  caution: "DevBrain mascot: something needs attention",
  critical: "DevBrain mascot: a system is down",
  asleep: "DevBrain mascot: auto-refresh paused",
};

export function DevBrainMascot({
  state = "default",
  className,
  decorative = true,
  paused = false,
  size,
  onActivate,
  animated = true,
  playful = true,
  "aria-hidden": ariaHidden,
  "aria-label": ariaLabel,
}: DevBrainMascotProps) {
  const reducedMotion = useReducedMotion() ?? false;
  const { pose, loop, hopAllowed } = resolveMascotPose({
    state,
    paused,
    reducedMotion: reducedMotion || !animated,
  });
  const mascotPose = pose as DevBrainMascotPose;
  const isAnimated = animated && !reducedMotion;
  const label = ariaLabel ?? POSE_LABELS[mascotPose];
  const isHidden = ariaHidden === undefined ? decorative : ariaHidden === true || ariaHidden === "true";
  const hideFromA11y = isHidden || Boolean(onActivate);

  const image = (
    <Image
      src={POSE_IMAGE[mascotPose]}
      alt={hideFromA11y ? "" : label}
      width={ART_SIZE}
      height={ART_SIZE}
      priority
      draggable={false}
      aria-hidden={hideFromA11y || undefined}
      className="block h-full w-full select-none object-contain"
      data-pose={mascotPose}
    />
  );

  const figure = (
    <MascotMotion loop={loop} hopAllowed={hopAllowed && playful} animated={isAnimated}>
      {image}
    </MascotMotion>
  );

  const frameClass = cn("relative aspect-square", size === undefined && "w-full", !onActivate && className);
  const frameStyle = size === undefined ? undefined : { width: size, height: size };

  if (!onActivate) {
    return (
      <div
        className={frameClass}
        style={frameStyle}
        role={hideFromA11y ? undefined : "img"}
        aria-label={hideFromA11y ? undefined : label}
      >
        {figure}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={label}
      title={label}
      className={cn(
        "relative block aspect-square cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2",
        size === undefined && "w-full",
        className,
      )}
      style={frameStyle}
    >
      {figure}
    </button>
  );
}

// Ambient motion: subtle transforms on a wrapper div, mirroring the locked
// motion language. transform-origin is the feet so breathing/leaning pivots
// from the ground. Every loop is disabled under reduced motion (loop === null).
function MascotMotion({
  loop,
  hopAllowed,
  animated,
  children,
}: {
  loop: string | null;
  hopAllowed: boolean;
  animated: boolean;
  children: ReactNode;
}) {
  if (!animated || loop === null) {
    return <div className="h-full w-full">{children}</div>;
  }

  if (loop === "alert") {
    return (
      <motion.div
        className="h-full w-full"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 0.5, times: [0, 0.4, 1], ease: ENTRANCE_EASE }}
      >
        <Breathe scaleY={1.015} duration={1.2}>
          {children}
        </Breathe>
      </motion.div>
    );
  }

  if (loop === "lean") {
    // Concerned slow rock that always returns upright — never a held tilt.
    return (
      <motion.div
        className="h-full w-full"
        style={{ transformOrigin: "50% 100%" }}
        animate={{ rotate: [0, -3, 0] }}
        transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <Breathe scaleY={1.02} duration={4}>
          {children}
        </Breathe>
      </motion.div>
    );
  }

  if (loop === "zzz") {
    return (
      <motion.div
        className="relative h-full w-full"
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 4.5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        {children}
        <SleepZs />
      </motion.div>
    );
  }

  if (loop === "think") {
    return (
      <motion.div
        className="h-full w-full"
        animate={{ x: [0, 1, 0, -1, 0] }}
        transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
      >
        <Breathe scaleY={1.012} duration={4.2}>
          {children}
        </Breathe>
      </motion.div>
    );
  }

  const breathing = (
    <Breathe scaleY={1.025} duration={3.4}>
      {children}
    </Breathe>
  );

  if (!hopAllowed) return breathing;

  return (
    <motion.div
      className="h-full w-full"
      animate={{ y: [0, -7, 0, -3, 0] }}
      transition={{
        duration: 0.7,
        times: [0, 0.3, 0.6, 0.8, 1],
        ease: "easeOut",
        repeat: Number.POSITIVE_INFINITY,
        repeatDelay: 9.5,
      }}
    >
      {breathing}
    </motion.div>
  );
}

function Breathe({ scaleY, duration, children }: { scaleY: number; duration: number; children: ReactNode }) {
  // Volume-preserving squash-and-stretch: as it grows taller it narrows slightly,
  // so the art reads as a breath instead of a vertical stretch/throb.
  const scaleX = 1 - (scaleY - 1) * 0.6;
  return (
    <motion.div
      className="h-full w-full"
      style={{ transformOrigin: "50% 100%" }}
      animate={{ scaleY: [1, scaleY, 1], scaleX: [1, scaleX, 1] }}
      transition={{ duration, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

// Three "z"s drifting up from the head while asleep — restores the sleep read
// the old SVG had. Decorative; rides inside the reduced-motion gate (only
// rendered on the animated zzz path).
function SleepZs() {
  const zs = [
    { left: "53%", top: "32%", size: 11 },
    { left: "61%", top: "22%", size: 14 },
    { left: "70%", top: "11%", size: 18 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {zs.map((z, i) => (
        <motion.span
          key={z.left}
          className="absolute font-mono font-semibold leading-none text-muted"
          style={{ left: z.left, top: z.top, fontSize: z.size }}
          animate={{ opacity: [0, 1, 0], y: [6, -10] }}
          transition={{ duration: 3.9, delay: i * 1.3, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        >
          z
        </motion.span>
      ))}
    </div>
  );
}

// Entrance ease from the locked motion language (redesign-direction §3.6).
const ENTRANCE_EASE = [0.22, 1, 0.36, 1] as const;
