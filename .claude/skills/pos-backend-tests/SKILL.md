---
name: pos-backend-tests
description: Write and run automated backend tests (Vitest) for POS server services and repositories, covering happy-path use cases, numeric/boundary values, and edge cases against a fresh temporary SQLite database. Use whenever testing backend logic, a service, a repository, business rules, calculations (tax, totals, FIFO batch split, cost snapshot, profit), or validation/permission behavior. Keywords - backend test, unit test, integration test, vitest, service test, repository test, edge case, boundary, business logic test, test calculation.
---

# POS Backend Tests (Vitest)

Tests business logic where it lives — services and repositories — using a **fresh temp SQLite DB per test file** (migrate + minimal seed). Stack: **Vitest**. Follows `docs/04-backend-design.md`.

## Setup
- `vitest` in devDependencies; tests in `server/**/*.test.ts`.
- A `makeTestDb()` helper: create a temp/in-memory `better-sqlite3` DB, run migrations, seed permissions/roles/admin + the minimum rows the test needs. Each test gets a clean DB (no shared state).
- Build services against an injected `db` (the UoW makes this clean) so tests don't touch HTTP.

## What every feature must cover
1. **Use cases (happy path):** the normal flows for each role that can perform the action.
2. **Numeric / boundary:** qty = 1, large qty, money rounding in minor units, discount = 0 and = max, zero/empty results, pagination edges (page 1, last page, beyond range).
3. **Edge cases (must-have for stability):**
   - **Stock:** sell more than available → `409`; sell exactly available; FIFO split across 2+ batches; cost snapshot equals the deducted batch's purchase price.
   - **Concurrency-ish:** two deductions reducing the same batch (sequential) leave correct `qty_remaining`.
   - **Returns:** restock increments the right batch; partial return; over-return rejected.
   - **Transactions:** a failure mid-checkout (insufficient stock on line 2) **rolls back** line 1 (UoW atomicity).
   - **RBAC:** action without the permission → denied; cashier response has **no cost/profit fields**.
   - **Validation:** invalid/zod-failing input → `400`; duplicate SKU/barcode/role name → `409`.
   - **Money:** never floats; totals = subtotal − discount + tax exactly.

## Pattern (Arrange-Act-Assert)
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb } from '../../test/make-test-db';
import * as sales from './sales.service';

let db;
beforeEach(() => { db = makeTestDb(); });

it('FIFO splits a line across two batches and snapshots each cost', () => {
  // Arrange: product with batch A (qty 3 @ cost 100) and batch B (qty 5 @ cost 120)
  // Act: checkout qty 4
  // Assert: two sale_items (3 from A cost 100, 1 from B cost 120); A.qty_remaining=0, B=4
});

it('rejects selling more than total stock with 409 and rolls back', () => { /* ... */ });
```

## Steps
1. List the use cases + edge cases for the feature (use the table from **pos-feature-test-gate**).
2. Write tests covering all of them; name tests by behavior.
3. `npm run test` — make them pass; **fix the product, not the test**, when a real bug surfaces.
4. Report which cases are covered back to the test gate.

## Checklist
- [ ] Fresh DB per test; no shared state
- [ ] Happy path per allowed role
- [ ] Boundary/numeric cases
- [ ] Stock/FIFO/cost-snapshot/return edge cases
- [ ] UoW rollback case
- [ ] RBAC denial + cost/profit stripping
- [ ] Validation + duplicate conflicts
- [ ] All green; real bugs fixed in product code
