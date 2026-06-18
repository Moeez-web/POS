import type { DB } from '../../db/connection';
import type { AuthUser } from '../../types/express';
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { writeAudit } from '../../lib/audit';
import { sumMinor } from '../../lib/money';
import { NotFound } from '../../lib/errors';
import * as batches from '../batches/batches.repo';
import { recordMovement } from '../inventory/inventory.repo';

export interface PurchaseItemInput {
  product_id: number;
  qty: number;
  purchase_price_minor: number;
  sale_price_minor: number;
  batch_no?: string | null;
  mfg_date?: string | null;
  expiry_date?: string | null;
}

export interface PurchaseInput {
  supplier_id?: number | null;
  invoice_no?: string | null;
  date?: string;
  discount_minor?: number;
  tax_minor?: number;
  paid_minor?: number;
  items: PurchaseItemInput[];
}

/** Records a purchase and creates one batch per line (each with its own cost & sale price). */
export function create(db: DB, input: PurchaseInput, user: AuthUser) {
  for (const it of input.items) {
    if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(it.product_id)) {
      throw new NotFound(`Product ${it.product_id} not found`);
    }
  }

  return runInUnitOfWork(db, ({ db }) => {
    const subtotal = sumMinor(input.items.map((i) => i.purchase_price_minor * i.qty));
    const discount = input.discount_minor ?? 0;
    const tax = input.tax_minor ?? 0;
    const total = subtotal - discount + tax;
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO purchases (invoice_no, supplier_id, user_id, date, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?)`,
      )
      .run(
        input.invoice_no ?? null,
        input.supplier_id ?? null,
        user.id,
        input.date ?? now,
        subtotal,
        discount,
        tax,
        total,
        input.paid_minor ?? total,
        now,
      );
    const purchaseId = Number(info.lastInsertRowid);

    for (const it of input.items) {
      db.prepare(
        'INSERT INTO purchase_items (purchase_id, product_id, qty, purchase_price_minor, sale_price_minor) VALUES (?, ?, ?, ?, ?)',
      ).run(purchaseId, it.product_id, it.qty, it.purchase_price_minor, it.sale_price_minor);

      const batchId = batches.create(db, {
        product_id: it.product_id,
        purchase_id: purchaseId,
        batch_no: it.batch_no ?? null,
        purchase_price_minor: it.purchase_price_minor,
        sale_price_minor: it.sale_price_minor,
        qty: it.qty,
        mfg_date: it.mfg_date,
        expiry_date: it.expiry_date,
      });
      recordMovement(db, {
        product_id: it.product_id,
        batch_id: batchId,
        type: 'purchase',
        qty: it.qty,
        ref_table: 'purchases',
        ref_id: purchaseId,
        user_id: user.id,
      });
    }

    writeAudit(db, { user_id: user.id, action: 'purchases.create', entity: 'purchase', entity_id: purchaseId });
    return get(db, purchaseId);
  });
}

export function get(db: DB, id: number) {
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
  if (!purchase) throw new NotFound('Purchase not found');
  const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(id);
  return { ...purchase, items };
}
