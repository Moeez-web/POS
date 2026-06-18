# Frontend Design (Angular)

Angular v19, **standalone components**, **Tailwind CSS (local) + Angular CDK** — no Angular Material. Separate `.html`/`.scss`/`.ts` files. The UI is a thin client over the REST API — it holds no business rules, only presentation + permission-based hiding of controls. **Full folder structure & workflow: see `07-angular-structure.md`.**

## How the frontend works (data flow)

```
Component ──calls──► Feature Service ──HttpClient──► /api/... ──► Express
    ▲                      │
    │                      ▼
  renders            updates Signal/State
```

- **Feature services** (e.g. `ProductsService`, `SalesService`) wrap `HttpClient`, one per module, mirroring the API.
- **State:** Angular **signals** for local screen state; a small `AuthStore` and `CartStore` for shared state. No heavy state library needed.
- **Two modules / shells:** `PosLayout` (full-screen register) and `DashboardLayout` (sidebar + topbar), lazy-loaded. Role-based landing after login (cashier → POS, manager/admin → dashboard). See `07`.
- **Auth:** `AuthInterceptor` attaches the bearer token; `401` → redirect to login. `AuthStore` holds `{user, role}`.
- **RBAC in UI:** `permissionGuard` on routes + a `*appHasPermission="'products.create'"` structural directive to hide buttons/columns. The permission list comes from `/auth/me`. Mirrors doc 02 — but the **server is the real gate**.
- **Lists:** a shared paginated table component (Material table + paginator) bound to the server `{data,total,page,pageSize}` contract; sort/search/date-range pushed to the API as query params.
- **Money:** a `MoneyPipe` formats `*_minor` integers using the shop currency from settings.
- **Errors:** central error handler shows a toast from `{error,code}`; `409` (insufficient stock, duplicate) shows a clear inline message.

## App shell & navigation

```
┌────────────────────────────────────────────────┐
│  Top bar: shop name · user · shift status · ⎋   │
├──────────┬─────────────────────────────────────┤
│ Sidebar  │                                      │
│ (role-   │            Routed view               │
│  filtered)│                                     │
│  • Sell  │                                      │
│  • Products                                     │
│  • Purchases                                    │
│  • Inventory                                    │
│  • Reports                                      │
│  • Customers                                    │
│  • Settings / Users (admin)                     │
└──────────┴─────────────────────────────────────┘
```

Sidebar items are filtered by role (cashier sees **Sell**, own shift, customers, product lookup, low-stock).

## Screens (routes)

| Route | Screen | Role | Notes |
|---|---|---|---|
| `/login` | Login | public | username + password |
| `/sell` | **Checkout** | C,M,A | the main register (below) |
| `/sell/held` | Parked sales | C,M,A | resume |
| `/products` | Product list | view C / edit M,A | search, barcodes, batches |
| `/products/:id` | Product detail | M,A | edit, barcodes, batch list |
| `/purchases` | Purchases list | M,A | |
| `/purchases/new` | Receive stock | M,A | creates batches (cost+sale price) |
| `/suppliers` | Suppliers | M,A | |
| `/inventory` | Stock levels | M,A | low-stock, adjustments |
| `/customers` | Customers | C,M,A | minimal |
| `/expenses` | Expenses | `expenses.read` | record + list, category filter, date range |
| `/reports` | Reports hub | per-permission | tiles shown only for reports the role can view |
| `/shifts` | Shifts | own / all | open/close, Z report |
| `/users` | Users | `users.read` | assign role, reset password |
| `/roles` | **Roles & permissions** | `roles.read` | create role, check permission boxes per module incl. reports |
| `/settings` | Settings | `settings.read` | shop, receipt (thermal), batch strategy, caps |

> Sidebar items and report tiles are rendered only when the user holds the matching permission — nothing hardcoded to role names, so custom admin-created roles work automatically.

## The checkout screen (most important)

```
┌───────────────────────────┬──────────────────────┐
│  Scan / search box  [⌨]   │   Cart                │
│  (barcode auto-focus)     │  item  qty  price  ✕  │
│                           │  ...                  │
│  Quick product grid       │                       │
│  (categories / favorites) │  ─────────────────    │
│                           │  Subtotal             │
│                           │  Discount             │
│                           │  Tax                  │
│                           │  TOTAL                │
│                           │  [ Hold ]  [ Pay ]    │
└───────────────────────────┴──────────────────────┘
```

Flow:
1. **Scan barcode** → `GET /products/barcode/:code` → line added; qty defaults 1, repeat scan increments.
2. Cart math is previewed client-side but **authoritative totals come from the server** on `POST /sales`.
3. If strategy = `cashier`, a **batch picker** appears for multi-batch products.
4. **Pay** opens split-payment dialog (cash/card amounts → change).
5. On success → **print receipt** (header/footer from settings) and clear cart.
6. **Hold** parks the cart (`/sales/:id/hold`) for later resume.

Cashier never sees cost/profit anywhere on this screen.

## Receipt & barcode printing
- **Receipt:** targets a **thermal receipt printer** (58mm / 80mm). An HTML receipt template sized for the paper width is rendered to a hidden print window and sent via the Electron print API to the configured thermal printer (silent print, no dialog). Header/footer/logo and paper width come from settings.
- **Barcode label:** generate a barcode image (JsBarcode) into a label template → print to the label/thermal printer.

## Component conventions
- One folder per feature under `client/src/app/features/<name>/` with `pages/`, `components/`, `<name>.service.ts`.
- Shared UI in `client/src/app/shared/` (MoneyPipe, hasRole directive, dialogs, toast).
- Core (singletons) in `client/src/app/core/` (AuthStore, interceptors, guards, ApiBase).
- Reactive forms + zod-mirrored validation messages.

## Offline reality
Everything is local already — the "server" is on the same machine, so there is no network latency or offline concern. If the Electron window reloads, the API and DB are unaffected.
