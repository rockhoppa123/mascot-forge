import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The layered-first product claim under test: a designer drops their Figma/Illustrator export and gets
// an animated SVG back, no terminal. Mirrors drop-rig.spec.mjs (the PNG equivalent) on purpose — the
// two input paths should be held to the same standard, and the diff between these files should be
// only what genuinely differs. The other layered suites call loadLayeredSvg() directly via evaluate;
// this one drives the real #file input through to a real download event.
const PAGE = "/tools/rig-editor/index.html";
const ROBOT = fileURLToPath(new URL("../../assets/example-layered/robot.svg", import.meta.url));

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
  expect(download.suggestedFilename()).toMatch(/\.svg$/);
  expect(errors, "no uncaught page errors during export").toEqual([]);
});
