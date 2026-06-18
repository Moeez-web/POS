import type { DB } from './connection';
import { hashPassword } from '../lib/password';

/** The fixed permission catalog (docs/02). module.action keys. */
export const PERMISSION_KEYS: string[] = [
  // users
  'users.create', 'users.read', 'users.update', 'users.delete',
  // roles & permissions
  'roles.create', 'roles.read', 'roles.update', 'roles.delete', 'roles.assign',
  // products
  'products.create', 'products.read', 'products.update', 'products.delete', 'products.barcode.manage',
  // categories / units
  'categories.create', 'categories.read', 'categories.update', 'categories.delete',
  'units.create', 'units.read', 'units.update', 'units.delete',
  // suppliers / purchases / batches
  'suppliers.create', 'suppliers.read', 'suppliers.update', 'suppliers.delete',
  'purchases.create', 'purchases.read', 'purchases.update',
  'batches.read', 'batches.update',
  // inventory
  'inventory.read', 'inventory.adjust',
  // sales
  'sales.create', 'sales.read', 'sales.read.own', 'sales.hold', 'sales.delete',
  // returns
  'returns.create', 'returns.approve', 'returns.read',
  // customers
  'customers.create', 'customers.read', 'customers.update',
  // shifts
  'shifts.open', 'shifts.close', 'shifts.read.own', 'shifts.read.all',
  // expenses
  'expenses.create', 'expenses.read', 'expenses.update', 'expenses.delete', 'expense_categories.manage',
  // settings
  'settings.read', 'settings.update',
  // reports
  'reports.daily.view', 'reports.sales.view', 'reports.profit.view',
  'reports.inventory_valuation.view', 'reports.expenses.view', 'reports.shift.view', 'reports.activity.view',
];

const CASHIER_GRANTS = new Set<string>([
  'sales.create', 'sales.read.own', 'sales.hold',
  'returns.create',
  'shifts.open', 'shifts.close', 'shifts.read.own',
  'products.read', 'inventory.read',
  'customers.create', 'customers.read', 'customers.update',
  'reports.daily.view',
]);

const MANAGER_GRANTS = new Set<string>([
  'products.create', 'products.read', 'products.update', 'products.delete', 'products.barcode.manage',
  'categories.create', 'categories.read', 'categories.update', 'categories.delete',
  'units.create', 'units.read', 'units.update', 'units.delete',
  'suppliers.create', 'suppliers.read', 'suppliers.update', 'suppliers.delete',
  'purchases.create', 'purchases.read', 'purchases.update',
  'batches.read', 'batches.update',
  'inventory.read', 'inventory.adjust',
  'sales.create', 'sales.read', 'sales.read.own', 'sales.hold',
  'returns.create', 'returns.approve', 'returns.read',
  'customers.create', 'customers.read', 'customers.update',
  'expenses.create', 'expenses.read', 'expenses.update', 'expense_categories.manage',
  'shifts.open', 'shifts.close', 'shifts.read.own', 'shifts.read.all',
  'settings.read',
  'reports.daily.view', 'reports.sales.view', 'reports.profit.view',
  'reports.inventory_valuation.view', 'reports.expenses.view', 'reports.shift.view',
]);

function moduleAction(key: string): { module: string; action: string } {
  const i = key.indexOf('.');
  return { module: key.slice(0, i), action: key.slice(i + 1) };
}

function ensurePermissions(db: DB): Map<string, number> {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO permissions (key, module, action, description) VALUES (?, ?, ?, ?)',
  );
  for (const key of PERMISSION_KEYS) {
    const { module, action } = moduleAction(key);
    insert.run(key, module, action, `${action} ${module}`);
  }
  const rows = db.prepare('SELECT id, key FROM permissions').all() as { id: number; key: string }[];
  return new Map(rows.map((r) => [r.key, Number(r.id)]));
}

function ensureRole(db: DB, name: string, description: string): number {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT OR IGNORE INTO roles (name, description, is_system, created_at, updated_at) VALUES (?, ?, 1, ?, ?)',
  ).run(name, description, now, now);
  const row = db.prepare('SELECT id FROM roles WHERE name = ?').get(name) as { id: number };
  return Number(row.id);
}

function grant(db: DB, roleId: number, permIds: number[]): void {
  const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const pid of permIds) ins.run(roleId, pid);
}

/** Idempotent first-run bootstrap. Safe to call on every launch (docs/02). */
export function seed(db: DB): void {
  const permByKey = ensurePermissions(db);
  const allIds = [...permByKey.values()];

  const adminRole = ensureRole(db, 'admin', 'Full system access');
  const managerRole = ensureRole(db, 'manager', 'Operations & business reports');
  const cashierRole = ensureRole(db, 'cashier', 'Checkout & own shift');

  grant(db, adminRole, allIds); // admin gets everything
  grant(db, managerRole, [...MANAGER_GRANTS].map((k) => permByKey.get(k)!).filter(Boolean));
  grant(db, cashierRole, [...CASHIER_GRANTS].map((k) => permByKey.get(k)!).filter(Boolean));

  // Default admin user (must change password on first login).
  const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!existingAdmin) {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO users (username, password_hash, full_name, role_id, is_active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, 1, 1, ?)`,
    ).run('admin', hashPassword('admin123'), 'Administrator', adminRole, now);
  }

  // Ready-to-use demo cashier so the POS can be tested immediately (change the password in Users).
  const existingCashier = db.prepare('SELECT id FROM users WHERE username = ?').get('cashier');
  if (!existingCashier) {
    db.prepare(
      `INSERT INTO users (username, password_hash, full_name, role_id, is_active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, 1, 0, ?)`,
    ).run('cashier', hashPassword('cashier123'), 'Demo Cashier', cashierRole, new Date().toISOString());
  }

  // Default units.
  const unitCount = (db.prepare('SELECT COUNT(*) c FROM units').get() as { c: number }).c;
  if (Number(unitCount) === 0) {
    const now = new Date().toISOString();
    const ins = db.prepare('INSERT INTO units (name, short_name, created_at) VALUES (?, ?, ?)');
    for (const [name, short] of [['Piece', 'pcs'], ['Kilogram', 'kg'], ['Box', 'box'], ['Dozen', 'dzn']]) {
      ins.run(name, short, now);
    }
  }

  // Default expense category.
  db.prepare('INSERT OR IGNORE INTO expense_categories (name, is_active, created_at) VALUES (?, 1, ?)').run(
    'General',
    new Date().toISOString(),
  );

  // Default settings.
  const defaults: Record<string, string> = {
    shop_name: 'My Store',
    shop_address: '',
    shop_phone: '',
    currency: 'PKR',
    tax_mode: 'exclusive',
    receipt_header: 'My Store',
    receipt_footer: 'Thank you for shopping!',
    receipt_paper_width: '80',
    batch_selection_strategy: 'fifo',
    cashier_max_discount_percent: '10',
    idle_logout_minutes: '10',
    default_landing_admin: 'dashboard',
    default_landing_manager: 'dashboard',
    default_landing_cashier: 'pos',
  };
  const setIns = db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
  const now = new Date().toISOString();
  for (const [k, v] of Object.entries(defaults)) setIns.run(k, v, now);
}

// CLI: `npm run seed`
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openDb } = require('./connection');
  const { migrate } = require('./migrate');
  const { config } = require('../config');
  const db = openDb(config.dbPath);
  migrate(db, { dbPath: config.dbPath });
  seed(db);
  // eslint-disable-next-line no-console
  console.log('Seed complete.');
}
