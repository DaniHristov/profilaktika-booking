import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run a production build against the local Supabase stack
// (`npm run db:start`). The database is reset with the seed before the run.
// Emails are written to .emails/ (EMAIL_TRANSPORT=file), never sent.

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

const localEnv = existsSync(".env.local")
  ? (parseEnv(readFileSync(".env.local", "utf8")) as Record<string, string>)
  : {};

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    locale: "bg-BG",
    timezoneId: "Europe/Sofia",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /booking\.spec\.ts/ },
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testMatch: /admin\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      ...localEnv,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      EMAIL_TRANSPORT: "file",
    },
  },
});
