# Implementation To-Do List

Ordered by dependency. Each `[ ]` is one implementable unit. Phases ship as **vertical slices** (backend + frontend together where it makes sense) so the app is runnable early and stays runnable. Doc refs in parentheses.

Legend: **BE** backend · **FE** frontend · **EL** electron · **OPS** tooling/build

> **Skills & testing gate:** build with the project skills in `.claude/skills/` (`pos-backend-module`, `pos-angular-feature`, `pos-db-migration`, `pos-rbac-permission`). **Every feature must pass `pos-feature-test-gate`** (which drives `pos-backend-tests` + `pos-playwright-e2e` over all use cases & edge cases) before its phase is checked off.

---

## Phase 0 — Project scaffolding & tooling
- [ ] **OPS** Root `package.json`: workspaces/scripts (`dev`, `build`, `package`), TypeScript base config (00, 04)
- [ ] **EL** `electron/main.ts` + `preload.ts`: create window, boot server, load Angular dev/prod URL (00)
- [ ] **EL** Pick a free localhost port at boot; pass to renderer via preload (00, 04)
- [ ] **BE** `server/` skeleton: `app.ts`, `server.ts`, `config.ts`, mount `/api` router (04)
- [ ] **FE** `client/` Angular v19 standalone workspace (`ng new`, routing, scss) (07)
- [ ] **FE** Tailwind local install + `tailwind.config.js` + `postcss.config.js` + `styles.scss` directives + `@layer` base classes (`.btn/.card/.input/.table`) (07)
- [ ] **FE** Install Angular CDK; verify no Material (07)
- [ ] **OPS** Wire dev workflow: Angular serve + server + electron concurrently; hot reload (00)
- [ ] **OPS** `.gitignore`, `pos.db` location strategy (userData dir in prod, local in dev) (03)

## Phase 1 — Backend foundation (DB, UoW, errors)
- [ ] **BE** `db/connection.ts`: better-sqlite3 singleton, `PRAGMA foreign_keys=ON`, WAL (03, 04)
- [ ] **BE** `db/schema.sql`: all tables from doc 03 (money as `*_minor` INTEGER) (03)
- [ ] **BE** `db/migrate.ts` + `migrations/0001_init.sql`; versioned runner using `schema_migrations`, **backup `pos.db` before applying**, transactional + restore-on-fail, downgrade protection (03, 09)
- [ ] **BE** `lib/unit-of-work.ts`: `runInUnitOfWork()` wrapping `db.transaction()` (04)
- [ ] **BE** `lib/money.ts`, `lib/password.ts` (bcrypt), `lib/paginate.ts`, `lib/audit.ts`, `lib/serialize.ts` (04)
- [ ] **BE** `middleware/`: `validate.ts` (zod), `error-handler.ts` (`{error,code}` + status map), `paginate.ts` (04, 05)
- [ ] **BE** Standard response helpers (`{data}` / list envelope) (05)

## Phase 2 — Auth, RBAC & first-run bootstrap
- [ ] **BE** `db/seed.ts`: permission catalog, system roles (admin/manager/cashier) + grants, default `admin` user, units, settings, "General" expense category (02)
- [ ] **BE** `modules/auth`: login (token issue), `/me` (user + permission keys), logout, change-password (05)
- [ ] **BE** `middleware/auth.ts`: verify token → `req.user{id, role_id, permissions:Set}` (cached per role) (04)
- [ ] **BE** `middleware/require-permission.ts`: `requirePermission('key')` (02, 04)
- [ ] **BE** `serialize.ts` strips cost/profit unless `reports.profit.view` (02)
- [ ] **BE** `modules/roles`: list permissions catalog, CRUD roles, replace grants (UoW), guard system roles (05)
- [ ] **BE** `modules/users`: CRUD, assign role, reset password, must-change flow (05)
- [ ] **FE** `core/services/api.ts` (base url + typed get/post + pagination), `auth.store.ts`, `auth.service.ts` (07)
- [ ] **FE** Interceptors: `auth.interceptor` (bearer), `error.interceptor` (toast, 401→login) (07)
- [ ] **FE** Guards: `auth.guard`, `permission.guard` (route.data.permission), `shift.guard` (07)
- [ ] **FE** `has-permission.directive.ts` + `money.pipe.ts` (07)
- [ ] **FE** `features/auth/login` page + force change-password page (07)
- [ ] **FE** `idle-timeout.service.ts`: 10-min idle → 30s warn → auto-park cart → logout (07)
- [ ] **FE** Layouts: `DashboardLayout` (sidebar perm-filtered + topbar), `PosLayout` (07)
- [ ] **FE** `app.routes.ts`: lazy `/pos` + `/app`; `redirectAfterLogin()` role-based landing (07)
- [ ] **✅ Milestone:** log in as admin, forced password change, land on dashboard shell, idle logout works

