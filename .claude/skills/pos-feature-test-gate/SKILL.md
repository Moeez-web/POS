---
name: pos-feature-test-gate
description: Run the mandatory testing phase after a POS feature is developed - enumerate all use cases and edge cases, ensure backend (Vitest) and Playwright E2E tests cover every one, run both suites, fix the product on failures, and repeat until everything is green and the feature is stable. Use whenever a feature is finished, before marking a feature done, when asked to test/verify/stabilize a feature, or to ensure full coverage. Keywords - test gate, after feature, finish feature, stabilize, verify feature, full coverage, run all tests, acceptance, edge cases, use cases, make stable, quality gate.
---

# POS Feature Test Gate

The quality gate that makes a feature "done." **No feature is complete until this passes.** It orchestrates **pos-backend-tests** (logic) and **pos-playwright-e2e** (user flows) so every use case and edge case is covered, executed, and green — fixing the product, not the tests, when failures reveal real bugs.

## Workflow

### 1. Enumerate cases (write them down first)
Produce a coverage table for the feature before testing:

| # | Type | Case | Layer | Status |
|---|------|------|-------|--------|
| 1 | use case | normal happy path (each allowed role) | E2E + unit | |
| 2 | boundary | min/max qty, money rounding, zero/empty, pagination edges | unit | |
| 3 | edge | insufficient stock → 409 + rollback | unit + E2E | |
| 4 | edge | FIFO batch split + cost snapshot | unit | |
| 5 | edge | duplicate (SKU/barcode/role) → 409 | unit | |
| 6 | RBAC | no-permission denied (403) | unit | |
| 7 | RBAC | cashier sees no cost/profit | unit + E2E | |
| 8 | validation | bad input → 400, shown in UI | unit + E2E | |
| 9 | flow | feature-specific critical flow (e.g. checkout→receipt, return→restock, idle→park) | E2E | |
| 10 | empty/error | empty list, server error toast | E2E | |

Tailor rows to the feature; **don't drop the edge/RBAC rows** — they are what keep the product stable.

### 2. Cover
- Logic/calculation/transaction/RBAC rows → invoke **pos-backend-tests**.
- User-flow/UI/visibility rows → invoke **pos-playwright-e2e**.
- Every table row must map to at least one real test.

### 3. Run
```
npm run test          # Vitest (backend)
npx playwright test   # E2E
```

### 4. Fix & improve (the loop)
- On failure: decide — is it a **test bug** or a **product bug**? Real bugs are fixed in **product code** (that's the point: "improve the product").
- Re-run. Repeat until **both suites are fully green** and no flakiness.
- Add any newly discovered edge case back into the table and cover it.

### 5. Report
Output the completed coverage table with every row ✅, the suite results (counts), and a short list of product bugs found & fixed. Only then mark the feature done in `docs/08-todo.md`.

## Definition of done (a feature passes the gate when)
- [ ] Coverage table written; every row mapped to a test
- [ ] All use cases pass (per role)
- [ ] All boundary/numeric cases pass
- [ ] All edge cases pass (stock, FIFO, rollback, duplicates)
- [ ] RBAC: denials + cost/profit hiding verified
- [ ] Validation + conflict (409) handling verified
- [ ] Critical flow(s) pass in E2E
- [ ] Both suites green, no flakes
- [ ] Product bugs fixed (not tests weakened)
- [ ] Feature checked off in `docs/08-todo.md`

## Future development
Run this gate for **every** new feature. As the app grows, the suites become a regression net — run them before each release/package step (Phase 16).
