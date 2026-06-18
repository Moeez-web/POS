import type { DB } from '../../db/connection';

export interface Batch {
  id: number;
  product_id: number;
  purchase_id: number | null;
  batch_no: string | null;
  purchase_price_minor: number;
  sale_price_minor: number;
  qty_received: number;
  qty_remaining: number;
  mfg_date: string | null;
  expiry_date: string | null;
  created_at: string;
}

export function create(
  db: DB,
  input: {
    product_id: number;
    purchase_id?: number | null;
    batch_no?: string | null;
    purchase_price_minor: number;
    sale_price_minor: number;
    qty: number;
    mfg_date?: string | null;
    expiry_date?: string | null;
  },
): number {
  const info = db
    .prepare(
      `INSERT INTO batches
        (product_id, purchase_id, batch_no, purchase_price_minor, sale_price_minor, qty_received, qty_remaining, mfg_date, expiry_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.product_id,
      input.purchase_id ?? null,
      input.batch_no ?? null,
      input.purchase_price_minor,
      input.sale_price_minor,
      input.qty,
      input.qty,
      input.mfg_date ?? null,
      input.expiry_date ?? null,
      new Date().toISOString(),
    );
  return Number(info.lastInsertRowid);
}

export function byId(db: DB, id: number): Batch | undefined {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as Batch | undefined;
}

export function byProduct(db: DB, productId: number): Batch[] {
  return db.prepare('SELECT * FROM batches WHERE product_id = ? ORDER BY created_at ASC').all(productId) as Batch[];
}

/** Open batches (stock remaining), oldest first — the FIFO order for deduction. */
export function openFifo(db: DB, productId: number): Batch[] {
  return db
    .prepare('SELECT * FROM batches WHERE product_id = ? AND qty_remaining > 0 ORDER BY created_at ASC, id ASC')
    .all(productId) as Batch[];
}

/** The newest batch with stock — used by the `latest` pricing strategy. */
export function newestWithStock(db: DB, productId: number): Batch | undefined {
  return db
    .prepare('SELECT * FROM batches WHERE product_id = ? AND qty_remaining > 0 ORDER BY created_at DESC, id DESC LIMIT 1')
    .get(productId) as Batch | undefined;
}

export function totalStock(db: DB, productId: number): number {
  return Number(
    (db.prepare('SELECT COALESCE(SUM(qty_remaining),0) s FROM batches WHERE product_id = ?').get(productId) as { s: number }).s,
  );
}

export function changeRemaining(db: DB, batchId: number, delta: number): void {
  db.prepare('UPDATE batches SET qty_remaining = qty_remaining + ? WHERE id = ?').run(delta, batchId);
}

export function expiring(db: DB, days: number): Batch[] {
  const cutoff = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return db
    .prepare(
      'SELECT * FROM batches WHERE qty_remaining > 0 AND expiry_date IS NOT NULL AND expiry_date <= ? ORDER BY expiry_date ASC',
    )
    .all(cutoff) as Batch[];
}
