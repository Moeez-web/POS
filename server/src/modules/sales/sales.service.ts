import type { DB } from '../../db/connection';
import type { AuthUser } from '../../types/express';
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { writeAudit } from '../../lib/audit';
import { Conflict, NotFound, ValidationError } from '../../lib/errors';
import { stripCost } from '../../lib/serialize';
import { getSetting } from '../settings/settings.repo';
import * as batches from '../batches/batches.repo';
import { recordMovement } from '../inventory/inventory.repo';

export interface CheckoutItem {
  product_id: number;
  qty: number;
  discount_minor?: number;
  batch_id?: number | null;
}

export interface CheckoutInput {
  customer_id?: number | null;
  customer?: { name?: string; phone?: string; email?: string } | null;
  shift_id?: number | null;
  discount_minor?: number;
  items: CheckoutItem[];
  payments?: { method: string; amount_minor: number }[];
  hold?: boolean;
}

type Strategy = 'fifo' | 'cashier' | 'latest';

interface ResolvedLine {
  product_id: number;
  product_name: string;
  batch_id: number;
  qty: number;
  unit_price_minor: number;
  cost_price_minor: number;
  discount_minor: number;
  line_total_minor: number;
  tax_minor: number;
}

/**
 * Resolve cart items into sale-item slices using FIFO PRICING: stock is consumed oldest-batch
 * first and each slice is charged that batch's own sale price (so old stock sells at its old
 * price, new stock at the new price). 'latest' charges the newest price; 'cashier' uses a chosen
 * batch. Cost is always the slice's batch purchase price (FIFO costing).
 *
 * READ-ONLY: it tracks remaining qty in memory (never mutates the DB), so the exact same function
 * powers both the cart quote and the checkout — guaranteeing the cart total equals the receipt.
 */
function resolveSlices(db: DB, items: CheckoutItem[], strategy: Strategy): ResolvedLine[] {
  const out: ResolvedLine[] = [];
  const working = new Map<number, number>(); // batch_id -> remaining (in-memory working copy)
  const remOf = (b: batches.Batch) => (working.has(b.id) ? working.get(b.id)! : b.qty_remaining);

  for (const item of items) {
    const product = db.prepare('SELECT id, name, tax_rate FROM products WHERE id = ? AND is_active = 1').get(item.product_id) as
      | { id: number; name: string; tax_rate: number }
      | undefined;
    if (!product) throw new NotFound(`Product ${item.product_id} not found`);
    if (item.qty <= 0) throw new ValidationError('Quantity must be positive');

    const taxRate = product.tax_rate;
    const discountPerUnit = Math.floor((item.discount_minor ?? 0) / item.qty);
    const push = (batch: batches.Batch, qty: number, priceMinor: number) => {
      working.set(batch.id, remOf(batch) - qty);
      const discount = discountPerUnit * qty;
      const lineTotal = priceMinor * qty - discount;
      out.push({
        product_id: item.product_id,
        product_name: product.name,
        batch_id: batch.id,
        qty,
        unit_price_minor: priceMinor,
        cost_price_minor: batch.purchase_price_minor,
        discount_minor: discount,
        line_total_minor: lineTotal,
        tax_minor: Math.round((lineTotal * taxRate) / 100),
      });
    };

    if (strategy === 'cashier') {
      if (!item.batch_id) throw new ValidationError('Batch must be selected for this item');
      const batch = batches.byId(db, item.batch_id);
      if (!batch || batch.product_id !== item.product_id) throw new NotFound('Batch not found for product');
      if (remOf(batch) < item.qty) throw new Conflict(`Insufficient stock for "${product.name}": only ${remOf(batch)} available in that batch`);
      push(batch, item.qty, batch.sale_price_minor);
      continue;
    }

    const open = batches.openFifo(db, item.product_id);
    const available = open.reduce((a, b) => a + remOf(b), 0);
    if (available < item.qty) throw new Conflict(`Insufficient stock for "${product.name}": only ${available} available`);
    const latestPrice = strategy === 'latest' ? batches.newestWithStock(db, item.product_id)?.sale_price_minor : undefined;

    let need = item.qty;
    for (const batch of open) {
      if (need <= 0) break;
      const avail = remOf(batch);
      if (avail <= 0) continue;
      const take = Math.min(need, avail);
      push(batch, take, latestPrice ?? batch.sale_price_minor);
      need -= take;
    }
  }
  return out;
}

