import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The layered-first product claim under test: a designer drops their Figma/Illustrator export and gets
// an animated SVG back, no terminal. Mirrors drop-rig.spec.mjs (the PNG equivalent) on purpose — the
// two input paths should be held to the same standard, and the diff between these files should be
// only what genuinely differs. The other layered suites call loadLayeredSvg() directly via evaluate;
// this one drives the real #file input through to a real download event.
const PAGE = "/tools/rig-editor/index.html";
const ROBOT = fileURLToPath(new URL("../../assets/example-layered/robot.svg", import.meta.url));
const CLASSED = fileURLToPath(new URL("./fixtures/classed-layers.svg", import.meta.url));

test("drop a layered SVG → each named layer becomes a part", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", ROBOT);
  // loadLayeredSvg is synchronous once the file is read; the parts list is the completion signal.
  await expect(page.locator("#parts li")).toHaveCount(7);
  // the LAYER NAMES survived into part ids — the whole reason this path beats auto-segmentation
  await expect(page.locator("#parts")).toContainText("part-left-arm");
  expect(errors, "no uncaught page errors during intake").toEqual([]);
});

test("dropped layered SVG → assign a role + preset in-browser → export downloads a self-contained SVG", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", ROBOT);
  await expect(page.locator("#parts li")).toHaveCount(7);

  await page.locator("#parts li").first().click();
  await expect(page.locator("#partedit")).toBeVisible();
  await page.selectOption("#role", "limb");
  await page.selectOption("#preset-active", "spin");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportanim"),
  ]);
  expect(download.suggestedFilename()).toMatch(/mascot\.svg$/);
  expect(errors, "no uncaught page errors during export").toEqual([]);
});

// The browser path captures markup from the DOM, not from the source text, so it needs its own proof
// that the ingest allowlist and the class-to-paint inlining are actually wired in here too. Without
// them a class-styled export downloads as black silhouettes (the <style> block does not travel with
// the element) and any `on*` attribute the source carried rides into the downloaded file.
test("dropped class-styled SVG → colours are inlined and hostile attributes are dropped", async ({ page }) => {
  await page.goto(PAGE);
  await page.setInputFiles("#file", CLASSED);
  await expect(page.locator("#parts li")).toHaveCount(2);

  await page.locator("#parts li").first().click();
  await page.selectOption("#role", "core");
  await page.selectOption("#preset-idle", "breathe");

  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportanim")]);
  const svg = readFileSync(await download.path(), "utf8");

  expect(svg, "the class's fill is inlined as a presentation attribute").toContain('fill="#d7e8fb"');
  expect(svg, "every paint property carries, not just fill").toContain('stroke="#123456"');
  expect(svg, "a :hover rule must not be applied unconditionally").not.toContain("#ff0000");
  expect(svg, "nor must an @media block").not.toContain("#000000");
  expect(svg, "no event handler attribute survives ingest").not.toMatch(/\son[a-z]+\s*=/i);
});
