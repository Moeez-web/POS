---
name: pos-rbac-permission
description: Add or wire a permission in the POS dynamic RBAC system - register a new permission key in the catalog, grant it to default roles, enforce it on backend routes, and gate the frontend route/controls, including report-view permissions. Use whenever adding access control, a new permission, gating a feature or report by role, restricting an endpoint, or changing who can see/do something. Keywords - permission, RBAC, role, access control, authorize, requirePermission, report access, gate feature, who can access.
---

# POS RBAC Permission Wiring

Permissions are `module.action` data, not code. Follows `docs/02-roles-and-permissions.md`. A permission must be wired in **four** places to fully work.

## The four wiring points
1. **Catalog seed** — add the key to the permission catalog in `server/db/seed.ts` (so the app knows it). Key form: `module.action` (e.g. `expenses.delete`, `reports.profit.view`).
2. **Default role grants** — add it to the appropriate seeded roles (admin always; manager/cashier per the matrix in doc 02).
3. **Backend enforcement** — `requirePermission('<key>')` on the route(s).
4. **Frontend gating** — route `data.permission` (+ `permissionGuard`) and/or `*appHasPermission="'<key>'"` on the control/nav/report tile.

## Special rules
- **Reports** are permissions: `reports.<name>.view`. Add the report tile under `*appHasPermission`.
- **Cost/profit exposure** is governed by `reports.profit.view` in `serialize.ts` — if a new endpoint returns cost, ensure it serializes through it.
- **System roles** (admin/manager/cashier) are seeded but admin-editable; never hardcode role NAMES in checks — always check the permission key.
- Existing installs: since roles are in the DB, a new permission needs a **migration/seed step** that inserts the catalog row and grants it to roles that should have it (don't rely only on fresh-install seed).

## Steps
1. Define the key(s) and decide which default roles get them.
2. Add to catalog seed + default grants.
3. Add an idempotent seed/migration to insert the permission + grants into existing DBs (invoke **pos-db-migration** if needed).
4. Add `requirePermission` on routes; verify `403` when absent.
5. Gate the frontend route + controls/tiles.
6. Update `docs/02-roles-and-permissions.md` (catalog table + default matrix).
7. Add tests: a denied-without-permission case (backend-tests) and a hidden-control case (playwright).

## Checklist
- [ ] Key in catalog seed (`module.action`)
- [ ] Granted to correct default roles
- [ ] Idempotent insert for existing DBs
- [ ] `requirePermission` on backend routes (403 verified)
- [ ] Frontend route `data.permission` + `*appHasPermission`
- [ ] Cost/profit serialization respected if applicable
- [ ] doc 02 updated; permission tests added
