import { defineConfig } from '@playwright/test';

/**
 * Drives the Angular UI against the real Express API + a fresh SQLite DB.
 * Run: `npx playwright install chromium` once, then `npx playwright test` from repo root.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      // API on a throwaway DB so specs start from a clean, seeded state.
      command: 'cross-env POS_DB_PATH=./e2e/e2e.db POS_PORT=4317 POS_LICENSE_BYPASS=1 npm --prefix server run dev',
      url: 'http://localhost:4317/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm --prefix client start -- --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
