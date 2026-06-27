import { test, expect } from "@playwright/test";

const URL = "/tools/rig-editor/index.html";

// a self-describing handoff rig loads with its motion intact and animates (not 0/N)
test("handoff rig loads animated", async ({ page }) => {
  await page.goto(URL);
  await page.evaluate(() => {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" data-states="idle,active,alert">',
      '  <g id="part-body" data-role="core" data-pivot="50,50" data-preset-idle="breathe"><rect x="30" y="30" width="40" height="40" fill="#26a69a"/></g>',
      '  <g id="part-arm" data-role="limb" data-preset-active="walk"><rect x="5" y="35" width="14" height="30" fill="#214078"/></g>',
      '</svg>',
    ].join("\n");
    window.__rigEditor.loadLayeredSvg(svg, "handoff");
  });
  // the body's idle preset survived the load -> the rig ANIMATES (badge shows idle ✓, not ✗/0-N)
  await expect(page.locator("#rigstatus")).toContainText("idle ✓");
  const idleBreathe = await page.evaluate(() => window.__rigEditor.model.preset("idle", "part-body"));
  expect(idleBreathe).toBe("breathe");
});
