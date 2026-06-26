import { defineConfig } from '@playwright/test';

/**
 * Frontend verification for the licensing feature. Drives the real Angular UI against:
 *  - the POS Express API on a FRESH license DB (so the install starts unactivated), and
 *  - the POS Dashboard device API (so real activation works end-to-end).
 *
 * Run from the repo root:
 *   e2e/node_modules/.bin/playwright test -c e2e/license.config.ts
 */
const REPO = '/Users/moeezhaider/WebstormProjects/POS';
const DASHBOARD = '/Users/moeezhaider/WebstormProjects/POSDashboard/server';
// Absolute so `rm` and the server (which runs with cwd=server/ via `npm --prefix`) agree.
const DB = `${REPO}/e2e/license-e2e.db`;
// Unique per run: the dashboard re-issues a token for an existing active install regardless
// of the code, so a fresh id is needed for the invalid-code path to actually be rejected.
const INSTALL_ID = `e2e-frontend-${Date.now()}`;

export default defineConfig({
  testDir: '.',
  testMatch: /(license|update)\.spec\.ts/,
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Note: 4200 is taken by another project locally, so the POS client runs on 4201 here.
  use: { baseURL: 'http://localhost:4201', trace: 'on-first-retry' },
  webServer: [
    {
      // Dashboard device API (issues real Ed25519 tokens).
      command: 'npm run dev',
      cwd: DASHBOARD,
      url: 'http://localhost:4400/api/device/time',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      // POS API on a throwaway license DB → install starts UNACTIVATED every run.
      command:
        `rm -f ${DB} && POS_DB_PATH=${DB} POS_PORT=4317 ` +
        `POS_DASHBOARD_URL=http://localhost:4400/api/device POS_INSTALL_ID=${INSTALL_ID} ` +
        'npm --prefix server run dev',
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
