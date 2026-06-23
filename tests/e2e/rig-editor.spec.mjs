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

test("assigning the limb role snaps the pivot to the joint; the handle is draggable (P5)", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  await page.click('#parts li[data-id="part-eyes"]'); // accent by default -> changing to limb is a real change

  await page.selectOption("#role", "limb");

  // the pivot snaps to the hip line: the top-edge centre of the part's bbox (a limb hinges at its joint)
  const j = await page.evaluate(() => {
    const m = window.__rigEditor.model;
    const rs = m.rectsOf("part-eyes").map((r) => r.bbox || r);
    const xs = rs.flatMap((r) => [r.x, r.x + r.w]), ys = rs.flatMap((r) => [r.y, r.y + r.h]);
    const bb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    return { pivot: m.parts()["part-eyes"].pivot, top: bb.y, cx: bb.x + bb.w / 2 };
  });
  expect(j.pivot.y).toBeCloseTo(j.top, 5);  // at the joint (top edge), not the bbox centre
  expect(j.pivot.x).toBeCloseTo(j.cx, 5);

  // the handle is always visible for the selected part and directly draggable (no mode toggle)
  const handle = page.locator("#stage .pivot");
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 40, { steps: 6 });
  await page.mouse.up();

  // dragging moved the model pivot away from the joint, and the part stayed selected (no deselect)
  const moved = await page.evaluate(() => window.__rigEditor.model.parts()["part-eyes"].pivot);
  expect(moved.y).not.toBeCloseTo(j.top, 1);
  await expect(page.locator("#selname")).toHaveText("part-eyes");
});

test("Esc deselects the current part", async ({ page }) => {
  await page.goto(URL);
  await page.click("#loadexample");
  await page.click("#part-body");
  await expect(page.locator("#partedit")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#partedit")).toBeHidden();
});
