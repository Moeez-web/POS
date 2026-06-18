# POS System — Design Overview

> Status: **Design phase** (no implementation yet)
> Last updated: 2026-06-06

## What we are building

A **Point of Sale (POS) desktop application** for a **single retail store, single computer**, that installs and runs immediately with no external services to set up.

## Confirmed decisions

| Area | Decision |
|---|---|
| Business type | Retail / general store |
| Deployment | Single computer, on-premise only (no cloud, ever) |
| Desktop shell | **Electron** (cross-platform: Windows / macOS / Linux) |
| Frontend (UI) | **Angular** v19 standalone + **Tailwind CSS (local)** + Angular CDK (no Material) |
| UI workflow | Two lazy modules: **POS** (`PosLayout`) & **Dashboard** (`DashboardLayout`); role-based landing |
| Idle logout | 10 min (configurable) → 30s warning → auto-park cart → logout |
| Backend (API) | **Express** REST API on `localhost`, embedded inside Electron |
| Database | **SQLite** via `better-sqlite3` — a single `pos.db` file, no DB server |
| Packaging | **electron-builder** → `.exe` / `.dmg` / `.AppImage` installer |
| Costing | **Per-batch actual cost** (each sale snapshots the batch's real purchase price) |
| Batch selection | Admin-only **setting**: FIFO (default) / cashier-picks / latest-price |
| Barcodes | **Multi-barcode per product** (old + new barcodes resolve to same product) |
| Customer credit | **Not included** — cash/card day-to-day sales only |
| Customers | Optional minimal (name + phone), no credit ledger |
| Access control | **Dynamic RBAC** — admin creates roles & grants feature-wise CRUD + report permissions |
| Bootstrap | Default roles (admin/manager/cashier) + default `admin` user auto-seeded on first run |
| Expenses | Expense + category tables; feeds expense report and net-profit |
| Receipts | **Thermal printer** (58/80mm), silent print |
| Lists | **Server-side pagination** + sort/search; reports have date filters |
| Transactions | **Unit of Work** pattern wraps multi-table writes |
| App updates | **Auto-update** (electron-updater, internet feed), **admin-triggered install** from Settings |
| Data updates | **Migrate-on-launch** with automatic `pos.db` backup + rollback; downgrade protection |
| Audit | `created_at`/`updated_at`/`created_by` fields + `activity_logs` table |

## Architecture at a glance

```
┌─────────────────────────────────────────────────┐
│                 Electron App                      │
│  ┌──────────────┐  HTTP   ┌────────────────────┐ │
│  │   Angular    │ ──────► │  Express REST API  │ │
│  │  (renderer)  │ ◄────── │  (localhost:PORT)  │ │
│  │   the UI     │  JSON   │   better-sqlite3   │ │
│  └──────────────┘         │      pos.db        │ │
│                           └────────────────────┘ │
└─────────────────────────────────────────────────┘
```

The Electron **main process** boots the Express server and the database, then opens a window that loads the Angular UI. The UI talks to the API over `http://localhost:PORT`. Everything runs on one machine; if we ever add 2–4 terminals later, only the server moves to one "host" PC — the design already supports it.

## Document index

| Doc | Contents |
|---|---|
| `00-overview.md` | This file |
| `01-features.md` | Full feature catalog (v1 in-scope, v2 later) |
| `02-roles-and-permissions.md` | Roles, permission matrix, reports access |
| `03-database-schema.md` | All tables, columns, relationships |
| `04-backend-design.md` | Layered design pattern, folder structure, conventions |
| `05-api-spec.md` | Every endpoint: method, path, role, request/response |
| `06-frontend-design.md` | Screens, navigation, components, how the UI works |
| `07-angular-structure.md` | Angular folder structure, Tailwind (local) setup, two modules, guards, idle logout |
| `08-todo.md` | Phased, dependency-ordered implementation to-do list |
| `09-versioning-and-updates.md` | App auto-update + DB migrate-on-launch with backup |

## Build sequence (after design approval)

1. **To-do lists** — break each module into implementable tasks
2. **Skills** — reusable Claude Code skills for repeated build steps
3. **Implementation** — vertical slice by vertical slice (auth → products → purchases/batches → sales → reports)
