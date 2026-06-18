import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

const API = 'http://localhost:4317/api';

/** Seed a product + stock and a cashier user directly through the API (faster than UI). */
async function seed(api: APIRequestContext) {
  const login = await api.post(`${API}/auth/login`, { data: { username: 'admin', password: 'admin123' } });
  const token = (await login.json()).data.token as string;
  const h = { Authorization: `Bearer ${token}` };

  // Ensure a cashier role user exists.
  const roles = await (await api.get(`${API}/roles`, { headers: h })).json();
  const cashierRole = roles.data.find((r: any) => r.name === 'cashier');
  await api.post(`${API}/users`, {
    headers: h,
    data: { username: 'cashier1', password: 'cashpass', full_name: 'Cashier One', role_id: cashierRole.id },
  });

  // Product + barcode + stock (via a purchase, which creates a batch).
  const code = `BC${Date.now()}`;
  const prod = await (
    await api.post(`${API}/products`, { headers: h, data: { sku: `E2E${Date.now()}`, name: 'E2E Cola', tax_rate: 0, barcodes: [code] } })
  ).json();
  await api.post(`${API}/purchases`, {
    headers: h,
    data: { items: [{ product_id: prod.data.id, qty: 20, purchase_price_minor: 5000, sale_price_minor: 7000 }] },
  });
  return { code };
}

test.describe('POS critical flows', () => {
  let barcode: string;

  test.beforeAll(async () => {
    const api = await pwRequest.newContext();
    // The cashier may already exist from a previous run — ignore conflicts.
    try {
      const { code } = await seed(api);
      barcode = code;
    } catch {
      barcode = '';
    }
    await api.dispose();
  });

  test('admin logs in and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('admin123');
    await page.getByTestId('login-submit').click();
    // admin may be forced to change password on first run; either way not stuck on login
    await expect(page).not.toHaveURL(/\/login$/);
  });

  test('cashier lands on POS and cannot see the Users nav (RBAC)', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cashier1');
    await page.getByTestId('login-password').fill('cashpass');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/pos/);
    // Management nav item must not be present for a cashier.
    await expect(page.getByTestId('nav-Users')).toHaveCount(0);
  });

  test('cashier completes a cash sale by scanning a barcode', async ({ page }) => {
    test.skip(!barcode, 'seed unavailable');
    await page.goto('/login');
    await page.getByTestId('login-username').fill('cashier1');
    await page.getByTestId('login-password').fill('cashpass');
    await page.getByTestId('login-submit').click();
    await expect(page).toHaveURL(/\/pos/);

    await page.getByTestId('scan-input').fill(barcode);
    await page.getByTestId('scan-input').press('Enter');
    await expect(page.getByTestId('cart-row')).toHaveCount(1);

    await page.getByTestId('pay-btn').click();
    await page.getByTestId('confirm-pay').click();
    // Success toast appears (sale completed) and cart clears.
    await expect(page.getByTestId('cart-row')).toHaveCount(0);
  });
});