## Phase 3 — Settings (needed early by others)
- [ ] **BE** `modules/settings`: GET (subset by perm), PUT (admin) incl. batch strategy, discount cap, currency, tax mode, receipt header/footer, paper width, idle minutes, default landing (05)
- [ ] **FE** `features/settings` page (sectioned form) (06, 07)
- [ ] **FE** `settings.service.ts` + load shop/currency at startup for `MoneyPipe` (07)

## Phase 4 — Shared UI components (build once, reuse everywhere)
- [ ] **FE** `shared/components`: `data-table` (server `{data,total,page,pageSize}`), `pagination`, `page-header`, `search-box`, `date-range-picker` (CDK), `confirm-dialog` (CDK), `modal`, `toast`, `empty-state`, `stat-card`, `money-input`, `barcode-input` (auto-focus) (07)
- [ ] **✅ Milestone:** a demo list page paginates/sorts/searches against any endpoint

## Phase 5 — Master data: units, categories, suppliers, products
- [ ] **BE** `modules/units` CRUD (05)
- [ ] **BE** `modules/categories` CRUD (parent support) (05)
- [ ] **BE** `modules/suppliers` CRUD (05)
- [ ] **BE** `modules/products`: CRUD, search, `barcode/:code` resolver, paginate, cost-strip (05)
- [ ] **BE** product barcodes: add/remove (multi-barcode) (03, 05)
- [ ] **BE** `products/:id/label` barcode label data (05)
- [ ] **FE** Units, Categories, Suppliers list+form pages (reuse shared) (06, 07)
- [ ] **FE** Products list + product detail (edit, barcodes, batch list) (06)
- [ ] **FE** Barcode label print via `print.service.ts` (JsBarcode, thermal/label) (06, 07)

## Phase 6 — Purchasing & batches
- [ ] **BE** `modules/purchases`: create (UoW) → generates `batches` (cost + sale price), list, detail (03, 04, 05)
- [ ] **BE** `modules/batches`: list per product, `expiring`, adjust qty/sale price (audited) (05)
- [ ] **BE** `inventory_movements` written on purchase (03)
- [ ] **FE** Purchases list + "Receive stock" form (lines → batches w/ cost & sale price) (06)
- [ ] **FE** Product batches view + adjust dialog (06)

## Phase 7 — Inventory
- [ ] **BE** `modules/inventory`: stock levels (sum qty_remaining), low-stock, adjustment (UoW, reason, audited) (05)
- [ ] **FE** Inventory page: stock table, low-stock filter, adjustment dialog (06)

## Phase 8 — Shifts (precedes sales: shiftGuard)
- [ ] **BE** `modules/shifts`: open (float), close (counted→variance), current, list (05)
- [ ] **FE** Open/close shift dialogs; shift status in top bars; `shiftGuard` enforced (07)

## Phase 9 — Sales / checkout (core)
- [ ] **BE** `modules/sales`: checkout (UoW) — batch selection per strategy (fifo/cashier/latest), split line across batches, cost snapshot, tax/totals/change, payments, inventory_movements (03, 04, 05)
- [ ] **BE** Insufficient stock → `409`; hold/`held`/resume (05)
- [ ] **BE** `modules/payments` (split) within checkout txn (05)
- [ ] **FE** `pos/register`: barcode-input scan→add, cart, qty/discount, batch-picker (when strategy=cashier), totals (server-authoritative) (06, 07)
- [ ] **FE** Payment dialog (split, change), hold/resume, held-sales list (06)
- [ ] **FE** `print.service.ts` thermal receipt (header/footer/logo, 58/80mm, silent print) (06, 07)
- [ ] **✅ Milestone:** cashier opens shift → scans → pays → prints receipt → stock + cost recorded

