import { defineConfig, devices } from "@playwright/test";
import { randomBytes } from "node:crypto";

// Shared only with the isolated test-server process and workers; never saved in Git.
process.env.DBTHON_E2E_PASSWORD ??= randomBytes(24).toString("hex");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  outputDir: process.env.DBTHON_E2E_OUTPUT ?? "/tmp/dbthon-browser-results",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "off", // Account forms contain credentials; capture screenshots only.
    // Reuse installed Chrome locally; CI installs Playwright's Chromium.
    channel: process.env.CI ? undefined : "chrome",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1505, height: 1045 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: [
    {
      command: "../api/.venv/bin/python ../../scripts/browser_test_server.py",
      url: "http://127.0.0.1:8001/api/v1/health/ready",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: { DBTHON_API_PROXY: "http://127.0.0.1:8001" },
    },
  ],
});
