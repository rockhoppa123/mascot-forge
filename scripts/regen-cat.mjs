// regen-cat.mjs — drive the MCP tool chain on Cat.png to prove the color + preset + preview fixes
// end-to-end. Run from repo root: `node scripts/regen-cat.mjs [scanline|vtracer]` (default scanline).
import { startFromImage, assignRegion, setPart, forgeEmit, forgeStatus } from "../mcp/tools.mjs";

const engine = process.argv[2] === "vtracer" ? "vtracer" : "scanline";
const s = startFromImage({ path: "Cat.png", colors: 8, engine });
console.log("engine:", engine, "| viewBox:", s.viewBox, "| proposed parts:", s.parts.map((p) => p.id).join(", "));

// rig the cat (boxes are 0..1 fractions of the viewBox). The two engines need different rigs:
// scanline emits rect-soup you can carve anatomically (tail/ears peel out of the body's rects);
// vtracer emits whole colour PATHS — the single-colour silhouette is ONE body path you cannot
// sub-divide by region, so only the two eye paths are separable. Carving same-colour parts out of a
// path needs the Phase 3 vision route. We still produce a valid animated demo on both.
if (engine === "vtracer") {
  assignRegion({ session: s.session, box: { x: 0, y: 0, w: 1, h: 1 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.38, y: 0.15, w: 0.14, h: 0.14 }, partId: "eye-right", role: "limb" });
  assignRegion({ session: s.session, box: { x: 0.21, y: 0.15, w: 0.14, h: 0.16 }, partId: "eye-left", role: "accent" });
  setPart({ session: s.session, partId: "eye-right", presets: { active: "wag" } });
  setPart({ session: s.session, partId: "eye-left", presets: { idle: "blink", alert: "pulse" } });
} else {
  // anatomy rig for the centred cat icon; anatomy-appropriate presets (Wave 2): ears twitch, tail wags.
  assignRegion({ session: s.session, box: { x: 0.18, y: 0.30, w: 0.64, h: 0.55 }, partId: "body", role: "core" });
  assignRegion({ session: s.session, box: { x: 0.34, y: 0.34, w: 0.32, h: 0.12 }, partId: "eyes", role: "accent" });
  assignRegion({ session: s.session, box: { x: 0.16, y: 0.06, w: 0.26, h: 0.22 }, partId: "ear-left", role: "accent" });
  assignRegion({ session: s.session, box: { x: 0.58, y: 0.06, w: 0.26, h: 0.22 }, partId: "ear-right", role: "accent" });
  assignRegion({ session: s.session, box: { x: 0.72, y: 0.55, w: 0.26, h: 0.40 }, partId: "tail", role: "limb" });
  setPart({ session: s.session, partId: "eyes", presets: { idle: "blink", alert: "pulse" } });
  setPart({ session: s.session, partId: "ear-left", presets: { idle: "twitch", alert: "recoil" } });
  setPart({ session: s.session, partId: "ear-right", presets: { idle: "twitch", alert: "recoil" } });
  setPart({ session: s.session, partId: "tail", presets: { active: "wag" } });
}

console.log("rig status:", JSON.stringify(forgeStatus({ session: s.session }).rigStatus));
const out = forgeEmit({ session: s.session, assetName: "cat-mascot", outDir: "output" });
console.log("emit:", out.ok ? "OK" : "FAIL", "->", out.written || out.error || out.validation);
