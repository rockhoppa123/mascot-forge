// regen-cat.mjs — drive the MCP tool chain on Cat.png to prove the color + preset + preview fixes
// end-to-end. Run from repo root: `node scripts/regen-cat.mjs`.
import { startFromImage, assignRegion, setPart, forgeEmit, forgeStatus } from "../mcp/tools.mjs";

const s = startFromImage({ path: "Cat.png", colors: 8 });
console.log("viewBox:", s.viewBox, "| proposed parts:", s.parts.map((p) => p.id).join(", "));

// anatomy rig for a centred cat icon (boxes are 0..1 fractions of the viewBox).
assignRegion({ session: s.session, box: { x: 0.18, y: 0.30, w: 0.64, h: 0.55 }, partId: "body", role: "core" });
assignRegion({ session: s.session, box: { x: 0.34, y: 0.34, w: 0.32, h: 0.12 }, partId: "eyes", role: "accent" });
assignRegion({ session: s.session, box: { x: 0.16, y: 0.06, w: 0.26, h: 0.22 }, partId: "ear-left", role: "accent" });
assignRegion({ session: s.session, box: { x: 0.58, y: 0.06, w: 0.26, h: 0.22 }, partId: "ear-right", role: "accent" });
assignRegion({ session: s.session, box: { x: 0.72, y: 0.55, w: 0.26, h: 0.40 }, partId: "tail", role: "limb" });

// anatomy-appropriate presets (the Wave 2 fix): ears twitch, tail wags, eyes blink/pulse.
setPart({ session: s.session, partId: "eyes", presets: { idle: "blink", alert: "pulse" } });
setPart({ session: s.session, partId: "ear-left", presets: { idle: "twitch", alert: "recoil" } });
setPart({ session: s.session, partId: "ear-right", presets: { idle: "twitch", alert: "recoil" } });
setPart({ session: s.session, partId: "tail", presets: { active: "wag" } });

console.log("rig status:", JSON.stringify(forgeStatus({ session: s.session }).rigStatus));
const out = forgeEmit({ session: s.session, assetName: "cat-mascot", outDir: "output" });
console.log("emit:", out.ok ? "OK" : "FAIL", "->", out.written || out.error || out.validation);
