# Angular App Structure & Workflow

Angular v19 standalone, **Tailwind CSS (local, no CDN)**, **Angular CDK** for behaviors (overlay, a11y, drag) — **no Angular Material**. Separate `.html` / `.scss` / `.ts` per component. Services for all API calls. Maximum reusable components to cut redundancy and keep the bundle small/fast.

## Styling: Tailwind, fully local (offline desktop)

Installed as devDependencies (bundled, never fetched online):
```
tailwindcss  postcss  autoprefixer  @angular/cdk
```
- `tailwind.config.js` → `content: ['./src/**/*.{html,ts}']`, theme tokens (brand colors, spacing), POS-friendly larger touch targets.
- `postcss.config.js` → tailwindcss + autoprefixer.
- `src/styles.scss` → `@tailwind base; @tailwind components; @tailwind utilities;` + a few `@layer components` classes (`.btn`, `.card`, `.input`, `.table`) for reuse.
- Everything compiles into the app bundle at build time → works with no internet.

## Component file convention
Every component is three files (no inline templates/styles):
```
product-list.component.ts     # logic, signals, injects service
product-list.component.html   # Tailwind markup
product-list.component.scss    # only component-specific overrides (rare; Tailwind first)
```

## Two modules = two layouts (lazy-loaded)

| Module | Layout shell | Purpose | Audience |
|---|---|---|---|
| **POS** | `PosLayout` | Full-screen, distraction-free register | cashier (primary), anyone selling |
| **Dashboard** | `DashboardLayout` | Sidebar + topbar, all management | manager/admin (and any granted feature) |

```
PosLayout:                          DashboardLayout:
┌───────────────────────────┐       ┌──────────┬──────────────────┐
│ shift · cashier · logout  │       │ topbar: shop·user·shift·⎋ │
├───────────────────────────┤       ├──────────┼──────────────────┤
│   scan │ cart             │       │ sidebar  │  routed view     │
│   grid │ totals  [Pay]    │       │ (perm-   │                  │
│        │       [Hold]     │       │ filtered)│                  │
└───────────────────────────┘       └──────────┴──────────────────┘
```

## Folder structure

```
client/
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── index.html
│   ├── main.ts
│   ├── styles.scss                 # tailwind directives + shared @layer classes
│   └── app/
│       ├── app.routes.ts           # top-level routes (lazy pos + dashboard)
│       ├── app.config.ts           # providers: http, interceptors, router
│       │
│       ├── core/                   # singletons (provided in root)
│       │   ├── auth/
│       │   │   ├── auth.store.ts        # signals: user, permissions, token
│       │   │   └── auth.service.ts      # login, me, logout, change-password
│       │   ├── guards/
│       │   │   ├── auth.guard.ts        # logged in?
│       │   │   ├── permission.guard.ts  # route.data.permission present?
│       │   │   └── shift.guard.ts       # POS sale needs an open shift
│       │   ├── interceptors/
│       │   │   ├── auth.interceptor.ts  # attach bearer token
│       │   │   └── error.interceptor.ts # toast on {error,code}; 401→login
│       │   ├── services/
│       │   │   ├── api.ts                # base url + typed get/post helpers + pagination
│       │   │   ├── idle-timeout.service.ts  # 10-min idle → warn → park → logout
│       │   │   ├── settings.service.ts
│       │   │   └── print.service.ts     # thermal receipt + barcode label
│       │   └── models/                  # User, Role, Permission, Product, Batch, Sale, ...
│       │
│       ├── shared/                  # reusable DUMB components + pipes + directives
│       │   ├── components/
│       │   │   ├── data-table/          # paginated table bound to {data,total,page,pageSize}
│       │   │   ├── page-header/
│       │   │   ├── stat-card/           # dashboard KPI tile
│       │   │   ├── search-box/
│       │   │   ├── barcode-input/       # auto-focus scan field
│       │   │   ├── money-input/
│       │   │   ├── date-range-picker/   # CDK overlay based
│       │   │   ├── confirm-dialog/      # CDK dialog
│       │   │   ├── modal/               # CDK overlay wrapper
│       │   │   ├── toast/
│       │   │   ├── empty-state/
│       │   │   └── pagination/
│       │   ├── directives/
│       │   │   └── has-permission.directive.ts   # *appHasPermission="'products.create'"
│       │   └── pipes/
│       │       └── money.pipe.ts
│       │
│       ├── layout/
│       │   ├── pos-layout/
│       │   └── dashboard-layout/        # sidebar items rendered by permission
│       │
│       └── features/
│           ├── auth/login/
│           ├── pos/                     # POS MODULE (lazy, PosLayout)
│           │   ├── pos.routes.ts
│           │   ├── register/            # the checkout page
│           │   ├── held-sales/
│           │   ├── components/          # cart-line, payment-dialog, batch-picker, product-grid
│           │   └── pos.service.ts
│           ├── dashboard/               # DASHBOARD MODULE (lazy, DashboardLayout)
│           │   ├── dashboard.routes.ts
│           │   ├── overview/            # KPI page
│           │   └── dashboard.service.ts
│           ├── products/   (+ products.service.ts)
│           ├── categories/
│           ├── units/
│           ├── purchases/
│           ├── inventory/
│           ├── suppliers/
│           ├── expenses/
│           ├── customers/
│           ├── shifts/
│           ├── reports/
│           ├── users/
│           ├── roles/                   # role builder: permission checkboxes per module
│           └── settings/
```

