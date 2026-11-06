import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  webServer: process.env.TEST_BASE_URL
    ? undefined
    : {
        command: process.env.CI
          ? "npm run preview -- --port 5174"
          : "npm run dev -- --port 5174",
        url: "http://127.0.0.1:5174",
        reuseExistingServer: !process.env.CI,
      },
  use: {
    baseURL: process.env.TEST_BASE_URL || "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome",
        viewport: { width: 1440, height: 1100 },
      },
    },
  ],
});
