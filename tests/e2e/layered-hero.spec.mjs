import { test, expect } from "@playwright/test";

// The layered live-data hero: proves docs/buildable-slice/layered-live-demo.html actually loads Task
// 1's committed artifact (docs/buildable-slice/layered-robot/robot-mascot.svg) AND actually animates
// under live-feed-driven state, not merely that its elements exist. Asserting existence would pass on
// a completely frozen page — that is exactly how the previous (mcp-live-demo) hero shipped visibly
// broken for two feature waves while everything "passed". So this suite seeks each part's animation
// deterministically (pause, set currentTime, measure getBoundingClientRect drift) instead of sampling
// on a timer, which can miss short keyframe windows.
const PAGE = "/docs/buildable-slice/layered-live-demo.html";

// part-left-arm only animates in the "active" state (see robot-mascot.svg's CSS: the walk keyframes
// are scoped under #mascot[data-state="active"]). idle only animates part-antenna/part-head/part-body.
// window.__mascot is exposed by the page for exactly this kind of deterministic verification.
async function gotoActive(page) {
  await page.goto(PAGE);
  // The SVG mounts async via fetch(), and window.__mascot is assigned after it. Waiting on the
  // handle itself is the guard that matches what the test then uses; waiting only on the element
  // relies on JS execution-order reasoning that a retune could quietly invalidate.
  await page.waitForFunction(() => window.__mascot && document.querySelector("#part-left-arm"));
  await page.evaluate(() => window.__mascot.setState("active"));
}

test("page mounts the committed Task 1 artifact (named rig parts present)", async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator("#mascot")).toHaveCount(1);
  // these ids only exist in the layered-robot artifact — proves the fetched SVG is the real thing,
  // not some placeholder shape
  for (const id of ["part-antenna", "part-head", "part-body", "part-left-arm", "part-right-arm", "part-left-leg", "part-right-leg"]) {
    await expect(page.locator("#" + id)).toHaveCount(1);
  }
});

test("provenance copy names the layered-SVG source and links the export guide", async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator("main")).toContainText("named layers");
  await expect(page.locator("main")).toContainText("layered SVG");
  await expect(page.locator("main")).toContainText("assets/example-layered/robot.svg");
  await expect(page.locator('a[href*="exporting-layers.md"]')).toHaveCount(1);
});

test("switching to active state makes part-left-arm actually move", async ({ page }) => {
  await gotoActive(page);

  // Seek the part's animation to a known time and measure real displacement. Sampling on a timer
  // misses short keyframe windows — that is how the previous hero shipped visibly broken while
  // "passing".
  const drift = await page.evaluate(() => {
    const el = document.querySelector("#part-left-arm");
    const anims = el.getAnimations();
    if (!anims.length) return { error: "no animations on part-left-arm" };
    const a = anims[0];
    a.pause();
    // getComputedTiming().duration is a number in ms; getTiming().duration can be the string "auto",
    // which would silently make currentTime NaN and freeze the measurement at zero drift.
    const d = a.effect.getComputedTiming().duration;
    a.currentTime = 0;
    const r0 = el.getBoundingClientRect();
    a.currentTime = d / 2;
    const r1 = el.getBoundingClientRect();
    // A rotation moves the bounding box's width/height as well as its origin, so measure all four.
    return {
      dx: Math.abs(r1.x - r0.x), dy: Math.abs(r1.y - r0.y),
      dw: Math.abs(r1.width - r0.width), dh: Math.abs(r1.height - r0.height),
    };
  });
  expect(drift.error).toBeUndefined();
  expect(drift.dx + drift.dy + drift.dw + drift.dh).toBeGreaterThan(0.5);
});

// The live-data claim: switching state must change which animation is running, not just that SOME
// animation exists somewhere. part-left-arm has zero running animations at idle (its walk keyframes
// are scoped to [data-state="active"] in the artifact's CSS) and exactly one at active.
test("switching state changes which animation is running on a part", async ({ page }) => {
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__mascot && document.querySelector("#part-left-arm"));

  const idleAnimNames = await page.evaluate(() => {
    const el = document.querySelector("#part-left-arm");
    return el.getAnimations().map((a) => a.animationName);
  });
  expect(idleAnimNames).toEqual([]);

  await page.evaluate(() => window.__mascot.setState("active"));
  const activeAnimNames = await page.evaluate(() => {
    const el = document.querySelector("#part-left-arm");
    return el.getAnimations().map((a) => a.animationName);
  });
  expect(activeAnimNames.length).toBeGreaterThan(0);
  expect(activeAnimNames).not.toEqual(idleAnimNames);
});
