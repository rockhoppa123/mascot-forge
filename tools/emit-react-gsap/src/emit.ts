/*
 * mascot-forge — React+GSAP Output Target CLI.
 *
 * Thin wrapper: reads the locked rigged.json (schema v2) + the Manual Part SVG from disk, calls the
 * shared pure core, writes the generated files. All emit logic lives in ../emit-react.mjs so this CLI
 * and the MCP (mcp/tools.mjs) cannot drift — the same reason tools/rig-editor/emit.js is shared
 * between the editor's live preview and its export.
 *
 * Run: `npm run emit`  (node strips the TS types; no build step needed to generate).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// @ts-expect-error — pure ESM core, no type declarations by design (zero-dependency, no build step).
import { emitReactGsap } from "../emit-react.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const sliceDir = join(repoRoot, "docs", "buildable-slice");
const outDir = join(here, "..", "generated");

const RIG_PATH = process.env.RIG_PATH ?? join(sliceDir, "devbrain-rigged.json");
const SVG_PATH = process.env.SVG_PATH ?? join(sliceDir, "devbrain-manual-part.svg");

let riggedJson: unknown;
try {
  riggedJson = JSON.parse(readFileSync(RIG_PATH, "utf8"));
} catch (error) {
  throw new Error(`React+GSAP emitter failed: could not read/parse rig at ${RIG_PATH}: ${(error as Error).message}`);
}

const files: Record<string, string> = emitReactGsap({
  riggedJson,
  manualSvg: readFileSync(SVG_PATH, "utf8"),
});

mkdirSync(outDir, { recursive: true });
for (const [name, contents] of Object.entries(files)) writeFileSync(join(outDir, name), contents);

process.stdout.write(`Emitted React+GSAP Mascot to ${outDir}\n`);
