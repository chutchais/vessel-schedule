import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

loadEnv({ path: ".env.test.local", override: true });
loadEnv({ path: ".env.e2e.local", override: true });

const port = Number(process.env.E2E_APP_PORT ?? "3201");
const baseURL = process.env.APP_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "bash -lc 'set -a; source .env.test.local; [ -f .env.e2e.local ] && source .env.e2e.local; set +a; export PORT=" +
      `${port}` +
      "; npm run dev -- --port " +
      `${port}` +
      "'",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
