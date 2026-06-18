import type { DB } from '../../db/connection';
import type { Pagination } from '../../lib/pagination';
import { safeSort } from '../../lib/pagination';

const SAFE = ['id', 'name', 'sku', 'created_at'];

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  unit_id: number | null;
  tax_rate: number;
  reorder_level: number;
  is_active: number;
}

/** A product row enriched with live stock and the price of its current (FIFO) batch. */
export function decorate(db: DB, p: Product) {
  const stock = (
    db.prepare('SELECT COALESCE(SUM(qty_remaining),0) s FROM batches WHERE product_id = ?').get(p.id) as { s: number }
  ).s;
  const barcodes = (
    db.prepare('SELECT barcode FROM product_barcodes WHERE product_id = ?').all(p.id) as { barcode: string }[]
  ).map((b) => b.barcode);
  // Show the most recently set price so it's visible even when stock is 0
  // (all batches share the same sale price under the simple one-price model).
  const current = db
    .prepare('SELECT sale_price_minor, purchase_price_minor FROM batches WHERE product_id = ? ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(p.id) as { sale_price_minor: number; purchase_price_minor: number } | undefined;
  return {
    ...p,
    stock: Number(stock),
    barcodes,
    sale_price_minor: current?.sale_price_minor ?? null,
    purchase_price_minor: current?.purchase_price_minor ?? null,
  };
}

export function list(db: DB, p: Pagination): { rows: unknown[]; total: number } {
  const sort = safeSort(p.sort, SAFE, 'name');
  // Match name/SKU (partial) or an exact barcode (so a scanner finds the product directly).
  const where = p.q
    ? 'WHERE is_active = 1 AND (name LIKE ? OR sku LIKE ? OR id IN (SELECT product_id FROM product_barcodes WHERE barcode = ?))'
    : 'WHERE is_active = 1';
  const args = p.q ? [`%${p.q}%`, `%${p.q}%`, p.q] : [];
  const total = (db.prepare(`SELECT COUNT(*) c FROM products ${where}`).get(...args) as { c: number }).c;
  const rows = db
    .prepare(`SELECT * FROM products ${where} ORDER BY ${sort} ${p.order} LIMIT ? OFFSET ?`)
    .all(...args, p.pageSize, p.offset) as Product[];
  return { rows: rows.map((r) => decorate(db, r)), total: Number(total) };
}

export function findById(db: DB, id: number): Product | undefined {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
}

export function search(db: DB, q: string) {
  const rows = db
    .prepare(
      `SELECT * FROM products WHERE is_active = 1
       AND (name LIKE ? OR sku LIKE ? OR id IN (SELECT product_id FROM product_barcodes WHERE barcode = ?))
       ORDER BY name LIMIT 20`,
    )
    .all(`%${q}%`, `%${q}%`, q) as Product[];
  return rows.map((r) => decorate(db, r));
}

export function findByBarcode(db: DB, code: string): Product | undefined {
  const row = db
    .prepare(
      `SELECT p.* FROM product_barcodes b JOIN products p ON p.id = b.product_id
       WHERE b.barcode = ? AND p.is_active = 1`,
    )
    .get(code) as Product | undefined;
  return row;
}

export function insert(
  db: DB,
  input: {
    sku: string;
    name: string;
    category_id?: number | null;
    unit_id?: number | null;
    tax_rate?: number;
    reorder_level?: number;
  },
  userId: number,
): number {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO products (sku, name, category_id, unit_id, tax_rate, reorder_level, is_active, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    .run(
      input.sku,
      input.name,
      input.category_id ?? null,
      input.unit_id ?? null,
      input.tax_rate ?? 0,
      input.reorder_level ?? 0,
      now,
      userId,
    );
  return Number(info.lastInsertRowid);
}

export function update(db: DB, id: number, input: Partial<Product>): void {
  const cur = findById(db, id);
  if (!cur) return;
  db.prepare(
    'UPDATE products SET name = ?, category_id = ?, unit_id = ?, tax_rate = ?, reorder_level = ?, is_active = ?, updated_at = ? WHERE id = ?',
  ).run(
    input.name ?? cur.name,
    input.category_id ?? cur.category_id,
    input.unit_id ?? cur.unit_id,
    input.tax_rate ?? cur.tax_rate,
    input.reorder_level ?? cur.reorder_level,
    input.is_active ?? cur.is_active,
    new Date().toISOString(),
    id,
  );
}

export function addBarcode(db: DB, productId: number, barcode: string): void {
  db.prepare('INSERT INTO product_barcodes (product_id, barcode, created_at) VALUES (?, ?, ?)').run(
    productId,
    barcode,
    new Date().toISOString(),
  );
}

export function removeBarcode(db: DB, productId: number, barcodeId: number): void {
  db.prepare('DELETE FROM product_barcodes WHERE id = ? AND product_id = ?').run(barcodeId, productId);
}
