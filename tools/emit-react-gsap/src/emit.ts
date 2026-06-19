/*
 * mascot-forge — React+GSAP Output Target emitter.
 *
 * Reads the locked rigged.json (schema v2) + the Manual Part SVG and emits a self-contained
 * React + TypeScript Mascot component that animates the rig part groups with GSAP timelines,
 * driven entirely by the rig contract (states, durations, channel keyframes, canonical pivots,
 * yoyo/iteration).
 *
 * This is the opt-in Output Target from ADR-0007. The dependency-free SVG+CSS emitter
 * (tools/emit-svg-css.ps1) stays untouched; npm is confined to this folder.
 *
 * Run: `npm run emit`  (node strips the TS types; no build step needed to generate).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const sliceDir = join(repoRoot, "docs", "buildable-slice");
const outDir = join(here, "..", "generated");

const RIG_PATH = process.env.RIG_PATH ?? join(sliceDir, "devbrain-rigged.json");
const SVG_PATH = process.env.SVG_PATH ?? join(sliceDir, "devbrain-manual-part.svg");

/** Sentinel id namespace baked into the emitted markup; swapped per-instance at runtime. */
const EMIT_PREFIX = "mfmascot-";


type State = string;

interface Channel {
  offset: number;
  rotate: number;
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

interface RigRecipe {
  part: string;
  name: string;
  durationMs: number;
  ease: string;
  repeat: number;
  yoyo: boolean;
  channels: Channel[];
  reducedChannel?: Partial<Channel>;
}

interface Rig {
  version: number;
  states: State[];
  parts: { id: string; origin: string; pivot: { x: number; y: number } }[];
  animations: Record<State, RigRecipe[]>;
  reactGsap?: { accents?: Record<State, RigRecipe[]> };
}

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function fail(message: string): never {
  throw new Error(`React+GSAP emitter failed: ${message}`);
}

function readRig(): Rig {
  try {
    return JSON.parse(readFileSync(RIG_PATH, "utf8")) as Rig;
  } catch (error) {
    return fail(`could not read/parse rig at ${RIG_PATH}: ${(error as Error).message}`);
  }
}

/**
 * Bounding box per part group, computed from the source-pixel <rect> runs. The emitter
 * derives the CSS `%` origin from the canonical absolute pivot at emit time and checks it
 * against rigged.json's `origin` — failing loudly on drift (FINDINGS §8.1).
 */
function computeBBoxes(svg: string, partIds: string[]): Record<string, BBox> {
  const result: Record<string, BBox> = {};
  for (const id of partIds) {
    const idx = svg.indexOf(`id="${id}"`);
    if (idx < 0) fail(`part id '${id}' not found in SVG`);
    const rest = svg.slice(idx);
    // Slice from this part's id to the next part's id (groups are emitted in document order).
    let end = rest.length;
    for (const other of partIds) {
      if (other === id) continue;
      const oi = rest.indexOf(`id="${other}"`);
      if (oi > 0 && oi < end) end = oi;
    }
    const block = rest.slice(0, end);
    const rects = block.matchAll(
      /<rect[^>]*\sx="([\d.]+)"[^>]*\sy="([\d.]+)"[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/g,
    );
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let count = 0;
    for (const r of rects) {
      const x = +r[1];
      const y = +r[2];
      const w = +r[3];
      const h = +r[4];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
      count++;
    }
    if (!count) fail(`part '${id}' has no <rect> geometry to bound`);
    result[id] = { minX, minY, maxX, maxY };
  }
  return result;
}

function parseOriginPercent(origin: string): { px: number; py: number } {
  const m = origin.trim().match(/^([\d.]+)%\s+([\d.]+)%$/);
  if (!m) fail(`origin '${origin}' is not a "X% Y%" pair`);
  return { px: +m[1] / 100, py: +m[2] / 100 };
}

/** Derive the bbox-relative % the canonical pivot resolves to, and assert it matches origin. */
function assertPivotAgreesWithOrigin(
  partId: string,
  pivot: { x: number; y: number },
  bbox: BBox,
  origin: string,
): void {
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const derivedPx = (pivot.x - bbox.minX) / w;
  const derivedPy = (pivot.y - bbox.minY) / h;
  const { px, py } = parseOriginPercent(origin);
  const tol = 0.005; // 0.5% of the part bbox
  if (Math.abs(derivedPx - px) > tol || Math.abs(derivedPy - py) > tol) {
    fail(
      `pivot/origin drift for '${partId}': pivot (${pivot.x}, ${pivot.y}) resolves to ` +
        `${(derivedPx * 100).toFixed(1)}% ${(derivedPy * 100).toFixed(1)}% but origin is '${origin}'. ` +
        `Schema-lock requires both targets to rotate around the identical point.`,
    );
  }
}

/** Namespace the shared SVG so multiple mascots can mount; strip PIs and any embedded script. */
function namespaceSvg(raw: string, partIds: string[]): string {
  let out = raw.replace(/<\?xml[\s\S]*?\?>\s*/g, "");
  out = out.replace(/<script[\s\S]*?<\/script>\s*/g, "");
  for (const id of partIds) {
    out = out.replaceAll(`id="${id}"`, `id="${EMIT_PREFIX}${id}"`);
    out = out.replaceAll(`href="#${id}"`, `href="#${EMIT_PREFIX}${id}"`);
  }
  out = out.replace(/aria-labelledby="([^"]*)"/g, (_m, refs: string) => {
    const next = refs
      .split(/\s+/)
      .map((r) => (partIds.includes(r) ? `${EMIT_PREFIX}${r}` : r))
      .join(" ");
    return `aria-labelledby="${next}"`;
  });
  return out.trim();
}