> Rule: **one service per feature** (mirrors the API module), all HTTP through `core/services/api.ts`. Feature pages compose **shared dumb components** — no copy-pasted tables/forms.

## Routing & role-based landing

```
/login                          → LoginPage (public)
/pos            (PosLayout)     → register        [authGuard, perm: sales.create, shiftGuard]
/pos/held                       → held sales
/app            (DashboardLayout)
  /app/dashboard                → overview        [authGuard]
  /app/products                 → [perm: products.read]
  /app/purchases                → [perm: purchases.read]
  /app/inventory                → [perm: inventory.read]
  /app/expenses                 → [perm: expenses.read]
  /app/reports                  → tiles per *.view permissions
  /app/users                    → [perm: users.read]
  /app/roles                    → [perm: roles.read]
  /app/settings                 → [perm: settings.update]
```

**Landing after login** (`AuthService.redirectAfterLogin()`):
1. If `must_change_password` → force change-password page first.
2. Read `default_landing` for the user's role from settings (overridable).
3. Default rule: role with `sales.create` but **without** dashboard/management perms → `/pos`. Otherwise → `/app/dashboard`.
4. Cashier entering `/pos` with no open shift → **Open Shift** dialog first (`shiftGuard`).

Manager/Admin dashboard shows a big **"Open POS / Sell"** button → `/pos`; POS top bar shows **"Dashboard"** back-link only if the user has dashboard access.

## Guards
- `authGuard` — token valid, else `/login`.
- `permissionGuard` — `route.data.permission` is in `AuthStore.permissions`, else 403 page.
- `shiftGuard` — POS register requires an open shift; otherwise prompt to open one.

## Idle-timeout service (10 min, configurable)
- Listens to `mousemove/keydown/click/scan` globally; debounced timer.
- `idle_logout_minutes` from settings (default **10**).
- At threshold: show **30-second "Are you still there?"** modal.
- No response → if POS register has an unsaved cart, **auto-park it (hold)** via `POST /sales/:id/hold`, then `auth.logout()` → `/login`.
- Any activity resets the timer; warning modal cancels on interaction.

## State & data
- **Signals** for screen state; `AuthStore` (user/permissions) and `CartStore` (current cart) as root signal stores.
- Lists use the shared **data-table** + **pagination** components wired to server params (`page,pageSize,sort,order,q,from,to`).
- `MoneyPipe` renders `*_minor` integers with the shop currency.

## Performance / no-redundancy practices
- Lazy-load `pos` and `dashboard` modules + each heavy feature route.
- Reusable shared components everywhere (tables, dialogs, inputs) → less code, smaller bundle.
- `OnPush`-style signals, `trackBy` in lists, debounce search inputs.
- Tailwind purges unused classes at build → tiny CSS.
