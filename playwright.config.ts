// Playwright config for the golden e2e: start the real demo server (FileStore, scripted agent)
// on a loopback port and drive the built simulator SPA. Chromium only; CI runs it after
// `npx playwright install chromium`.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? "8799");
const BASE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.e2e\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : [["list"]],
  use: { baseURL: BASE, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // DEMO_MODE auto-consent + dev tokens; a fresh data dir so each run starts clean.
    command: `node --env-file-if-exists=.env server/local.ts`,
    env: { PORT: String(PORT), PUBLIC_BASE_URL: BASE, DATA_DIR: ".data-e2e", LIVE_AGENT: "" },
    url: `${BASE}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
