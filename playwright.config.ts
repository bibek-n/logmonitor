import { defineConfig } from "@playwright/test";

// E2E config for the QA Testing Management module. Runs against the live deployed app (no
// separate staging environment exists for this project) — see e2e/README.md for how
// authentication is bootstrapped (an injected NextAuth session cookie, not real login) and
// how the suite cleans up every row it creates.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.QA_E2E_BASE_URL ?? "http://192.168.1.15",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
