import { defineConfig, devices } from "@playwright/test";

// Headless smoke test for the browser rig editor (the product). Lives under tests/ so the repo root
// stays dependency-free (no root package.json — enforced by check-buildable-slice). Serves the repo
// ROOT (one level up) on 4179 so /tools/rig-editor/... resolves; 4179 avoids the dev preview on 4178.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  reporter: [["line"]],
  use: {
    baseURL: "http://localhost:4179",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // serve the repo root (..) — cross-platform: Windows `python`, Linux CI `python3`
    command: "python -m http.server 4179 --directory .. || python3 -m http.server 4179 --directory ..",
    port: 4179,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
