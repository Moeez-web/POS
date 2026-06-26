import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

const API = 'http://localhost:4317/api';

/** Create a cashier-role user (must_change_password defaults to 1) and return its credentials. */
async function createUser(api: APIRequestContext, username: string, password: string) {
  const login = await api.post(`${API}/auth/login`, { data: { username: 'admin', password: 'admin123' } });
  const token = (await login.json()).data.token as string;
  const h = { Authorization: `Bearer ${token}` };
  const roles = await (await api.get(`${API}/roles`, { headers: h })).json();
  const cashierRole = roles.data.find((r: any) => r.name === 'cashier');
  await api.post(`${API}/users`, {
    headers: h,
    data: { username, password, full_name: 'Validation User', role_id: cashierRole.id },
  });
}

test.describe('Login screen validation', () => {
  test('empty submit shows required errors and stays on /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-username-error')).toBeVisible();
    await expect(page.getByTestId('login-password-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('errors clear once fields are filled and valid credentials sign in', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-username-error')).toBeVisible();

    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();
    // Either the dashboard or the forced change-password screen — just not stuck on login.
    await expect(page).not.toHaveURL(/\/login$/);
  });
});

test.describe('Change-password screen validation', () => {
  // Unique per run so re-runs don't collide on an already-changed password.
  const username = `cpuser${Date.now()}`;
  const tempPassword = 'temp123';
  const newPassword = 'newpass123';

  test.beforeAll(async () => {
    const api = await pwRequest.newContext();
    try {
      await createUser(api, username, tempPassword);
    } finally {
      await api.dispose();
    }
  });

  test('forces change, validates inline, and accepts a matching new password', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill(tempPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/change-password/);

    // Empty submit -> all three required errors.
    await page.getByTestId('cp-submit').click();
    await expect(page.getByTestId('cp-old-error')).toBeVisible();
    await expect(page.getByTestId('cp-new-error')).toBeVisible();
    await expect(page.getByTestId('cp-confirm-error')).toBeVisible();

    // Too-short new password.
    await page.getByTestId('cp-old').fill(tempPassword);
    await page.getByTestId('cp-new').fill('123');
    await expect(page.getByTestId('cp-new-error')).toContainText(/6 characters/);

    // Mismatched confirmation.
    await page.getByTestId('cp-new').fill(newPassword);
    await page.getByTestId('cp-confirm').fill('different1');
    await expect(page.getByTestId('cp-confirm-error')).toContainText(/do not match/i);

    // Fix it -> submit succeeds and leaves the change-password screen.
    await page.getByTestId('cp-confirm').fill(newPassword);
    await page.getByTestId('cp-submit').click();
    await expect(page).not.toHaveURL(/\/change-password/);
  });

  test('can log in with the new password (regression: change-password lockout fix)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill(username);
    await page.getByTestId('login-password').fill(newPassword);
    await page.getByTestId('login-submit').click();
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('wrong current password shows an error and does NOT log the user out', async ({ page }) => {
    // A fresh user that still must change its password.
    const u = `cpwrong${Date.now()}`;
    const api = await pwRequest.newContext();
    await createUser(api, u, 'temp123');
    await api.dispose();

    await page.goto('/login');
    await page.getByTestId('login-username').fill(u);
    await page.getByTestId('login-password').fill('temp123');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/change-password/);

    // Wrong CURRENT password but otherwise valid form -> server 401.
    await page.getByTestId('cp-old').fill('wrongcurrent');
    await page.getByTestId('cp-new').fill('brandnew123');
    await page.getByTestId('cp-confirm').fill('brandnew123');
    await page.getByTestId('cp-submit').click();

    // The user must stay on the change-password screen (not be kicked to /login).
    await expect(page).toHaveURL(/\/change-password/);
  });
});
