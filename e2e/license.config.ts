import { defineConfig } from '@playwright/test';

/**
 * Frontend verification for OFFLINE licensing + the auto-update UX. Drives the real Angular UI
 * against the POS Express API on a FRESH license DB (install starts unlicensed). No dashboard
 * is needed — keys are minted locally by the vendor signing script.
 *
 * Run from the repo root:
 *   e2e/node_modules/.bin/playwright test -c e2e/license.config.ts
 */
const REPO = '/Users/moeezhaider/WebstormProjects/POS';
// Absolute so `rm` and the server (which runs with cwd=server/ via `npm --prefix`) agree.
const DB = `${REPO}/e2e/license-e2e.db`;

export default defineConfig({
  testDir: '.',
  testMatch: /(license|update)\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // 4200 is taken by another project locally, so the POS client runs on 4201 here.
  use: { baseURL: 'http://localhost:4201', trace: 'on-first-retry' },
  webServer: [
    {
      // POS API on a throwaway license DB → install starts UNLICENSED every run.
      command: `rm -f ${DB} && POS_DB_PATH=${DB} POS_PORT=4317 POS_INSTALL_ID=e2e-offline npm --prefix server run dev`,
      cwd: REPO,
      url: 'http://localhost:4317/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm --prefix client start -- --port 4201',
      cwd: REPO,
      url: 'http://localhost:4201',
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
});
