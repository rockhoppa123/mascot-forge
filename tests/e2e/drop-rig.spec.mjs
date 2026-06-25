import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";

// The product claim, finally under test: a non-dev drops a PNG and gets an animated SVG with no
// terminal. Every other e2e drives #loadexample; this one drives the real file → vectorize → segment
// → preview → export path. #file and #dropzone both call the same loadFile, so setInputFiles on #file
// exercises the identical code path without Playwright's flaky DataTransfer synthesis (the dropzone's
// own listener is covered separately, last test).
const PAGE = "/tools/rig-editor/index.html";
const BLOCKS = fileURLToPath(new URL("./fixtures/blocks.png", import.meta.url));

test("drop a PNG → it vectorises and segments into parts", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", BLOCKS);
  // loadPng is async (decode + vectorize + segment); the status line is the completion signal.
  await expect(page.locator("#status")).toContainText("Vectorised");
  // a 4-colour image must segment into >=2 proposed parts (not a silent canvas no-op)
  expect(await page.locator("#parts li").count()).toBeGreaterThanOrEqual(2);
  expect(errors, "no uncaught page errors during intake").toEqual([]);
});

test("dropped PNG → assign a role + preset in-browser → export downloads a self-contained SVG", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(PAGE);
  await page.setInputFiles("#file", BLOCKS);
  await expect(page.locator("#status")).toContainText("Vectorised");

  // minimal in-browser rig (no terminal): give one part a moving role + a preset so it animates.
  await page.locator("#parts li").first().click();
  await expect(page.locator("#partedit")).toBeVisible();
  await page.selectOption("#role", "limb");
  await page.selectOption("#preset-active", "spin"); // a Phase-2 preset, reachable from the dropdown

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportanim"),
  ]);
  expect(download.suggestedFilename()).toMatch(/mascot\.svg$/);
  expect(errors, "no uncaught page errors during export").toEqual([]);
});

test("the dropzone's own drop listener loads a file (not just the #file input)", async ({ page }) => {
  await page.goto(PAGE);
  // synthesize a drop on #dropzone with a real File built from the fixture bytes (read in-page).
  const bytes = [...(await page.evaluate(async (u) => {
    const r = await fetch(u); return [...new Uint8Array(await r.arrayBuffer())];
  }, "/tests/e2e/fixtures/blocks.png"))];
  await page.evaluate((arr) => {
    const file = new File([new Uint8Array(arr)], "blocks.png", { type: "image/png" });
    const dt = new DataTransfer();
    dt.items.add(file);
    const dz = document.getElementById("dropzone");
    dz.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, bytes);
  await expect(page.locator("#status")).toContainText("Vectorised");
});