export interface QuoteResult {
  lines: { product_id: number; qty: number; line_total_minor: number; unit_price_minor: number }[];
  slices: ResolvedLine[];
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
}

/** Price a cart WITHOUT selling (read-only) — drives the POS cart so it matches the receipt exactly. */
export function quote(db: DB, input: CheckoutInput): QuoteResult {
  const strategy = (getSetting(db, 'batch_selection_strategy', 'fifo') as Strategy) || 'fifo';
  const slices = resolveSlices(db, input.items ?? [], strategy);
  const subtotal = slices.reduce((a, s) => a + s.line_total_minor, 0);
  const tax = slices.reduce((a, s) => a + s.tax_minor, 0);
  const cartDiscount = input.discount_minor ?? 0;
  const byProduct = new Map<number, { product_id: number; qty: number; line_total_minor: number; unit_price_minor: number }>();
  for (const s of slices) {
    const e = byProduct.get(s.product_id) ?? { product_id: s.product_id, qty: 0, line_total_minor: 0, unit_price_minor: s.unit_price_minor };
    e.qty += s.qty;
    e.line_total_minor += s.line_total_minor;
    byProduct.set(s.product_id, e);
  }
  return {
    lines: [...byProduct.values()],
    slices,
    subtotal_minor: subtotal,
    tax_minor: tax,
    discount_minor: cartDiscount,
    total_minor: subtotal - cartDiscount + tax,
  };
}

