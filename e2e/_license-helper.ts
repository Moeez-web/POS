import { execSync } from 'node:child_process';
import { Page, expect } from '@playwright/test';

const SERVER = '/Users/moeezhaider/WebstormProjects/POS/server';

/** Mint a real offline monthly key (sub '*') using the vendor signing script. */
export function signKey(days = 30, grace = 5): string {
  return execSync(`node scripts/sign-license-key.mjs '*' ${days} ${grace}`, {
    cwd: SERVER,
    encoding: 'utf8',
  }).trim();
}

/** Paste a key into the /activate screen and apply it. */
export async function pasteKey(page: Page, key: string): Promise<void> {
  await page.getByTestId('license-key').fill(key);
  await page.getByTestId('license-apply').click();
}

/** Ensure the install is licensed, then log in as the seeded cashier (lands on the POS shell). */
export async function activateAndLogin(page: Page, key: string): Promise<void> {
  await page.goto('/login');
  if (page.url().includes('/activate')) {
    await pasteKey(page, key);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.getByTestId('login-username').fill('cashier');
  await page.getByTestId('login-password').fill('cashier123');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/pos/);
}
