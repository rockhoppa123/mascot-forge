import { test, expect } from "@playwright/test";

// Task 5: the editor's state controls (preview buttons + per-state preset pickers) are generated from
// model.states(), not a hardcoded idle/active/alert trio. A rig declaring a signal state must surface it.
const URL = "/tools/rig-editor/index.html";

// Load the committed example rig but DECLARE extra states up front (the browser equivalent of
// startFromImage({ states })), so model.states() includes the signal state.
async function loadEditorWithStates(page, states) {
  await page.goto(URL);
  await page.evaluate(async (states) => {
    const res = await fetch("../../docs/buildable-slice/generated/devbrain-segmented.svg");
    const txt = await res.text();
    window.__rigEditor.loadText(txt, "devbrain", states);
  }, states);
}

test("editor surfaces declared signal states", async ({ page }) => {
  await loadEditorWithStates(page, ["idle", "active", "alert", "loading"]);
  // a control + picker for the declared signal state
  await expect(page.locator("#states-row button", { hasText: "loading" })).toHaveCount(1);
  await expect(page.locator("#preset-pickers #preset-loading")).toHaveCount(1);
  // the existing trio still renders (regression guard for the de-hardcode)
  for (const s of ["idle", "active", "alert"]) {
    await expect(page.locator("#states-row button", { hasText: s })).toHaveCount(1);
  }
  // selecting the part shows the signal-state picker populated for its role (loading reuses active motion)
  await page.click('#parts li[data-id="part-leg-left"]');
  await page.selectOption("#role", "limb");
  await expect(page.locator("#preset-pickers #preset-loading option", { hasText: "spin" })).toHaveCount(1);
});

test("editor can add a signal state", async ({ page }) => {
  await loadEditorWithStates(page, ["idle", "active", "alert"]);
  await expect(page.locator("#states-row button", { hasText: "loading" })).toHaveCount(0);
  await page.selectOption("#addstate", "loading");
  await expect(page.locator("#states-row button", { hasText: "loading" })).toHaveCount(1);
  await expect(page.locator("#preset-pickers #preset-loading")).toHaveCount(1);
});
