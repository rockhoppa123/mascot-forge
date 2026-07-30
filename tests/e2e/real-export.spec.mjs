import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The gate's only geometry truth used to be a hand-authored fixture with absolute path data, which is
// exactly why the relative-path-data defect shipped: it matched 7/7 while real Figma/Illustrator
// exports put parts hundreds of units off-canvas and still reported ok=true.
//
// assets/real-export/gopher-73.svg is an unmodified CC0 file exported by Affinity Designer, whose
// curves are entirely relative. The node gate asserts against RECORDED getBBox values so it can stay
// zero-dependency; this spec measures the SAME file live in a real browser, which is what stops that
// recording from quietly going stale as the fixture or the parser changes.
const FIXTURE = "/assets/real-export/gopher-73.svg";
const RECORDED = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../assets/real-export/gopher-73.bbox.json", import.meta.url)), "utf8"),
).boxes;

// getBBox returns float32-ish values; the recording is rounded to 2dp. Nothing about the defect this
// guards against is anywhere near this small — the failure it exists to catch was 259 user units.
const EPS = 0.01;
// pathBBox includes bezier control points as-is, so its box is a documented SUPERSET of the rendered
// ink. Measured worst on this file: 20.07 user units on a 600x600 canvas, all of it that superset.
const MAX_OVERSIZE = 25;

async function liveBoxes(page) {
  await page.goto(FIXTURE);
  return page.evaluate(() => {
    const DRAW = "rect,path,circle,ellipse,polygon,polyline,line";
    const NON_RENDERED = "defs,clipPath,mask,symbol,pattern,marker";
    const out = [];
    for (const g of [...document.documentElement.children].filter((n) => n.tagName.toLowerCase() === "g")) {
      for (const el of g.querySelectorAll(DRAW)) {
        if (el.closest(NON_RENDERED)) continue;
        const b = el.getBBox();
        out.push({ tag: el.tagName.toLowerCase(), x: b.x, y: b.y, w: b.width, h: b.height });
      }
    }
    return out;
  });
}

test("recorded getBBox truth still matches what the browser actually reports", async ({ page }) => {
  const live = await liveBoxes(page);
  expect(live.length, "the fixture still contains the drawables that were recorded").toBe(RECORDED.length);
  live.forEach((b, i) => {
    const r = RECORDED[i];
    expect(b.tag, `element ${i} type`).toBe(r.tag);
    for (const k of ["x", "y", "w", "h"]) {
      expect(Math.abs(b[k] - r[k]), `element ${i} ${k}: recorded ${r[k]}, live ${b[k]}`).toBeLessThanOrEqual(EPS);
    }
  });
});

test("the text parser's geometry contains the browser's real geometry on a genuine export", async ({ page }) => {
  const live = await liveBoxes(page);
  // parse the very bytes the browser just rendered, inside the same page, so there is no second copy
  // of the file and no chance of comparing two different things.
  const parsed = await page.evaluate(async (url) => {
    const svg = await (await fetch(url)).text();
    const { parseLayered } = await import("/tools/rig-editor/layer-ingest.js");
    return parseLayered(svg).elements.map((e) => e.bbox);
  }, FIXTURE);

  expect(parsed.length, "both paths find the same drawables in the same order").toBe(live.length);

  let measured = 0, deferred = 0, worstOversize = 0;
  parsed.forEach((p, i) => {
    if (p === null) { deferred++; return; }        // circle/ellipse: the parser defers to getBBox
    measured++;
    const t = live[i];
    const over = [t.x - p.x, t.y - p.y, (p.x + p.w) - (t.x + t.w), (p.y + p.h) - (t.y + t.h)];
    expect(Math.min(...over),
      `element ${i} (${t.tag}): parser ${JSON.stringify(p)} must contain live ${JSON.stringify(t)}`)
      .toBeGreaterThanOrEqual(-EPS);
    worstOversize = Math.max(worstOversize, ...over);
  });

  expect(measured).toBe(26);
  expect(deferred, "the 2 circles are the documented v1 ceiling of the text parser").toBe(2);
  expect(worstOversize, "the bezier superset stays bounded").toBeLessThan(MAX_OVERSIZE);
});
