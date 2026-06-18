# Backend Design Pattern

Express REST API embedded in Electron's main process. **Layered architecture** — clear separation so logic is testable and the DB can be swapped or networked later.

## Layers

```
HTTP request
   │
   ▼
┌──────────────┐   routes/        thin: path + method + middleware wiring
│   Route      │
└──────┬───────┘
       ▼
┌──────────────┐   middleware/    auth (JWT/session), requireRole, validate, errors
│  Middleware  │
└──────┬───────┘
       ▼
┌──────────────┐   controllers/   parse req → call service → shape response
│  Controller  │                  (NO business logic, NO SQL)
└──────┬───────┘
       ▼
┌──────────────┐   services/      business rules: batch selection, profit,
│   Service    │                  stock deduction, validation, transactions
└──────┬───────┘
       ▼
┌──────────────┐   repositories/  ALL SQL lives here (better-sqlite3 statements)
│  Repository  │
└──────┬───────┘
       ▼
   SQLite (pos.db)
```

**Rule:** SQL only in repositories. Business logic only in services. Controllers stay thin. This keeps the "batch FIFO deduction", "profit snapshot", "role-based field stripping" logic in one place each.

## Folder structure

```
server/
├── app.ts                  # build express app, mount module routers
├── server.ts               # start http server on a free localhost port
├── config.ts               # port, paths, constants
├── db/
│   ├── connection.ts       # better-sqlite3 singleton, PRAGMA foreign_keys
│   ├── schema.sql          # full DDL (from doc 03)
│   ├── migrate.ts          # run schema + versioned migrations
│   ├── migrations/         # 0001_init.sql, 0002_xxx.sql ...
│   └── seed.ts             # default admin, units, settings
├── middleware/
│   ├── auth.ts             # verify session/token → req.user (id, role_id, permissions[])
│   ├── require-permission.ts # requirePermission('products.create')
│   ├── paginate.ts         # parse page/pageSize/sort/order → req.pagination
│   ├── validate.ts         # zod schema validation
│   └── error-handler.ts    # central error → JSON {error, code}
├── lib/
│   ├── money.ts            # minor-unit helpers
│   ├── password.ts         # bcrypt hash/verify
│   ├── serialize.ts        # strip cost/profit unless reports.profit.view
│   ├── unit-of-work.ts     # transaction boundary (see below)
│   ├── paginate.ts         # build {data,total,page,pageSize}
│   └── audit.ts            # write activity_logs
└── modules/
    ├── auth/               # auth.routes.ts, auth.controller.ts, auth.service.ts
    ├── users/
    ├── roles/              # roles + permissions + grants (admin RBAC)
    ├── products/           # incl. barcodes
    ├── categories/
    ├── units/
    ├── suppliers/
    ├── purchases/          # creates batches
    ├── batches/
    ├── inventory/          # stock, low-stock, adjustments
    ├── sales/              # checkout, hold/resume
    ├── returns/
    ├── payments/
    ├── customers/
    ├── expenses/           # expenses + expense categories
    ├── shifts/
    ├── reports/
    └── settings/
```

Each module = `*.routes.ts` (paths) + `*.controller.ts` (req/res) + `*.service.ts` (logic) + `*.repo.ts` (SQL). Optional `*.schema.ts` (zod) per module.

## Cross-cutting conventions

- **Validation:** every write endpoint validated with **zod** before the controller.
- **Transactions:** all multi-table writes go through the **Unit of Work** (below) — all-or-nothing.
- **Pagination:** all list endpoints are **server-side paginated** (below).
- **Money:** integers everywhere (`*_minor`); never floats in SQL.
- **Auth:** on login issue a signed session token; `auth` middleware sets `req.user = {id, role_id, permissions:Set<string>}` (permissions loaded from `role_permissions`, cached per role).
- **RBAC:** `requirePermission('key')` on routes; `serialize.ts` removes cost/profit unless the user has `reports.profit.view`.
- **Errors:** services throw typed errors (`NotFound`, `Forbidden`, `Validation`, `Conflict`); `error-handler` maps to HTTP status + `{ error, code }`.
- **Audit:** `audit.ts` called by services for sensitive ops (price change, adjustment, refund, user/settings change).
- **Response shape:** `{ data: ... }` on success, `{ error, code }` on failure. Lists return `{ data, total, page, pageSize }`.

## Unit of Work (transaction boundary)

A **Unit of Work (UoW)** groups repository operations so they commit or roll back as one. With synchronous `better-sqlite3`, it wraps `db.transaction()`:

```ts
// lib/unit-of-work.ts (shape)
export function runInUnitOfWork<T>(work: (uow: UnitOfWork) => T): T {
  return db.transaction(() => {
    const uow = new UnitOfWork(db);   // exposes repositories bound to this txn
    return work(uow);
  })();
}
```

Services use it for any operation touching >1 table:
- **Checkout:** insert sale → deduct batches → insert sale_items (cost snapshot) → insert payments → write inventory_movements → audit. One UoW. If stock is insufficient mid-way, the whole thing rolls back (`409`).
- **Purchase:** insert purchase → insert purchase_items → create batches → inventory_movements. One UoW.
- **Return:** insert return → restock batches → inventory_movements → audit. One UoW.
- **Role save:** update role → replace role_permissions. One UoW.

Single-table reads/writes don't need it. The UoW also guarantees `inventory_movements` and `activity_logs` are written in the same transaction as the change they describe.

## Pagination (server-side, standard)

All list endpoints accept:
```
?page=1&pageSize=25&sort=created_at&order=desc&q=<search>&from=&to=
```
- `paginate.ts` middleware parses + clamps (`pageSize` max 100, default 25).
- Repositories run a `COUNT(*)` + a `LIMIT/OFFSET` query.
- Response: `{ data: [...], total, page, pageSize }`.
- Reports accept `from`/`to` (and `date` for daily) date filters; default range = today.

## The two pieces of "special" logic

### 1. Batch selection (admin setting drives it)
`sales.service.ts` reads `settings.batch_selection_strategy`:
- `fifo` → deduct from oldest batch(es) by `created_at`, split line across batches if needed.
- `cashier` → cashier supplied `batch_id` per line (UI shows batch picker).
- `latest` → deduct stock FIFO, but charge the **newest** batch's `sale_price`.

### 2. Cost snapshot & profit
On checkout, each `sale_item.cost_price_minor` is copied from the deducted batch's `purchase_price_minor`. Profit reports read these snapshots — immune to later price edits.

## Why Express (not NestJS)
Single-store, single-machine: Express keeps boilerplate low and startup fast inside Electron. The layered folder layout already gives NestJS-like structure without the framework weight. If this ever grows to many terminals, the service/repo split makes a NestJS port mechanical.
