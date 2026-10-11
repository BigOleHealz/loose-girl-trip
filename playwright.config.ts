import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3107", trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3107", url: "http://127.0.0.1:3107", reuseExistingServer: false },
});