function emitRecipe(recipe: RigRecipe): string {
  return JSON.stringify({
    part: recipe.part,
    name: recipe.name,
    durationMs: recipe.durationMs,
    ease: recipe.ease,
    repeat: recipe.repeat,
    yoyo: recipe.yoyo,
    channels: recipe.channels,
  });
}

function buildReducedPoses(rig: Rig): Record<State, Record<string, Partial<Channel>>> {
  const poses: Record<State, Record<string, Partial<Channel>>> = {};
  for (const state of rig.states) {
    const perPart: Record<string, Partial<Channel>> = {};
    const recipes = [
      ...(rig.animations[state] ?? []),
      ...(rig.reactGsap?.accents?.[state] ?? []),
    ];
    for (const recipe of recipes) {
      if (recipe.reducedChannel && Object.keys(recipe.reducedChannel).length > 0) {
        perPart[recipe.part] = { ...(perPart[recipe.part] ?? {}), ...recipe.reducedChannel };
      }
    }
    poses[state] = perPart;
  }
  return poses;
}

function main(): void {
  const rig = readRig();
  if (rig.version !== 2) fail(`expected rigged.json version 2, got ${rig.version}`);
  // Derive id namespace from rig so new part taxonomies need no tool edits (ADR-0010).
  const PART_IDS = [...rig.parts.map((p: { id: string }) => p.id), "mascot", "rig-root", "title", "desc"];

  const rawSvg = readFileSync(SVG_PATH, "utf8");
  const bboxes = computeBBoxes(rawSvg, rig.parts.map((p) => p.id));

  // Canonical pivot -> GSAP svgOrigin (absolute user-space "x y"); also validate agreement.
  const origins: Record<string, string> = {};
  for (const part of rig.parts) {
    assertPivotAgreesWithOrigin(part.id, part.pivot, bboxes[part.id], part.origin);
    origins[part.id] = `${part.pivot.x} ${part.pivot.y}`;
  }

  const markup = namespaceSvg(rawSvg, PART_IDS);
  const reduced = buildReducedPoses(rig);

  const stateUnion = rig.states.map((s) => `"${s}"`).join(" | ");

  const stateRecipes = Object.fromEntries(
    rig.states.map((state) => [
      state,
      [
        ...(rig.animations[state] ?? []),
        ...(rig.reactGsap?.accents?.[state] ?? []),
      ].map(emitRecipe),
    ]),
  ) as Record<State, string[]>;

  mkdirSync(outDir, { recursive: true });

  // 1) The namespaced inline SVG markup + the sentinel prefix.
  writeFileSync(
    join(outDir, "mascotMarkup.ts"),
    `// AUTO-GENERATED by tools/emit-react-gsap. Do not edit by hand.\n` +
      `export const ID_PREFIX = ${JSON.stringify(EMIT_PREFIX)};\n` +
      `export const MASCOT_SVG = ${JSON.stringify(markup)};\n`,
  );

  // 2) The rig-derived motion data: origins, per-state recipes, reduced poses.
  const recipesLiteral = rig.states
    .map((state) => `  ${JSON.stringify(state)}: [\n    ${stateRecipes[state].join(",\n    ")}\n  ]`)
    .join(",\n");

  writeFileSync(
    join(outDir, "mascotRig.ts"),
    `// AUTO-GENERATED by tools/emit-react-gsap from docs/buildable-slice/devbrain-rigged.json.\n` +
      `// Do not edit by hand; re-run \`npm run emit\`.\n` +
      `export type MascotState = ${stateUnion};\n\n` +
      `export interface Channel {\n  offset: number;\n  rotate: number;\n  scaleX: number;\n  scaleY: number;\n  x: number;\n  y: number;\n}\n\n` +
      `export interface Recipe {\n  part: string;\n  name: string;\n  durationMs: number;\n  ease: string;\n  repeat: number;\n  yoyo: boolean;\n  channels: Channel[];\n}\n\n` +
      `/** Canonical absolute pivot per part as a GSAP \`svgOrigin\` string ("x y", user units). */\n` +
      `export const PART_ORIGINS: Record<string, string> = ${JSON.stringify(origins, null, 2)};\n\n` +
      `export const STATE_RECIPES: Record<MascotState, Recipe[]> = {\n${recipesLiteral}\n};\n\n` +
      `export const REDUCED_POSES: Record<MascotState, Record<string, Partial<Channel>>> = ${JSON.stringify(reduced, null, 2)};\n`,
  );

  // 3) The component itself (runtime is static; all motion comes from mascotRig.ts).
  writeFileSync(join(outDir, "Mascot.tsx"), COMPONENT_SOURCE);

  // 4) A tiny usage note alongside the generated artifact.
  writeFileSync(
    join(outDir, "README.md"),
    `# Generated React+GSAP Mascot\n\n` +
      `Auto-generated by \`tools/emit-react-gsap\` from \`docs/buildable-slice/devbrain-rigged.json\`\n` +
      `(schema v2) and \`devbrain-manual-part.svg\`. **Do not edit by hand** — re-run \`npm run emit\`.\n\n` +
      `\`\`\`tsx\nimport { Mascot } from "./generated/Mascot";\n\n<Mascot state="active" />\n\`\`\`\n\n` +
      `- \`state\`: \`"idle" | "active" | "alert"\`. \`alert\` hard-interrupts \`active\` (GSAP \`ctx.revert()\`).\n` +
      `- \`forceReduced\`: force the reduced-motion static poses (otherwise \`prefers-reduced-motion\` is honoured).\n` +
      `- \`idPrefix\`: override the per-instance id namespace (multiple mascots can mount on one page).\n`,
  );

  process.stdout.write(`Emitted React+GSAP Mascot to ${outDir}\n`);
}