export function checkout(db: DB, input: CheckoutInput, user: AuthUser) {
  if (!input.items?.length) throw new ValidationError('Cart is empty');
  const strategy = (getSetting(db, 'batch_selection_strategy', 'fifo') as Strategy) || 'fifo';

  return runInUnitOfWork(db, ({ db }) => {
    // Optionally capture a walk-in customer entered at the pay step.
    let customerId = input.customer_id ?? null;
    const c = input.customer;
    if (!customerId && c && (c.name?.trim() || c.phone?.trim() || c.email?.trim())) {
      const info = db
        .prepare('INSERT INTO customers (name, phone, email, is_active, created_at) VALUES (?, ?, ?, 1, ?)')
        .run(c.name?.trim() || 'Walk-in', c.phone?.trim() || null, c.email?.trim() || null, new Date().toISOString());
      customerId = Number(info.lastInsertRowid);
    }

    const allSlices = resolveSlices(db, input.items, strategy);

    const subtotal = allSlices.reduce((a, s) => a + s.line_total_minor, 0);
    const tax = allSlices.reduce((a, s) => a + s.tax_minor, 0);
    const cartDiscount = input.discount_minor ?? 0;
    const total = subtotal - cartDiscount + tax;

    const status = input.hold ? 'held' : 'completed';
    const paid = input.hold ? 0 : (input.payments ?? []).reduce((a, p) => a + p.amount_minor, 0);
    if (!input.hold && paid < total) throw new ValidationError('Insufficient payment');
    const change = input.hold ? 0 : Math.max(0, paid - total);
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO sales (user_id, customer_id, shift_id, subtotal_minor, discount_minor, tax_minor, total_minor, paid_minor, change_minor, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        user.id,
        customerId,
        input.shift_id ?? null,
        subtotal,
        cartDiscount,
        tax,
        total,
        paid,
        change,
        status,
        now,
      );
    const saleId = Number(info.lastInsertRowid);
    db.prepare('UPDATE sales SET invoice_no = ? WHERE id = ?').run(`INV-${String(saleId).padStart(6, '0')}`, saleId);

    const insItem = db.prepare(
      `INSERT INTO sale_items (sale_id, product_id, batch_id, qty, unit_price_minor, cost_price_minor, discount_minor, line_total_minor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const s of allSlices) {
      batches.changeRemaining(db, s.batch_id, -s.qty); // deduct stock (slicing is read-only)
      insItem.run(saleId, s.product_id, s.batch_id, s.qty, s.unit_price_minor, s.cost_price_minor, s.discount_minor, s.line_total_minor);
      recordMovement(db, {
        product_id: s.product_id,
        batch_id: s.batch_id,
        type: 'sale',
        qty: -s.qty,
        ref_table: 'sales',
        ref_id: saleId,
        user_id: user.id,
      });
    }

    if (!input.hold) {
      for (const p of input.payments ?? []) {
        db.prepare('INSERT INTO payments (sale_id, method, amount_minor, created_at) VALUES (?, ?, ?, ?)').run(
          saleId,
          p.method,
          p.amount_minor,
          now,
        );
      }
    }

    writeAudit(db, { user_id: user.id, action: input.hold ? 'sales.hold' : 'sales.create', entity: 'sale', entity_id: saleId });
    return get(db, saleId, user.permissions);
  });
}

export function get(db: DB, id: number, perms: Set<string>) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
  if (!sale) throw new NotFound('Sale not found');
  const items = db
    .prepare(
      `SELECT si.*, p.name AS product_name,
              COALESCE((SELECT SUM(ri.qty) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned_qty,
              COALESCE((SELECT SUM(ri.amount_minor) FROM return_items ri WHERE ri.sale_item_id = si.id), 0) AS returned_amount_minor
       FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?`,
    )
    .all(id);
  const payments = db.prepare('SELECT * FROM payments WHERE sale_id = ?').all(id);
  const refunded = (
    db.prepare('SELECT COALESCE(SUM(total_minor),0) r FROM returns WHERE original_sale_id = ?').get(id) as { r: number }
  ).r;
  const s = sale as { total_minor: number };
  return stripCost(
    { ...sale, refunded_minor: Number(refunded), net_total_minor: s.total_minor - Number(refunded), items: stripCost(items, perms), payments },
    perms,
  );
}

/** Delete a sale and restore its stock. Held/parked sales can always be removed; a completed
 *  sale is voided (stock restored) too, but should normally be handled via Return/Refund. */
export function remove(db: DB, id: number, user: AuthUser) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id) as { id: number; status: string } | undefined;
  if (!sale) throw new NotFound('Sale not found');
  // If this invoice already has refunds, that stock was restored by the return —
  // deleting would double-restock it. Use Refund for those instead.
  if (db.prepare('SELECT 1 FROM returns WHERE original_sale_id = ? LIMIT 1').get(id)) {
    throw new Conflict('This invoice has a refund recorded — it cannot be deleted.');
  }
  return runInUnitOfWork(db, ({ db }) => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as any[];
    for (const it of items) {
      if (it.batch_id) {
        batches.changeRemaining(db, it.batch_id, it.qty); // restore stock
        recordMovement(db, {
          product_id: it.product_id,
          batch_id: it.batch_id,
          type: 'adjustment',
          qty: it.qty,
          ref_table: 'sales',
          ref_id: id,
          note: `sale ${sale.status} deleted`,
          user_id: user.id,
        });
      }
    }
    // sale_items and payments cascade on sale delete (FK ON DELETE CASCADE).
    db.prepare('DELETE FROM sales WHERE id = ?').run(id);
    writeAudit(db, { user_id: user.id, action: 'sales.delete', entity: 'sale', entity_id: id, details: { status: sale.status } });
    return { ok: true };
  });
}

export function list(db: DB, opts: { limit: number; offset: number; userId?: number; q?: string }) {
  const conds: string[] = [];
  const args: unknown[] = [];
  if (opts.userId) {
    conds.push('user_id = ?');
    args.push(opts.userId);
  }
  if (opts.q) {
    // Smart match: the digits the user types map to the invoice's number (its id).
    // "2" → INV-000002, "000002" → INV-000002, "INV-000002" → INV-000002. Not a fuzzy contains.
    const q = opts.q.trim();
    const digits = q.replace(/\D/g, '');
    if (digits) {
      conds.push('(id = ? OR UPPER(invoice_no) = UPPER(?))');
      args.push(Number(digits), q);
    } else {
      conds.push('UPPER(invoice_no) = UPPER(?)');
      args.push(q);
    }
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) c FROM sales ${where}`).get(...args) as { c: number }).c;
  const rows = db.prepare(`SELECT * FROM sales ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...args, opts.limit, opts.offset);
  return { rows, total: Number(total) };
}
