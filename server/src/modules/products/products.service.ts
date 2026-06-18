import type { DB } from '../../db/connection';
import type { AuthUser } from '../../types/express';
import type { Pagination } from '../../lib/pagination';
import { pageEnvelope } from '../../lib/pagination';
import { stripCost } from '../../lib/serialize';
import { writeAudit } from '../../lib/audit';
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { NotFound, Conflict } from '../../lib/errors';
import * as repo from './products.repo';
import * as batches from '../batches/batches.repo';
import { recordMovement } from '../inventory/inventory.repo';

export function list(db: DB, p: Pagination, perms: Set<string>) {
  const { rows, total } = repo.list(db, p);
  return pageEnvelope(stripCost(rows, perms), total, p);
}

export function search(db: DB, q: string, perms: Set<string>) {
  return stripCost(repo.search(db, q), perms);
}

export function get(db: DB, id: number, perms: Set<string>) {
  const prod = repo.findById(db, id);
  if (!prod) throw new NotFound('Product not found');
  return stripCost(repo.decorate(db, prod), perms);
}

export function byBarcode(db: DB, code: string, perms: Set<string>) {
  const prod = repo.findByBarcode(db, code);
  if (!prod) throw new NotFound('No product for that barcode');
  return stripCost(repo.decorate(db, prod), perms);
}

/**
 * Creates a product and, in the same transaction, its opening price + stock as the first
 * batch — so "Add Product" is one place: name, barcode, price, cost and quantity together.
 * SKUs/barcodes still held by a previously-removed product are freed so they can be reused.
 */
export function create(db: DB, input: any, user: AuthUser) {
  return runInUnitOfWork(db, ({ db }) => {
    const clash = db.prepare('SELECT id, is_active FROM products WHERE sku = ?').get(input.sku) as
      | { id: number; is_active: number }
      | undefined;
    if (clash) {
      if (clash.is_active) throw new Conflict('A product with that SKU already exists');
      // Free the SKU from the removed product.
      db.prepare('UPDATE products SET sku = ? WHERE id = ?').run(`${input.sku}~del${clash.id}`, clash.id);
    }
    const id = repo.insert(db, input, user.id);
    if (Array.isArray(input.barcodes)) {
      for (const code of input.barcodes) {
        const bClash = db
          .prepare('SELECT pb.id, p.is_active FROM product_barcodes pb JOIN products p ON p.id = pb.product_id WHERE pb.barcode = ?')
          .get(code) as { id: number; is_active: number } | undefined;
        if (bClash) {
          if (bClash.is_active) throw new Conflict(`Barcode ${code} is already used by another product`);
          db.prepare('DELETE FROM product_barcodes WHERE id = ?').run(bClash.id); // free it
        }
        repo.addBarcode(db, id, code);
      }
    }
    // Opening batch: holds the sale price (and any opening stock).
    if (input.sale_price_minor != null) {
      const qty = Math.max(0, Number(input.opening_qty ?? 0));
      const batchId = batches.create(db, {
        product_id: id,
        batch_no: 'OPENING',
        purchase_price_minor: input.cost_price_minor ?? 0,
        sale_price_minor: input.sale_price_minor,
        qty,
      });
      if (qty > 0) {
        recordMovement(db, { product_id: id, batch_id: batchId, type: 'purchase', qty, ref_table: 'products', ref_id: id, user_id: user.id });
      }
    }
    writeAudit(db, { user_id: user.id, action: 'products.create', entity: 'product', entity_id: id });
    return repo.decorate(db, repo.findById(db, id)!);
  });
}

/** Set a single sale price for the product by updating all its batches (one-price model). */
export function setPrice(db: DB, id: number, sale_price_minor: number, user: AuthUser) {
  if (!repo.findById(db, id)) throw new NotFound('Product not found');
  return runInUnitOfWork(db, ({ db }) => {
    for (const b of batches.byProduct(db, id)) {
      db.prepare('UPDATE batches SET sale_price_minor = ? WHERE id = ?').run(sale_price_minor, b.id);
    }
    // If the product has no batch yet, create a price-only opening batch.
    if (batches.byProduct(db, id).length === 0) {
      batches.create(db, { product_id: id, batch_no: 'OPENING', purchase_price_minor: 0, sale_price_minor, qty: 0 });
    }
    writeAudit(db, { user_id: user.id, action: 'products.price', entity: 'product', entity_id: id, details: { sale_price_minor } });
    return repo.decorate(db, repo.findById(db, id)!);
  });
}

/** Add stock as a new batch (its own cost + sale price). */
export function addStock(
  db: DB,
  id: number,
  input: { qty: number; cost_price_minor: number; sale_price_minor: number },
  user: AuthUser,
) {
  if (!repo.findById(db, id)) throw new NotFound('Product not found');
  return runInUnitOfWork(db, ({ db }) => {
    const batchId = batches.create(db, {
      product_id: id,
      purchase_price_minor: input.cost_price_minor,
      sale_price_minor: input.sale_price_minor,
      qty: input.qty,
    });
    recordMovement(db, { product_id: id, batch_id: batchId, type: 'purchase', qty: input.qty, ref_table: 'products', ref_id: id, user_id: user.id });
    writeAudit(db, { user_id: user.id, action: 'products.add_stock', entity: 'product', entity_id: id, details: input });
    return repo.decorate(db, repo.findById(db, id)!);
  });
}

export function update(db: DB, id: number, input: any, user: AuthUser) {
  if (!repo.findById(db, id)) throw new NotFound('Product not found');
  repo.update(db, id, input);
  writeAudit(db, { user_id: user.id, action: 'products.update', entity: 'product', entity_id: id });
  return repo.decorate(db, repo.findById(db, id)!);
}

/** Soft-delete: keeps sales history but frees the SKU + barcodes so they can be reused. */
export function remove(db: DB, id: number, user: AuthUser) {
  const p = repo.findById(db, id);
  if (!p) throw new NotFound('Product not found');
  return runInUnitOfWork(db, ({ db }) => {
    db.prepare('UPDATE products SET is_active = 0, sku = ?, updated_at = ? WHERE id = ?').run(
      `${p.sku}~del${id}`,
      new Date().toISOString(),
      id,
    );
    db.prepare('DELETE FROM product_barcodes WHERE product_id = ?').run(id);
    writeAudit(db, { user_id: user.id, action: 'products.delete', entity: 'product', entity_id: id });
    return { ok: true };
  });
}

export function addBarcode(db: DB, id: number, barcode: string, user: AuthUser) {
  if (!repo.findById(db, id)) throw new NotFound('Product not found');
  repo.addBarcode(db, id, barcode);
  writeAudit(db, { user_id: user.id, action: 'products.barcode.add', entity: 'product', entity_id: id });
  return repo.decorate(db, repo.findById(db, id)!);
}

export function removeBarcode(db: DB, id: number, barcodeId: number, user: AuthUser) {
  repo.removeBarcode(db, id, barcodeId);
  writeAudit(db, { user_id: user.id, action: 'products.barcode.remove', entity: 'product', entity_id: id });
  return repo.decorate(db, repo.findById(db, id)!);
}
