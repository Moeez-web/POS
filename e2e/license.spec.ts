import { test, expect } from '@playwright/test';
import { signKey, pasteKey } from './_license-helper';

/**
 * Offline manual-key licensing flow against a fresh (unlicensed) install:
 *  1. no license → forced to the key-entry screen (shows Install ID)
 *  2. an invalid key → inline error, stays put
 *  3. a valid key → activates and unlocks login
 */
test.describe.configure({ mode: 'serial' });

const KEY = signKey();

test.describe('Licensing — offline manual key', () => {
  test('no license is redirected to the key-entry screen with an Install ID', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/activate/);
    await expect(page.getByTestId('license-key')).toBeVisible();
    await expect(page.getByTestId('install-id')).toBeVisible();
  });

  test('an invalid key shows an inline error and stays on the screen', async ({ page }) => {
    await page.goto('/activate');
    await pasteKey(page, 'not-a-valid-key');
    await expect(page.getByTestId('license-error')).toBeVisible();
    await expect(page).toHaveURL(/\/activate/);
  });

  test('a valid key activates and unlocks login', async ({ page }) => {
    await page.goto('/activate');
    await pasteKey(page, KEY);
    await expect(page).toHaveURL(/\/login/);

    await page.getByTestId('login-username').fill('cashier');
    await page.getByTestId('login-password').fill('cashier123');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/pos/);
  });
});
