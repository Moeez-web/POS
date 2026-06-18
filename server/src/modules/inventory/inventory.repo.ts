import type { DB } from '../../db/connection';

export function recordMovement(
  db: DB,
  m: {
    product_id: number;
    batch_id?: number | null;
    type: 'purchase' | 'sale' | 'return' | 'adjustment';
    qty: number;
    ref_table?: string;
    ref_id?: number;
    note?: string;
    user_id?: number;
  },
): void {
  db.prepare(
    `INSERT INTO inventory_movements (product_id, batch_id, type, qty, ref_table, ref_id, note, user_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    m.product_id,
    m.batch_id ?? null,
    m.type,
    m.qty,
    m.ref_table ?? null,
    m.ref_id ?? null,
    m.note ?? null,
    m.user_id ?? null,
    new Date().toISOString(),
  );
}

export interface StockRow {
  id: number;
  sku: string;
  name: string;
  reorder_level: number;
  stock: number;
}

export function stockLevels(db: DB, opts: { lowOnly?: boolean; limit: number; offset: number; q?: string }) {
  const filters: string[] = ['p.is_active = 1']; // removed (deactivated) products don't appear in inventory
  const args: unknown[] = [];
  if (opts.q) {
    // name/SKU (partial) or exact barcode → a scanner finds the row directly.
    filters.push('(p.name LIKE ? OR p.sku LIKE ? OR p.id IN (SELECT product_id FROM product_barcodes WHERE barcode = ?))');
    args.push(`%${opts.q}%`, `%${opts.q}%`, opts.q);
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  // Use the raw aggregate (not the `stock` alias) so HAVING also works inside the COUNT subquery.
  const having = opts.lowOnly ? 'HAVING COALESCE(SUM(b.qty_remaining),0) <= p.reorder_level' : '';
  const base = `FROM products p LEFT JOIN batches b ON b.product_id = p.id ${where} GROUP BY p.id ${having}`;
  const rows = db
    .prepare(
      `SELECT p.id, p.sku, p.name, p.reorder_level, COALESCE(SUM(b.qty_remaining),0) AS stock ${base} ORDER BY p.name LIMIT ? OFFSET ?`,
    )
    .all(...args, opts.limit, opts.offset) as StockRow[];
  const total = (db.prepare(`SELECT COUNT(*) c FROM (SELECT p.id ${base})`).get(...args) as { c: number }).c;
  return { rows, total: Number(total) };
}
