# API Specification

Base URL: `http://localhost:PORT/api`
Auth: `Authorization: Bearer <token>` (except `/auth/login`).
Success: `{ data }` · **List:** `{ data, total, page, pageSize }` · Error: `{ error, code }`.
**Perm** column = the permission key required (from `02-roles-and-permissions.md`). `—` = any authenticated user.

## Standard query params
- **Pagination (all list endpoints):** `?page=1&pageSize=25&sort=&order=asc|desc&q=<search>`
- **Date filters (reports & dated lists):** `?from=YYYY-MM-DD&to=YYYY-MM-DD` (or `?date=` for daily)

## Auth
| Method | Path | Perm | Purpose |
|---|---|---|---|
| POST | `/auth/login` | public | `{username,password}` → `{token, user, permissions[]}` |
| GET | `/auth/me` | — | current user + permission keys |
| POST | `/auth/logout` | — | invalidate session |
| POST | `/auth/change-password` | — | self change (clears must_change_password) |

## Users
| GET | `/users` | `users.read` | paginated |
| POST | `/users` | `users.create` | `{username,full_name,role_id,password}` |
| GET | `/users/:id` | `users.read` | |
| PATCH | `/users/:id` | `users.update` | edit / activate / change role |
| POST | `/users/:id/reset-password` | `users.update` | |

## Roles & permissions  (admin RBAC)
| GET | `/permissions` | `roles.read` | full permission catalog (grouped by module) |
| GET | `/roles` | `roles.read` | list roles |
| POST | `/roles` | `roles.create` | `{name,description,permission_ids[]}` |
| GET | `/roles/:id` | `roles.read` | role + its permission keys |
| PATCH | `/roles/:id` | `roles.update` | rename / **replace grants** (UoW); system roles limited |
| DELETE | `/roles/:id` | `roles.delete` | non-system, unused roles only |

## Categories / Units
| GET | `/categories` `/units` | `categories.read`/`units.read` | list |
| POST | `/categories` `/units` | `*.create` | create |
| PATCH | `/categories/:id` `/units/:id` | `*.update` | |
| DELETE | `/categories/:id` `/units/:id` | `*.delete` | soft delete |

## Products
| GET | `/products` | `products.read` | paginated; cost hidden w/o `reports.profit.view` |
| GET | `/products/search?q=` | `products.read` | type-ahead |
| GET | `/products/barcode/:code` | `products.read` | **scan → product (+batch per strategy)** |
| GET | `/products/:id` | `products.read` | |
| POST | `/products` | `products.create` | |
| PATCH | `/products/:id` | `products.update` | |
| POST | `/products/:id/barcodes` | `products.barcode.manage` | add barcode |
| DELETE | `/products/:id/barcodes/:bid` | `products.barcode.manage` | remove |
| GET | `/products/:id/label` | `products.read` | barcode label (thermal print) |

## Suppliers
| GET/POST | `/suppliers` | `suppliers.read`/`.create` | |
| PATCH/DELETE | `/suppliers/:id` | `suppliers.update`/`.delete` | |

## Purchases & Batches
| GET | `/purchases` | `purchases.read` | paginated, date filter |
| POST | `/purchases` | `purchases.create` | **creates batches** (UoW) |
| GET | `/purchases/:id` | `purchases.read` | |
| GET | `/products/:id/batches` | `batches.read` | |
| GET | `/batches/expiring?days=30` | `batches.read` | |
| PATCH | `/batches/:id` | `batches.update` | adjust qty / sale price (audited) |

## Inventory
| GET | `/inventory` | `inventory.read` | paginated stock levels |
| GET | `/inventory/low-stock` | `inventory.read` | qty ≤ reorder |
| POST | `/inventory/adjustment` | `inventory.adjust` | qty correction + reason (UoW, audited) |

## Sales / Checkout
| GET | `/sales` | `sales.read` (own: `sales.read.own`) | paginated, date filter |
| GET | `/sales/:id` | `sales.read`/`.own` | detail / reprint |
| POST | `/sales` | `sales.create` | **checkout** (UoW) |
| POST | `/sales/:id/hold` | `sales.hold` | park |
| GET | `/sales/held` | `sales.hold` | parked list |
| POST | `/sales/:id/resume` | `sales.hold` | resume |

### POST `/sales` request
```json
{
  "customer_id": null,
  "items": [ { "product_id": 12, "qty": 2, "discount_minor": 0, "batch_id": null } ],
  "discount_minor": 0,
  "payments": [ { "method": "cash", "amount_minor": 50000 } ]
}
```
`batch_id` null unless strategy=`cashier`. Server computes tax, totals, change, batch split, cost snapshot.

## Returns
| POST | `/returns` | `returns.create` (+`returns.approve` if policy) | refund + restock (UoW) |
| GET | `/returns` `/returns/:id` | `returns.read` | paginated |

## Customers
| GET/POST | `/customers` | `customers.read`/`.create` | minimal name+phone |
| PATCH | `/customers/:id` | `customers.update` | |

## Expenses
| GET | `/expense-categories` | `expenses.read` | list |
| POST/PATCH | `/expense-categories` `/:id` | `expense_categories.manage` | manage |
| GET | `/expenses` | `expenses.read` | paginated, date + category filter |
| POST | `/expenses` | `expenses.create` | `{category_id,amount_minor,description,date,payment_method}` |
| PATCH | `/expenses/:id` | `expenses.update` | |
| DELETE | `/expenses/:id` | `expenses.delete` | audited |

## Shifts
| POST | `/shifts/open` | `shifts.open` | opening float |
| POST | `/shifts/close` | `shifts.close` | counted → variance |
| GET | `/shifts/current` | `shifts.read.own` | own open shift |
| GET | `/shifts` | `shifts.read.all` | paginated |

## Reports  (all support `from`/`to`)
| GET | `/reports/daily?date=` | `reports.daily.view` | daily summary (own if only own) |
| GET | `/reports/sales?by=product\|category\|cashier` | `reports.sales.view` | breakdowns |
| GET | `/reports/profit` | `reports.profit.view` | gross & **net (− expenses)**; never w/o perm |
| GET | `/reports/inventory-valuation` | `reports.inventory_valuation.view` | stock at cost |
| GET | `/reports/expenses?by=category` | `reports.expenses.view` | expense breakdown |
| GET | `/reports/shift/:id` | `reports.shift.view` | Z report |
| GET | `/reports/activity` | `reports.activity.view` | **audit log** (admin) |

## Settings
| GET | `/settings` | `settings.read` | full (cashier-relevant subset if no perm) |
| PUT | `/settings` | `settings.update` | shop, receipt, **batch strategy**, discount cap, printer |

## Status codes
`200` ok · `201` created · `400` validation · `401` unauthenticated · `403` no permission · `404` not found · `409` conflict (insufficient stock, duplicate barcode/SKU/role name) · `500` server.
