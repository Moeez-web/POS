# Database Schema (SQLite)

Single file `pos.db`, `better-sqlite3`. Foreign keys ON. Money stored as **INTEGER minor units** (e.g. paisa/cents) to avoid float errors. Timestamps are ISO-8601 TEXT (UTC). All tables get audit fields where it matters.

## Conventions
- PK: `id INTEGER PRIMARY KEY AUTOINCREMENT`
- Money: integer minor units (`price_minor`), formatted in UI
- Audit: `created_at`, `updated_at`, `created_by` (FK users.id) where relevant
- Soft delete via `is_active` (no hard deletes on master data)

## Tables

### users
| col | type | notes |
|---|---|---|
| id | INTEGER PK | |
| username | TEXT UNIQUE | login |
| password_hash | TEXT | bcrypt |
| full_name | TEXT | |
| role_id | FK roles | one role per user |
| is_active | INTEGER | 0/1 |
| must_change_password | INTEGER | 0/1 |
| created_at, updated_at | TEXT | |

### roles  *(admin-managed)*
`id`, `name` UNIQUE, `description`, `is_system` (0/1 — admin/manager/cashier seeded, undeletable), `created_at`, `updated_at`.

### permissions  *(fixed catalog, app-seeded)*
`id`, `key` UNIQUE (`module.action`), `module`, `action`, `description`.
Seeded from the catalog in `02-roles-and-permissions.md`. Not user-created.

### role_permissions  *(grants, many-to-many)*
`role_id` FK, `permission_id` FK, PRIMARY KEY(`role_id`,`permission_id`).

### activity_logs
| id | user_id FK | action | entity | entity_id | details(JSON) | created_at |
Records logins, price changes, refunds, adjustments, settings/user changes.

### schema_migrations  *(version updates)*
`id INTEGER PK` (migration number) · `name TEXT` · `applied_at TEXT` · `app_version TEXT`.
Tracks which migrations have run so launch-time migration applies only pending ones. See `09-versioning-and-updates.md`.

### settings
Key-value. `key TEXT PK`, `value TEXT`, `updated_by`, `updated_at`.
Seeded keys: `shop_name`, `shop_address`, `shop_phone`, `currency`, `tax_mode`,
`receipt_header`, `receipt_footer`, `batch_selection_strategy` (fifo|cashier|latest),
`cashier_max_discount_percent`, `idle_logout_minutes`, `low_stock_global`.

### units
`id`, `name`, `short_name`, `created_at`.

### categories
`id`, `name`, `parent_id` (nullable self-FK), `is_active`, `created_at`.

### products
| col | type | notes |
|---|---|---|
| id | INTEGER PK | |
| sku | TEXT UNIQUE | |
| name | TEXT | |
| category_id | FK categories | |
| unit_id | FK units | |
| tax_rate | REAL | % |
| reorder_level | INTEGER | low-stock threshold |
| image_path | TEXT | optional |
| is_active | INTEGER | |
| created_at, updated_at, created_by | | |

### product_barcodes  *(multi-barcode)*
`id`, `product_id` FK, `barcode TEXT UNIQUE`, `created_at`.
Many barcodes → one product. Scanning any of them resolves the product.

### suppliers
`id`, `name`, `phone`, `email`, `address`, `balance_minor`, `is_active`, `created_at`.

### purchases  *(GRN header)*
`id`, `invoice_no`, `supplier_id` FK, `user_id` FK, `date`,
`subtotal_minor`, `discount_minor`, `tax_minor`, `total_minor`, `paid_minor`,
`status` (`received`/`partial`), `created_at`.

### purchase_items
`id`, `purchase_id` FK, `product_id` FK, `qty`,
`purchase_price_minor`, `sale_price_minor`.
→ Creating a purchase item **creates a `batches` row**.

### batches  *(the heart of the system)*
| col | type | notes |
|---|---|---|
| id | INTEGER PK | |
| product_id | FK products | |
| purchase_id | FK purchases (nullable) | origin |
| batch_no | TEXT | auto or manual |
| purchase_price_minor | INTEGER | **cost for this batch** |
| sale_price_minor | INTEGER | **sale price for this batch** |
| qty_received | INTEGER | |
| qty_remaining | INTEGER | live stock for this batch |
| mfg_date, expiry_date | TEXT nullable | |
| created_at | TEXT | FIFO order |

### sales  *(receipt header)*
| id | invoice_no | user_id FK | customer_id FK? | shift_id FK |
| subtotal_minor | discount_minor | tax_minor | total_minor |
| paid_minor | change_minor | status (`completed`/`returned`/`held`) | created_at |

### sale_items
| col | notes |
|---|---|
| id, sale_id FK, product_id FK | |
| batch_id FK | which batch this qty came from |
| qty | |
| unit_price_minor | sale price charged |
| cost_price_minor | **snapshot of batch cost → profit** |
| discount_minor | line discount |
| line_total_minor | |

A single cart line spanning two batches (FIFO crossed a batch boundary) becomes **two `sale_items`**, each with its own batch + cost.

### payments  *(split payment)*
`id`, `sale_id` FK, `method` (`cash`/`card`/…), `amount_minor`, `created_at`.

### returns
`id`, `original_sale_id` FK, `user_id` FK, `approved_by` FK?, `total_minor`,
`reason`, `created_at`.

### return_items
`id`, `return_id` FK, `sale_item_id` FK, `qty`, `batch_id` FK, `amount_minor`.
→ Increments `batches.qty_remaining` (restock) + writes `inventory_movements`.

### customers  *(optional, minimal, no credit)*
`id`, `name`, `phone`, `is_active`, `created_at`.

### expense_categories
`id`, `name` UNIQUE, `is_active`, `created_at`.

### expenses
| col | type | notes |
|---|---|---|
| id | INTEGER PK | |
| expense_category_id | FK expense_categories | |
| amount_minor | INTEGER | |
| description | TEXT | |
| payment_method | TEXT | cash/card/bank (optional) |
| date | TEXT | expense date |
| user_id | FK users | created_by |
| created_at, updated_at | TEXT | |

Expenses feed the **expense report** and reduce gross profit → **net profit** in the profit report.

### shifts  *(cash drawer)*
`id`, `user_id` FK, `opened_at`, `closed_at`, `opening_float_minor`,
`counted_minor`, `expected_minor`, `variance_minor`, `status` (`open`/`closed`).

### inventory_movements  *(stock audit trail)*
`id`, `product_id` FK, `batch_id` FK, `type` (`purchase`/`sale`/`return`/`adjustment`),
`qty` (+/-), `ref_table`, `ref_id`, `note`, `user_id` FK, `created_at`.

## Key relationships

```
roles ─< role_permissions >─ permissions
roles ─< users
categories ─< products ─< product_barcodes
units ──────< products
products ─< batches >─ purchases >─ suppliers
purchases ─< purchase_items ─→ (creates) batches
sales ─< sale_items >─ batches          (sale_items snapshot cost)
sales ─< payments
sales ─< returns ─< return_items >─ batches
products/batches ─< inventory_movements
expense_categories ─< expenses >─ users
users ─< sales, purchases, shifts, expenses, activity_logs
```

## Stock & profit math
- **Live stock(product)** = `SUM(batches.qty_remaining)` for that product.
- **Checkout** deducts `qty_remaining` from batch(es) per `batch_selection_strategy`.
- **Profit(sale_item)** = `(unit_price_minor − discount_per_unit) − cost_price_minor) × qty`.
- **Inventory valuation** = `SUM(qty_remaining × purchase_price_minor)` across batches.
