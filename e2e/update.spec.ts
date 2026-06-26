import { test, expect, Page } from '@playwright/test';

const ACTIVATION_CODE = 'UGCT-F92T-HK';

/**
 * Verifies the renderer-side auto-update UX without a real Electron build by injecting a
 * fake `window.POS_UPDATER` before the app boots. We capture the status callback and the
 * install() call so we can drive update events and assert the banner behaviour.
 */
async function reachShell(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__updateCb = null;
    (window as any).__installCalled = false;
    (window as any).POS_UPDATER = {
      onStatus: (cb: (d: unknown) => void) => {
        (window as any).__updateCb = cb;
      },
      check: () => Promise.resolve(),
      install: () => {
        (window as any).__installCalled = true;
        return Promise.resolve();
      },
    };
  });

  await page.goto('/login');
  if (page.url().includes('/activate')) {
    await page.getByTestId('activate-code').fill(ACTIVATION_CODE);
    await page.getByTestId('activate-submit').click();
    await expect(page).toHaveURL(/\/login/);
  }
  // Seeded cashier (must_change_password = 0) lands straight on the POS layout shell.
  await page.getByTestId('login-username').fill('cashier');
  await page.getByTestId('login-password').fill('cashier123');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/pos/);
}

const emit = (page: Page, data: Record<string, unknown>) =>
  page.evaluate((d) => (window as any).__updateCb?.(d), data);

test.describe('App update — frontend UX', () => {
  test('no banner until an update is downloaded', async ({ page }) => {
    await reachShell(page);
    await expect(page.getByTestId('update-banner')).toHaveCount(0);
  });

  test('downloading shows a progress note', async ({ page }) => {
    await reachShell(page);
    await emit(page, { status: 'downloading', percent: 42 });
    await expect(page.getByTestId('update-downloading')).toContainText('42%');
  });

  test('downloaded shows banner; "Install now" calls install()', async ({ page }) => {
    await reachShell(page);
    await emit(page, { status: 'downloaded', version: '9.9.9' });
    const banner = page.getByTestId('update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('v9.9.9');
    await page.getByTestId('update-install').click();
    expect(await page.evaluate(() => (window as any).__installCalled)).toBe(true);
  });

  test('"Later" dismisses the banner for the session', async ({ page }) => {
    await reachShell(page);
    await emit(page, { status: 'downloaded', version: '9.9.9' });
    await expect(page.getByTestId('update-banner')).toBeVisible();
    await page.getByTestId('update-later').click();
    await expect(page.getByTestId('update-banner')).toHaveCount(0);
    // Nothing was installed.
    expect(await page.evaluate(() => (window as any).__installCalled)).toBe(false);
  });
});
