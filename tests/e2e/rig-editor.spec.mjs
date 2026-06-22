import { test, expect } from "@playwright/test";

// Smoke test for the rig editor (P2). app.js was "unverified glue" — these cover the happy path and
// regress the two bugs found by hand: role-change preset orphan, and a swallowed click after a marquee.
const URL = "/tools/rig-editor/index.html";

test("load example produces an animated, walking rig", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  await expect(page.locator("#parts li")).toHaveCount(5);
  expect(await page.getAttribute("#stage", "data-state")).toBe("active");
  expect(await page.locator("#anim").textContent()).toContain("part-leg-left__walk");
});

test("role change clears stale preset; export never crashes (regression: bug #1)", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(URL);
  await page.click("#loadexample");
  await page.click('#parts li[data-id="part-eyes"]'); // select via the parts panel (robust vs SVG z-order)
  await page.selectOption("#role", "limb");       // role change must clear the now-invalid 'blink'
  await page.click("#exportanim");                // previously threw silently
  await expect(page.locator("#status")).toContainText("Exported");
  expect(errors, "no uncaught page errors").toEqual([]);
});

test("a click after a marquee still selects a part (regression: bug #2 suppressClick)", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  const box = await page.locator("#stage").boundingBox();
  // marquee drag (sets the suppress flag)
  await page.mouse.move(box.x + 12, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 70, { steps: 6 });
  await page.mouse.up();
  // the very next click must select, not be swallowed
  await page.click("#part-body");
  await expect(page.locator("#partedit")).toBeVisible();
  await expect(page.locator("#selname")).toHaveText("part-body");
});

test("export animated mascot downloads a self-contained svg", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("#exportanim"),
  ]);
  expect(download.suggestedFilename()).toMatch(/mascot\.svg$/);
});

test("Esc deselects the current part", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  await page.click("#part-body");
  await expect(page.locator("#partedit")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#partedit")).toBeHidden();
});
