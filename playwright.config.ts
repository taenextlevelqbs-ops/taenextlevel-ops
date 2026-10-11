import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:3210",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/bin/chromium",
    },
  },
  webServer: {
    command: "node tests/browser-server.mjs",
    url: "http://127.0.0.1:3210/api/health",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
