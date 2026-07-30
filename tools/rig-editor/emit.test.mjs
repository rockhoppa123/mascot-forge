// Self-check for the in-browser emitter (P1). No framework — node:assert. Asserts the shared CSS
// generator stays equivalent to the canonical emit-svg-css golden, and the self-contained outputs are
// well-formed. Run: `node tools/rig-editor/emit.test.mjs`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { emitCss, emitAnimatedSvg, emitDemoHtml, emitShowcaseHtml } from "./emit.js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const rig = JSON.parse(readFileSync(join(root, "docs/buildable-slice/devbrain-rigged.json"), "utf8"));
const goldenCss = readFileSync(join(root, "docs/buildable-slice/generated/devbrain-svg-css.generated.css"), "utf8");
const manualSvg = readFileSync(join(root, "docs/buildable-slice/devbrain-manual-part.svg"), "utf8");

// --- emitCss equivalence to the canonical emit-svg-css golden (no drift) -------------------------
{
  const css = emitCss(rig, { scope: "#mascot" });
  for (const p of rig.parts) {
    assert.ok(css.includes(`#${p.id} { transform-origin: ${p.origin}; }`), `emit has origin for ${p.id}`);
    assert.ok(goldenCss.includes(`transform-origin: ${p.origin};`), `golden has the same origin for ${p.id}`);
  }
  for (const s of rig.states) for (const rec of rig.animations[s]) {
    assert.ok(css.includes(`@keyframes ${rec.name} {`), `emit has @keyframes ${rec.name}`);
    assert.ok(goldenCss.includes(`@keyframes ${rec.name} {`), `golden has @keyframes ${rec.name} (same recipe names)`);
    assert.ok(css.includes(`#mascot[data-state="${s}"] #${rec.part} { animation: ${rec.name}`),
      `emit has the ${s}/${rec.part} animation rule`);
  }
}

// --- scope is configurable (editor preview vs standalone export use one generator) ---------------
{
  assert.ok(emitCss(rig, { scope: "#stage" }).includes(`#stage[data-state="idle"]`), "scope -> #stage for preview");
  assert.ok(emitCss(rig, { scope: "#mascot" }).includes(`#mascot[data-state="idle"]`), "scope -> #mascot for export");
}

// --- self-contained animated SVG ----------------------------------------------------------------
{
  const svg = emitAnimatedSvg(rig, manualSvg);
  assert.ok(/<svg[^>]*id="mascot"/.test(svg), "keeps the #mascot root");
  assert.ok(/data-state="idle"/.test(svg), "defaults to the idle state");
  assert.ok(/<style>[\s\S]*@keyframes[\s\S]*<\/style>/.test(svg), "CSS is inlined (self-contained)");
  assert.ok(!/<\?xml-stylesheet/.test(svg), "external stylesheet reference dropped");
  assert.ok(svg.includes("part-body"), "geometry retained");
}

// --- standalone demo page with state toggles ----------------------------------------------------
{
  const html = emitDemoHtml(rig, emitAnimatedSvg(rig, manualSvg), "devbrain");
  for (const s of rig.states) assert.ok(html.includes(`data-s="${s}"`), `demo has a ${s} button`);
  assert.ok(/<svg[^>]*id="mascot"/.test(html), "demo inlines the animated svg");
}

// --- self-contained showcase page (Phase 1b) ----------------------------------------------------
{
  const animatedSvg = emitAnimatedSvg(rig, manualSvg);
  const html = emitShowcaseHtml(rig, animatedSvg, "demo", "data:image/png;base64,AAAA");
  assert.ok(!/fetch\(/.test(html), "showcase inlines everything — no fetch (file:// safe)");
  assert.ok(html.includes("data:image/png;base64,AAAA"), "shows the original image");
  assert.ok(/id="play"/.test(html), "has an auto-cycle play control");
  assert.ok(/download="/.test(html) && /data:image\/svg\+xml/.test(html), "has a download-SVG link");
  for (const s of rig.states) assert.ok(html.includes(`data-s="${s}"`), `has a ${s} button`);
}

// --- assetName is untrusted in BOTH pages -------------------------------------------------------
// Over MCP the input schema constrains it, but the browser editor takes it from the dropped FILE NAME,
// which is a different trust path with no schema in front of it. It reaches a text node, an <h3>, and
// a `download="…"` attribute, so it is escaped at every one of them.
{
  const evil = '"><img src=x onerror="alert(1)';
  const animatedSvg = emitAnimatedSvg(rig, manualSvg);
  for (const [what, html] of [
    ["demo page", emitDemoHtml(rig, animatedSvg, evil)],
    ["showcase page", emitShowcaseHtml(rig, animatedSvg, evil, "data:image/png;base64,AAAA")],
  ]) {
    // targeted, because the showcase legitimately renders an <img> for the source thumbnail
    assert.ok(!/<img[^>]*onerror/i.test(html), `${what}: a hostile assetName must not inject an element`);
    assert.ok(html.includes("&quot;&gt;&lt;img"), `${what}: it appears escaped instead`);
  }
  // the download attribute is its own context — a bare quote there escapes the attribute, not a tag
  const show = emitShowcaseHtml(rig, animatedSvg, evil);
  assert.ok(!/download="[^"]*"[^>]*\bonerror\b/.test(show), "showcase: the download attribute cannot be broken out of");
}

console.log("emit.test.mjs: all assertions passed.");
