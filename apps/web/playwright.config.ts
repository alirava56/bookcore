import { defineConfig } from "@playwright/test";

const url = "http://127.0.0.1:4173";
const browser = process.env.PLAYWRIGHT_BROWSER;
const browserName = browser === "firefox" || browser === "webkit" ? browser : "chromium";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: url,
    browserName,
    channel: browserName === "chromium" ? process.env.PLAYWRIGHT_CHANNEL || undefined : undefined,
    trace: "retain-on-failure",
  },
  webServer: { command: "npm run start -- --port 4173", url, reuseExistingServer: false },
});
