# Roles & Permissions (Dynamic RBAC)

Permissions are **data, not code**. The admin creates **roles** and grants **permissions** to them. A permission is `module.action` (e.g. `products.create`). Reports are permissions too, so the admin controls who sees which report. Everything is enforced **on the backend**; the frontend only hides what the user can't do.

## Model

```
users.role_id ──► roles ──< role_permissions >── permissions
```

- **permissions** — fixed catalog seeded by the app (a known key per feature+action). Not user-created (the app must know what each key protects).
- **roles** — admin-created. System roles (`admin`, `manager`, `cashier`) are seeded and flagged `is_system` (cannot be deleted; admin role's permissions cannot be reduced below "manage roles/users").
- **role_permissions** — the grants. Admin checks boxes per role.
- **users.role_id** — each user has exactly one role.

> One role per user (simple, covers the store). Per-user overrides are a possible v2 addition; not needed now.

## Permission catalog (seeded keys)

Actions are `create` / `read` / `update` / `delete` unless noted. `view` for reports.

| Module | Keys |
|---|---|
| Users | `users.create` `users.read` `users.update` `users.delete` |
| Roles & permissions | `roles.create` `roles.read` `roles.update` `roles.delete` `roles.assign` |
| Products | `products.create` `products.read` `products.update` `products.delete` |
| Barcodes | `products.barcode.manage` |
| Categories | `categories.create` `categories.read` `categories.update` `categories.delete` |
| Units | `units.create` `units.read` `units.update` `units.delete` |
| Suppliers | `suppliers.create` `suppliers.read` `suppliers.update` `suppliers.delete` |
| Purchases | `purchases.create` `purchases.read` `purchases.update` |
| Batches | `batches.read` `batches.update` (qty/sale price; audited) |
| Inventory | `inventory.read` `inventory.adjust` |
| Sales | `sales.create` `sales.read` `sales.read.own` `sales.hold` |
| Returns | `returns.create` `returns.approve` `returns.read` |
| Customers | `customers.create` `customers.read` `customers.update` |
| Shifts | `shifts.open` `shifts.close` `shifts.read.own` `shifts.read.all` |
| Expenses | `expenses.create` `expenses.read` `expenses.update` `expenses.delete` `expense_categories.manage` |
| Settings | `settings.read` `settings.update` |
| **Reports** | `reports.daily.view` `reports.sales.view` `reports.profit.view` `reports.inventory_valuation.view` `reports.expenses.view` `reports.shift.view` `reports.activity.view` |

### The cost/profit guard (cross-cutting)
Even with `products.read`, **cost/purchase price and profit fields are stripped from API responses unless the role has `reports.profit.view`** (or an explicit `costs.view`). This protects cost data on product/batch/checkout screens, not just reports.

## Default seeded roles (created automatically on first run)

These are starting points — the admin can edit them or create new roles.

| Permission group | cashier | manager | admin |
|---|:--:|:--:|:--:|
| Sales (create/hold/read.own) | ✅ | ✅ | ✅ |
| Returns create | needs approval | ✅ | ✅ |
| Returns approve | ❌ | ✅ | ✅ |
| Shifts (own) | ✅ | ✅ | ✅ |
| Shifts read all | ❌ | ✅ | ✅ |
| Products read | ✅ | ✅ | ✅ |
| Products create/update/delete | ❌ | ✅ | ✅ |
| Categories / Units manage | ❌ | ✅ | ✅ |
| Purchases / Batches / Suppliers | ❌ | ✅ | ✅ |
| Inventory read / adjust | read | ✅ | ✅ |
| Expenses create/read | ❌ | ✅ | ✅ |
| Expenses update/delete + categories | ❌ | 🟡 | ✅ |
| Customers | ✅ | ✅ | ✅ |
| Reports: daily | own | ✅ | ✅ |
| Reports: sales / shift(all) | ❌ | ✅ | ✅ |
| **Reports: profit / inventory valuation / expenses** | ❌ | ✅ | ✅ |
| **Reports: activity (audit)** | ❌ | ❌ | ✅ |
| Users manage | ❌ | ❌ | ✅ |
| **Roles & permissions manage** | ❌ | ❌ | ✅ |
| Settings update | ❌ | ❌ | ✅ |

> Cashier never receives `reports.profit.view` → no cost/profit anywhere.

## First-run bootstrap (auto on system start)
1. Run migrations → create tables.
2. Seed the **permission catalog** (all keys above).
3. Seed system roles `admin`, `manager`, `cashier` with the grants above.
4. Seed a **default admin user**: `username = admin`, default password `admin123`, `must_change_password = 1`.
5. Seed default units, settings, one expense category ("General").

Admin logs in, is forced to change the password, then creates real users/roles.

## Enforcement
- **Backend:** `requirePermission('products.create')` middleware on each write route; read routes use `requirePermission('products.read')`. The user's role's permission set is loaded once per request (cached).
- **Field stripping:** `serialize.ts` removes cost/profit unless `reports.profit.view` is present.
- **Frontend:** `permissionGuard` on routes + `*appHasPermission="'products.create'"` directive to hide controls. The user's permission list comes from `/auth/me`.
- **Audit:** sensitive ops write `activity_logs` (price change, adjustment, refund, role/permission change, user change, settings change, expense delete).
