---
name: pos-angular-feature
description: Scaffold a new Angular feature/page/screen for the POS frontend following the project structure (standalone component with separate html/scss/ts, a feature service for API calls, lazy route with permission guard, reuse of shared components, Tailwind styling, data-testid for Playwright). Use whenever adding a new Angular page, screen, feature, view, component, or frontend module to the POS client. Keywords - angular feature, new page, new screen, frontend component, angular module, UI feature, client feature, standalone component.
---

# POS Angular Feature Scaffolder

Creates a consistent Angular feature under `client/src/app/features/<name>/` following `docs/07-angular-structure.md`. **Read `docs/06-frontend-design.md` + `docs/07-angular-structure.md` first.**

## Rules (never break these)
- **Separate files:** `.ts` + `.html` + `.scss` per component (no inline templates/styles).
- **Tailwind first** for styling; `.scss` only for rare overrides. No Angular Material.
- **One service per feature** wrapping `core/services/api.ts` — all HTTP there, typed against `core/models`.
- **Reuse shared components** (`data-table`, `pagination`, `page-header`, `search-box`, `date-range-picker`, `confirm-dialog`, `modal`, `toast`, `stat-card`, `money-input`, `barcode-input`). Never re-implement tables/dialogs.
- **Signals** for state; `MoneyPipe` for `*_minor`.
- **Permissions:** lazy route carries `data.permission`; hide controls with `*appHasPermission`.
- **Lists** bind to server `{ data, total, page, pageSize }` and push `page,pageSize,sort,order,q,from,to`.
- **Add `data-testid`** on key elements (inputs, buttons, rows) so Playwright selectors are stable.
- Belongs in **DashboardLayout** (`/app/...`) unless it's the register → **PosLayout** (`/pos/...`).

## Files to create
```
client/src/app/features/<name>/
  <name>.routes.ts
  <name>.service.ts
  pages/<name>-list/<name>-list.component.{ts,html,scss}
  pages/<name>-form/<name>-form.component.{ts,html,scss}   # if create/edit
  components/...                                            # feature-local pieces
```

## Steps
1. Confirm endpoints from `docs/05-api-spec.md` and the route's permission key.
2. Create the service (methods mirror the API). Create list + form pages from shared components.
3. Register lazy route in the right layout's routes with `data: { permission: '<key>' }` + `permissionGuard`.
4. Add the sidebar nav item (guarded by `*appHasPermission`) if it belongs in the menu.
5. Add `data-testid` attributes.
6. After implementing → invoke **pos-playwright-e2e** then **pos-feature-test-gate**.

## Templates

`<name>.service.ts`
```ts
import { Injectable, inject } from '@angular/core';
import { Api } from '../../core/services/api';

@Injectable({ providedIn: 'root' })
export class <Name>Service {
  private api = inject(Api);
  list(params) { return this.api.getPage<<Model>>('/<name>', params); }
  get(id: number) { return this.api.get<<Model>>(`/<name>/${id}`); }
  create(body) { return this.api.post('/<name>', body); }
  update(id: number, body) { return this.api.patch(`/<name>/${id}`, body); }
}
```

`<name>.routes.ts`
```ts
import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const routes: Routes = [
  { path: '', canActivate: [permissionGuard], data: { permission: '<name>.read' },
    loadComponent: () => import('./pages/<name>-list/<name>-list.component').then(m => m.<Name>ListComponent) },
];
```

## Checklist
- [ ] Separate html/scss/ts; Tailwind; no Material
- [ ] Feature service via `Api`; typed models
- [ ] Shared components reused (no duplicated table/dialog code)
- [ ] Lazy route + `permissionGuard` + `data.permission`
- [ ] `*appHasPermission` on controls/nav; `MoneyPipe` on money
- [ ] `data-testid` on inputs/buttons/rows
- [ ] E2E tests requested (playwright + feature-test-gate)