/** The generated component. Static runtime — every motion parameter is read from mascotRig.ts. */
const COMPONENT_SOURCE = `// AUTO-GENERATED by tools/emit-react-gsap. Do not edit by hand; re-run \`npm run emit\`.
import { useLayoutEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ID_PREFIX, MASCOT_SVG } from "./mascotMarkup";
import {
  PART_ORIGINS,
  REDUCED_POSES,
  STATE_RECIPES,
  type Channel,
  type MascotState,
  type Recipe,
} from "./mascotRig";

const sel = (part: string, prefix: string) => "#" + prefix + part;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Map a rig channel keyframe onto GSAP transform vars (only the keys that are present). */
function channelVars(c: Partial<Channel>): gsap.TweenVars {
  const vars: gsap.TweenVars = {};
  if (c.rotate !== undefined) vars.rotation = c.rotate;
  if (c.scaleX !== undefined) vars.scaleX = c.scaleX;
  if (c.scaleY !== undefined) vars.scaleY = c.scaleY;
  if (c.x !== undefined) vars.x = c.x;
  if (c.y !== undefined) vars.y = c.y;
  return vars;
}

/** Build a looping GSAP timeline from a recipe's channel keyframes across its duration. */
function buildRecipeTimeline(target: string, recipe: Recipe): void {
  const totalSeconds = recipe.durationMs / 1000;
  const tl = gsap.timeline({ repeat: recipe.repeat, yoyo: recipe.yoyo });
  const [first, ...rest] = recipe.channels;
  gsap.set(target, channelVars(first));
  let prevOffset = first.offset;
  for (const keyframe of rest) {
    const duration = Math.max((keyframe.offset - prevOffset) * totalSeconds, 0.0001);
    tl.to(target, { ...channelVars(keyframe), duration, ease: recipe.ease });
    prevOffset = keyframe.offset;
  }
}

export interface MascotProps {
  state: MascotState;
  /** Force the reduced-motion static poses regardless of the media query. */
  forceReduced?: boolean;
  /** Override the per-instance id namespace (lets several mascots share one page). */
  idPrefix?: string;
}

let instanceCounter = 0;

export function Mascot({ state, forceReduced = false, idPrefix }: MascotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const prefix = useMemo(
    () => idPrefix ?? ID_PREFIX + (instanceCounter++) + "-",
    [idPrefix],
  );
  const html = useMemo(
    () => ({ __html: MASCOT_SVG.split(ID_PREFIX).join(prefix) }),
    [prefix],
  );

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = forceReduced || prefersReducedMotion();

    const ctx = gsap.context(() => {
      // Canonical pivots: absolute user-space origin per part. Using svgOrigin (not a CSS %)
      // means this target rotates around the EXACT same point the SVG+CSS target uses, with
      // no %-resolution drift (FINDINGS §8.1 — the main cross-target fidelity risk).
      for (const part in PART_ORIGINS) {
        gsap.set(sel(part, prefix), { svgOrigin: PART_ORIGINS[part] });
      }

      if (reduced) {
        // Static near-rest poses — mirror the SVG+CSS reduced-motion fallbacks exactly.
        const poses = REDUCED_POSES[state];
        for (const part in poses) {
          gsap.set(sel(part, prefix), channelVars(poses[part]));
        }
        return;
      }

      for (const recipe of STATE_RECIPES[state]) {
        buildRecipeTimeline(sel(recipe.part, prefix), recipe);
      }
    }, root);

    // revert() kills running tweens AND restores inline styles -> clean state interrupts,
    // which is exactly what \`alert\` overriding \`active\` needs.
    // NB: never use clearProps:"transform" here — it wipes svgOrigin and every part would
    // rotate/scale around its bbox top-left (legs detach, eyes collapse). FINDINGS pivot bug.
    return () => ctx.revert();
  }, [state, forceReduced, prefix]);

  return <div ref={rootRef} className="mascot-stage" dangerouslySetInnerHTML={html} />;
}
`;

main();