## Phase 10 — Returns
- [ ] **BE** `modules/returns`: create (UoW) → restock batch + inventory_movements, approval policy, list/detail (05)
- [ ] **FE** Return-against-sale screen (select sale, choose lines/qty, reason, refund) (06)

## Phase 11 — Expenses
- [ ] **BE** `modules/expenses`: expense-categories CRUD, expenses CRUD (paginate, date+category filter), delete audited (05)
- [ ] **FE** Expenses page (record + list, category filter, date range) (06, 07)

## Phase 12 — Customers (minimal)
- [ ] **BE** `modules/customers`: CRUD minimal (name+phone) (05)
- [ ] **FE** Customers page + attach-to-sale in checkout (06)

## Phase 13 — Reports
- [ ] **BE** `modules/reports`: daily, sales (by product/category/cashier), profit (gross + **net − expenses**), inventory-valuation, expenses (by category), shift Z, activity — all with date filters + permission gates (02, 05)
- [ ] **FE** Reports hub: tiles shown per `*.view` permission; each report page with date-range + export/print (06, 07)

## Phase 14 — Users & Roles admin UI
- [ ] **FE** Users page: list, create, assign role, reset password (06)
- [ ] **FE** Roles page: create role + **permission checkbox matrix per module** (incl. report perms); guard system roles (02, 06)

## Phase 15 — Dashboard
- [ ] **BE** `modules/dashboard` (or reports aggregate): today KPIs (sales, txns, low-stock count, expenses, net profit) (05)
- [ ] **FE** `dashboard/overview`: stat-cards + quick links + **"Open POS / Sell"** button (06, 07)

## Phase 16 — Packaging & release
- [ ] **OPS** electron-builder config: app id, icons, Win `.exe` (NSIS), mac `.dmg`, Linux `.AppImage` (00)
- [ ] **OPS** Bundle Angular prod build + server into the app; `pos.db` in userData; run migrations/seed on first launch (00, 02)
- [ ] **OPS** App icon, product name, version; smoke-test installer on a clean machine
- [ ] **OPS** Backup/restore of `pos.db` from Settings (export/import)

## Phase 17 — Version updates (auto-update + safe data migration)
- [ ] **EL** Integrate `electron-updater`: feed config (channel `stable`), background check + autoDownload (09)
- [ ] **EL** IPC `update:status` / `update:install`; expose current + pending version via preload (09)
- [ ] **OPS** Code-sign Windows (Authenticode) + notarize macOS so updates install cleanly (09)
- [ ] **BE/FE** Launch-time migrate already wired (Phase 1) — surface `schema_version`/`app_version` (09)
- [ ] **FE** Settings → Updates/About: versions, last check, "Check for updates", **"Update now"** (`settings.update`) (09)
- [ ] **FE** Settings: backup now / restore from backup (admin) (09)
- [ ] **QA** Verify prev→new auto-update path: backup created, pending migrations applied, smoke sale; verify downgrade protection (09, pos-release)
- [ ] **OPS** First release via **pos-release** skill (build, sign, publish feed, changelog, tag)

## Cross-cutting (do alongside, not last)
- [ ] **BE** Audit logging on sensitive ops (price change, adjustment, refund, role/user/settings change, expense delete) (02, 03)
- [ ] **BE** zod validation on every write endpoint (04)
- [ ] **BE** Consistent `409` conflicts (dup SKU/barcode/role name, insufficient stock) (05)
- [ ] **FE** Empty/loading/error states on every list (toast on `{error,code}`) (07)
- [ ] **QA** Seed a demo dataset (products/batches) for manual testing
- [ ] **QA** Manual test pass per role against the permission matrix (02)

---

## Suggested build order (critical path)
`Phase 0 → 1 → 2 (auth/RBAC) → 3 (settings) → 4 (shared UI) → 5 (products) → 6 (purchases/batches) → 7 (inventory) → 8 (shifts) → 9 (checkout) → 10 (returns) → 11 (expenses) → 12 (customers) → 13 (reports) → 14 (users/roles) → 15 (dashboard) → 16 (package) → 17 (auto-update)`

First runnable end-to-end value lands at the **Phase 9 milestone** (a real sale with receipt). Everything after deepens coverage.
