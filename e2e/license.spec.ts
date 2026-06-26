import { test, expect } from '@playwright/test';

const ACTIVATION_CODE = 'UGCT-F92T-HK'; // dashboard demo customer "Demo Grocery"

/**
 * Frontend licensing flow. Tests run serially against a fresh (unactivated) license DB:
 *  1. unactivated install is forced to the activation screen
 *  2. an invalid code keeps the user on the activation screen
 *  3. a valid code activates and unlocks login
 *  4. the public block screen renders with a Retry button
 */
test.describe.configure({ mode: 'serial' });

test.describe('Licensing — frontend', () => {
  test('unactivated install is redirected to the activation screen', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/activate/);
    await expect(page.getByTestId('activate-code')).toBeVisible();
    await expect(page.getByTestId('activate-submit')).toBeVisible();
  });

  test('empty code shows a required error and stays on the screen', async ({ page }) => {
    await page.goto('/activate');
    await page.getByTestId('activate-submit').click();
    await expect(page.getByTestId('activate-error')).toBeVisible();
    await expect(page).toHaveURL(/\/activate/);
  });

  test('an invalid activation code keeps the user on the activation screen', async ({ page }) => {
    await page.goto('/activate');
    await page.getByTestId('activate-code').fill('BAD-CODE-XX');
    await page.getByTestId('activate-submit').click();
    // The dashboard rejects it → error toast, no navigation away from /activate.
    await expect(page.getByTestId('toast')).toBeVisible();
    await expect(page).toHaveURL(/\/activate/);
  });

  test('a valid activation code activates and unlocks login', async ({ page }) => {
    await page.goto('/activate');
    await page.getByTestId('activate-code').fill(ACTIVATION_CODE);
    await page.getByTestId('activate-submit').click();

    // Activation succeeds → routed to login (no longer forced to /activate).
    await expect(page).toHaveURL(/\/login/);

    // And login now proceeds (license gate allows it).
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('the block screen renders with a Retry button', async ({ page }) => {
    await page.goto('/payment-due');
    await expect(page.getByTestId('block-title')).toBeVisible();
    await expect(page.getByTestId('block-retry')).toBeVisible();
  });
});
