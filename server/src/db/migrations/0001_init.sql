-- 0001_init: full POS schema (docs/03-database-schema.md). Money is INTEGER minor units.

-- ── Access control ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT NOT NULL UNIQUE,
  module      TEXT NOT NULL,
  action      TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  full_name            TEXT,
  role_id              INTEGER NOT NULL REFERENCES roles(id),
  is_active            INTEGER NOT NULL DEFAULT 1,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER REFERENCES users(id),
  action     TEXT NOT NULL,
  entity     TEXT,
  entity_id  INTEGER,
  details    TEXT,
  created_at TEXT NOT NULL
);

-- ── Settings & reference ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  short_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  parent_id  INTEGER REFERENCES categories(id),
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ── Products ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sku           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  category_id   INTEGER REFERENCES categories(id),
  unit_id       INTEGER REFERENCES units(id),
  tax_rate      REAL NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  image_path    TEXT,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS product_barcodes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode    TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

-- ── Suppliers & purchasing ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  balance_minor INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT,
  supplier_id    INTEGER REFERENCES suppliers(id),
  user_id        INTEGER REFERENCES users(id),
  date           TEXT NOT NULL,
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor      INTEGER NOT NULL DEFAULT 0,
  total_minor    INTEGER NOT NULL DEFAULT 0,
  paid_minor     INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'received',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id          INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id           INTEGER NOT NULL REFERENCES products(id),
  qty                  INTEGER NOT NULL,
  purchase_price_minor INTEGER NOT NULL,
  sale_price_minor     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id           INTEGER NOT NULL REFERENCES products(id),
  purchase_id          INTEGER REFERENCES purchases(id),
  batch_no             TEXT,
  purchase_price_minor INTEGER NOT NULL,
  sale_price_minor     INTEGER NOT NULL,
  qty_received         INTEGER NOT NULL,
  qty_remaining        INTEGER NOT NULL,
  mfg_date             TEXT,
  expiry_date          TEXT,
  created_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id, created_at);

-- ── Sales ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  phone      TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shifts (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  opened_at           TEXT NOT NULL,
  closed_at           TEXT,
  opening_float_minor INTEGER NOT NULL DEFAULT 0,
  counted_minor       INTEGER,
  expected_minor      INTEGER,
  variance_minor      INTEGER,
  status              TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS sales (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no     TEXT,
  user_id        INTEGER NOT NULL REFERENCES users(id),
  customer_id    INTEGER REFERENCES customers(id),
  shift_id       INTEGER REFERENCES shifts(id),
  subtotal_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor INTEGER NOT NULL DEFAULT 0,
  tax_minor      INTEGER NOT NULL DEFAULT 0,
  total_minor    INTEGER NOT NULL DEFAULT 0,
  paid_minor     INTEGER NOT NULL DEFAULT 0,
  change_minor   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'completed',
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id          INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id),
  batch_id         INTEGER REFERENCES batches(id),
  qty              INTEGER NOT NULL,
  unit_price_minor INTEGER NOT NULL,
  cost_price_minor INTEGER NOT NULL DEFAULT 0,
  discount_minor   INTEGER NOT NULL DEFAULT 0,
  line_total_minor INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id      INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method       TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  original_sale_id INTEGER NOT NULL REFERENCES sales(id),
  user_id          INTEGER NOT NULL REFERENCES users(id),
  approved_by      INTEGER REFERENCES users(id),
  total_minor      INTEGER NOT NULL DEFAULT 0,
  reason           TEXT,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS return_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  return_id    INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  qty          INTEGER NOT NULL,
  batch_id     INTEGER REFERENCES batches(id),
  amount_minor INTEGER NOT NULL
);

-- ── Inventory audit & expenses ───────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  batch_id   INTEGER REFERENCES batches(id),
  type       TEXT NOT NULL,
  qty        INTEGER NOT NULL,
  ref_table  TEXT,
  ref_id     INTEGER,
  note       TEXT,
  user_id    INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_category_id INTEGER REFERENCES expense_categories(id),
  amount_minor        INTEGER NOT NULL,
  description         TEXT,
  payment_method      TEXT,
  date                TEXT NOT NULL,
  user_id             INTEGER REFERENCES users(id),
  created_at          TEXT NOT NULL,
  updated_at          TEXT
);
