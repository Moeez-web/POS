# Feature List

> Scope for **v1** (build now) vs **v2** (later). On-premise, single store.

## v1 — In scope

### 1. Authentication, users & dynamic roles
- Login with username + password (hashed)
- **Default roles auto-created on first run:** admin, manager, cashier
- **Default admin user auto-created** (`admin` / must change password on first login)
- **Admin-managed RBAC:** admin can **create custom roles** and grant **feature-wise CRUD permissions** (create/read/update/delete per module), **including which reports each role can see**
- Create / edit / deactivate users; assign a role; reset password
- Auto-logout on idle (configurable)

### 2. Products & catalog
- Create / edit / deactivate products
- Fields: SKU, name, category, unit, tax rate, reorder level, image (optional)
- **Multi-barcode per product** (add/remove barcodes; old + new both scan)
- Categories (with optional parent for sub-categories)
- Units of measure (pcs, kg, box, dozen, …)
- **Barcode label printing** (generate + print a tag for a product/batch)

### 3. Purchasing & batches
- Record a purchase (GRN) from a supplier
- Each purchase line **creates a batch** with its own **purchase price** and **sale price**
- Optional mfg date / expiry date per batch
- Suppliers: create / edit, basic contact + running balance
- View batches per product; adjust a batch's remaining qty / sale price (admin/manager)
- **Expiring batches** view

### 4. Inventory
- Live stock = sum of `qty_remaining` across batches
- **Low-stock alerts** (qty ≤ reorder level)
- Stock **adjustments** (damage, count correction) with reason → audited
- `inventory_movements` audit trail for every change

### 5. Sales / checkout (the cashier screen)
- Fast cart: **barcode scan** or search to add items
- Quantity edit, line discount, whole-cart discount
- Tax calculation per product tax rate
- **Batch selection** governed by admin setting (FIFO default)
- **Split payment** (e.g. part cash + part card)
- Change calculation
- **Hold / park sale** and resume later
- **Receipt printing** (thermal or standard printer; configurable header/footer)
- Each sale line snapshots the **batch cost** → enables profit reporting

### 6. Returns / refunds
- Return against an original sale (full or partial)
- **Restocks** the batch it came from
- Reason captured; audited
- Refund recorded against payment method

### 7. Shifts / cash drawer
- Open shift with opening float
- Close shift: counted cash vs expected → variance
- Per-cashier shift report (X / Z style)

### 8. Reports (access by role — see doc 02)
- Daily sales summary
- Sales by product / category / cashier
- **Profit report** — gross (sale − per-batch cost) and **net (− expenses)** *(permission-gated)*
- **Expense report** (by category, date range) *(permission-gated)*
- Inventory valuation *(permission-gated)*
- Low-stock report
- Shift / cash-drawer report
- **Activity / audit log** *(admin only)*

### 9. Expenses
- Record store expenses (rent, utilities, salaries, misc) with amount, date, category, note
- Manage **expense categories**
- Permission-gated (create/read/update/delete)
- Feeds the **expense report**; **net profit = gross profit − expenses**

### 10. Settings (admin)
- Shop profile (name, address, phone, logo)
- Receipt header / footer text
- Currency & tax mode
- **Batch selection strategy** (FIFO / cashier-picks / latest-price)
- Printer settings, idle-logout timeout

### 11. Customers (optional, minimal)
- Name + phone only, no credit
- Attach to a sale for receipt/report; walk-in needs none

## v2 — Later (explicitly NOT in v1)

- Loyalty points / rewards
- Quotations / estimates
- Multi-location & stock transfer
- Supplier purchase-order approval workflow
- Expense tracking
- Customer credit / khata ledger *(dropped by request)*
- Cloud sync / multi-device *(on-prem only by request)*
