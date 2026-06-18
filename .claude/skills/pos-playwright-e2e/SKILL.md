---
name: pos-playwright-e2e
description: Write and run Playwright end-to-end tests for a POS feature, driving the real Electron app (or Angular UI) through every use case and edge case for each relevant role, with stable data-testid selectors and a reset database per run. Use whenever doing E2E, UI, end-to-end, acceptance, or browser/Electron automation testing of a feature or user flow. Keywords - playwright, e2e, end to end, UI test, acceptance test, electron test, browser test, user flow test, feature test, automation test.
---

# POS Playwright E2E

Drives the actual app the way a user does — login, navigate, scan, pay, print — asserting behavior per role. Stack: **Playwright**. Every feature gets E2E coverage for **all use cases + edge cases**.

## Setup
- `@playwright/test` in devDependencies; tests in `e2e/**/*.spec.ts`; `playwright.config.ts`.
- **Launch target:** prefer Playwright's Electron runner (`_electron.launch({ args: ['.'] })`) to test the packaged behavior; or run Angular dev + server and test in Chromium. Pick one per the project setup and keep it consistent.
- **Fresh DB per run:** point the app at a temp `pos.db` (env var), run migrate+seed (admin/roles + demo products/batches) before specs; reset between spec files that mutate data.
- **Selectors:** use `data-testid` (added by **pos-angular-feature**) — never brittle text/CSS chains.
- **Page objects:** one per screen (`LoginPage`, `RegisterPage`, `ProductsPage`, ...) for reuse and no duplication.

## What every feature must cover
1. **Per-role use cases:** do the feature as each role that should access it; confirm it works.
2. **RBAC negative:** a role WITHOUT the permission cannot see the nav item/button/report tile and is blocked from the route (no cost/profit visible to cashier).
3. **Edge cases & validation:** empty states, server validation errors shown as toast/inline, `409` conflicts (insufficient stock, duplicate) surfaced clearly, pagination/search/date-range on lists.
4. **Critical flows (must exist):**
   - **Login + forced password change + role-based landing** (cashier→POS, manager/admin→dashboard).
   - **Checkout:** open shift → scan barcode → adjust qty/discount → split pay → change → **receipt prints** (assert the print path/receipt content) → stock decremented.
   - **Batch picker** appears only when strategy = `cashier`.
   - **Return:** refund restocks batch.
   - **Idle logout:** after timeout → warning → open cart auto-parked → back to login.

## Pattern
```ts
import { test, expect } from '@playwright/test';
import { login } from './fixtures/auth';

test('cashier completes a cash sale and prints a receipt', async ({ page }) => {
  await login(page, 'cashier1', 'pass');           // lands on /pos
  await page.getByTestId('scan-input').fill('900111');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('cart-row')).toHaveCount(1);
  await page.getByTestId('pay-btn').click();
  await page.getByTestId('cash-amount').fill('500.00');
  await page.getByTestId('confirm-pay').click();
  await expect(page.getByTestId('receipt-printed')).toBeVisible();
});

test('cashier cannot see profit report', async ({ page }) => {
  await login(page, 'cashier1', 'pass');
  await expect(page.getByTestId('nav-reports-profit')).toHaveCount(0);
});
```

## Steps
1. Take the feature's use-case + edge-case table from **pos-feature-test-gate**.
2. Add/extend page objects; write specs covering every row, including RBAC-negative.
3. `npx playwright test` — make green; **fix the product** when a real bug appears.
4. Report covered cases (and any product fixes) back to the test gate.

## Checklist
- [ ] Fresh seeded DB; reset between mutating specs
- [ ] Page objects (no duplicated selectors)
- [ ] `data-testid` selectors only
- [ ] Per-role happy path + RBAC-negative
- [ ] Validation/`409`/empty-state cases
- [ ] Critical flows (checkout+receipt, return, idle logout) where relevant
- [ ] All green; real bugs fixed in product code
