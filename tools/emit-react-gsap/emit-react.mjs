/** Sentinel id namespace baked into the emitted markup; swapped per-instance at runtime. */
const EMIT_PREFIX = "mfmascot-";

function fail(message) {
  throw new Error(`React+GSAP emitter failed: ${message}`);
}

/**
 * Bounding box per part group, computed from the source-pixel <rect> runs. The emitter
 * derives the CSS `%` origin from the canonical absolute pivot at emit time and checks it
 * against rigged.json's `origin` — failing loudly on drift (FINDINGS §8.1).
 */
export function computeBBoxes(svg, partIds) {
  const result = {};
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

function parseOriginPercent(origin) {
  const m = origin.trim().match(/^([\d.]+)%\s+([\d.]+)%$/);
  if (!m) fail(`origin '${origin}' is not a "X% Y%" pair`);
  return { px: +m[1] / 100, py: +m[2] / 100 };
}

/** Derive the bbox-relative % the canonical pivot resolves to, and assert it matches origin. */
function assertPivotAgreesWithOrigin(partId, pivot, bbox, origin) {
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
function namespaceSvg(raw, partIds) {
  let out = raw.replace(/<\?xml[\s\S]*?\?>\s*/g, "");
  out = out.replace(/<script[\s\S]*?<\/script>\s*/g, "");
  for (const id of partIds) {
    out = out.replaceAll(`id="${id}"`, `id="${EMIT_PREFIX}${id}"`);
    out = out.replaceAll(`href="#${id}"`, `href="#${EMIT_PREFIX}${id}"`);
  }
  out = out.replace(/aria-labelledby="([^"]*)"/g, (_m, refs) => {
    const next = refs
      .split(/\s+/)
      .map((r) => (partIds.includes(r) ? `${EMIT_PREFIX}${r}` : r))
      .join(" ");
    return `aria-labelledby="${next}"`;
  });
  return out.trim();
}

function emitRecipe(recipe) {
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

function buildReducedPoses(rig) {
  const poses = {};
  for (const state of rig.states) {
    const perPart = {};
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

// emit-react.mjs — pure core for the React+GSAP Output Target (ADR-0003/0007). Rig + SVG in,
// generated file CONTENTS out. No filesystem, no env: src/emit.ts owns the CLI, mcp/tools.mjs
// calls this in-process. Imports nothing beyond the language — React/GSAP are demo-app deps.
export function emitReactGsap({
  riggedJson,
  manualSvg,
  rigLabel = "docs/buildable-slice/devbrain-rigged.json",
  svgLabel = "devbrain-manual-part.svg",
} = {}) {
  const rig = riggedJson;
  if (!rig || rig.version !== 2) fail(`expected rigged.json version 2, got ${rig && rig.version}`);
  // Derive id namespace from rig so new part taxonomies need no tool edits (ADR-0010).
  const PART_IDS = [...rig.parts.map((p) => p.id), "mascot", "rig-root", "title", "desc"];

  const rawSvg = manualSvg;
  const bboxes = computeBBoxes(rawSvg, rig.parts.map((p) => p.id));

  // Canonical pivot -> GSAP svgOrigin (absolute user-space "x y"); also validate agreement.
  const origins = {};
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
  );

  const files = {};

  // 1) The namespaced inline SVG markup + the sentinel prefix.
  files["mascotMarkup.ts"] =
    `// AUTO-GENERATED by tools/emit-react-gsap. Do not edit by hand.\n` +
    `export const ID_PREFIX = ${JSON.stringify(EMIT_PREFIX)};\n` +
    `export const MASCOT_SVG = ${JSON.stringify(markup)};\n`;

  // 2) The rig-derived motion data: origins, per-state recipes, reduced poses.
  const recipesLiteral = rig.states
    .map((state) => `  ${JSON.stringify(state)}: [\n    ${stateRecipes[state].join(",\n    ")}\n  ]`)
    .join(",\n");

  files["mascotRig.ts"] =
    `// AUTO-GENERATED by tools/emit-react-gsap from ${rigLabel}.\n` +
    `// Do not edit by hand; re-run \`npm run emit\`.\n` +
    `export type MascotState = ${stateUnion};\n\n` +
    `export interface Channel {\n  offset: number;\n  rotate: number;\n  scaleX: number;\n  scaleY: number;\n  x: number;\n  y: number;\n}\n\n` +
    `export interface Recipe {\n  part: string;\n  name: string;\n  durationMs: number;\n  ease: string;\n  repeat: number;\n  yoyo: boolean;\n  channels: Channel[];\n}\n\n` +
    `/** Canonical absolute pivot per part as a GSAP \`svgOrigin\` string ("x y", user units). */\n` +
    `export const PART_ORIGINS: Record<string, string> = ${JSON.stringify(origins, null, 2)};\n\n` +
    `export const STATE_RECIPES: Record<MascotState, Recipe[]> = {\n${recipesLiteral}\n};\n\n` +
    `export const REDUCED_POSES: Record<MascotState, Record<string, Partial<Channel>>> = ${JSON.stringify(reduced, null, 2)};\n`;

  // 3) The component itself (runtime is static; all motion comes from mascotRig.ts).
  files["Mascot.tsx"] = COMPONENT_SOURCE;

  // 4) A tiny usage note alongside the generated artifact.
  files["README.md"] =
    `# Generated React+GSAP Mascot\n\n` +
    `Auto-generated by \`tools/emit-react-gsap\` from \`${rigLabel}\`\n` +
    `(schema v2) and \`${svgLabel}\`. **Do not edit by hand** — re-run \`npm run emit\`.\n\n` +
    `\`\`\`tsx\nimport { Mascot } from "./generated/Mascot";\n\n<Mascot state="active" />\n\`\`\`\n\n` +
    `- \`state\`: \`"idle" | "active" | "alert"\`. \`alert\` hard-interrupts \`active\` (GSAP \`ctx.revert()\`).\n` +
    `- \`forceReduced\`: force the reduced-motion static poses (otherwise \`prefers-reduced-motion\` is honoured).\n` +
    `- \`idPrefix\`: override the per-instance id namespace (multiple mascots can mount on one page).\n`;

  return files;
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
