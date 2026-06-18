import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { writeAudit } from '../../lib/audit';
import { Conflict, NotFound } from '../../lib/errors';
import * as batches from '../batches/batches.repo';
import { recordMovement } from '../inventory/inventory.repo';

export const returnsRouter = Router();
returnsRouter.use(authenticate);

const schema = z.object({
  original_sale_id: z.number().int().positive(),
  reason: z.string().trim().max(200).optional().nullable(),
  items: z.array(z.object({ sale_item_id: z.number().int().positive(), qty: z.number().int().positive() })).min(1),
});

returnsRouter.get('/', requirePermission('returns.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const where = p.q ? "WHERE s.invoice_no LIKE ?" : '';
  const args: unknown[] = p.q ? [`%${p.q}%`] : [];
  const total = (req.db.prepare(`SELECT COUNT(*) c FROM returns r JOIN sales s ON s.id = r.original_sale_id ${where}`).get(...args) as { c: number }).c;
  const rows = req.db
    .prepare(
      `SELECT r.*, s.invoice_no, u.username AS processed_by
       FROM returns r
       JOIN sales s ON s.id = r.original_sale_id
       LEFT JOIN users u ON u.id = r.user_id
       ${where} ORDER BY r.id DESC LIMIT ? OFFSET ?`,
    )
    .all(...args, p.pageSize, p.offset);
  res.json(pageEnvelope(rows, Number(total), p));
});

returnsRouter.get('/:id', requirePermission('returns.read'), (req: Request, res: Response) => {
  const ret = req.db
    .prepare(
      `SELECT r.*, s.invoice_no, u.username AS processed_by
       FROM returns r JOIN sales s ON s.id = r.original_sale_id LEFT JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`,
    )
    .get(Number(req.params.id));
  if (!ret) return res.status(404).json({ error: 'Return not found', code: 'NOT_FOUND' });
  const items = req.db
    .prepare(
      `SELECT ri.*, p.name AS product_name
       FROM return_items ri JOIN sale_items si ON si.id = ri.sale_item_id JOIN products p ON p.id = si.product_id
       WHERE ri.return_id = ?`,
    )
    .all(Number(req.params.id));
  res.json({ data: { ...(ret as object), items } });
});

returnsRouter.post('/', requirePermission('returns.create'), validate(schema), (req: Request, res: Response) => {
  const sale = req.db.prepare('SELECT * FROM sales WHERE id = ?').get(req.body.original_sale_id);
  if (!sale) throw new NotFound('Original sale not found');

  const result = runInUnitOfWork(req.db, ({ db }) => {
    let total = 0;
    const now = new Date().toISOString();
    const info = db
      .prepare('INSERT INTO returns (original_sale_id, user_id, approved_by, total_minor, reason, created_at) VALUES (?, ?, ?, 0, ?, ?)')
      .run(req.body.original_sale_id, req.user!.id, req.user!.id, req.body.reason ?? null, now);
    const returnId = Number(info.lastInsertRowid);

    for (const ri of req.body.items) {
      const saleItem = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(ri.sale_item_id, req.body.original_sale_id) as any;
      if (!saleItem) throw new NotFound(`Sale item ${ri.sale_item_id} not on this sale`);
      const already = (db.prepare('SELECT COALESCE(SUM(qty),0) s FROM return_items WHERE sale_item_id = ?').get(ri.sale_item_id) as any).s;
      if (Number(already) + ri.qty > saleItem.qty) throw new Conflict('Return quantity exceeds sold quantity');

      const unit = Math.round(saleItem.line_total_minor / saleItem.qty);
      const amount = unit * ri.qty;
      total += amount;

      if (saleItem.batch_id) {
        batches.changeRemaining(db, saleItem.batch_id, ri.qty); // restock
        recordMovement(db, {
          product_id: saleItem.product_id,
          batch_id: saleItem.batch_id,
          type: 'return',
          qty: ri.qty,
          ref_table: 'returns',
          ref_id: returnId,
          user_id: req.user!.id,
        });
      }
      db.prepare('INSERT INTO return_items (return_id, sale_item_id, qty, batch_id, amount_minor) VALUES (?, ?, ?, ?, ?)').run(
        returnId,
        ri.sale_item_id,
        ri.qty,
        saleItem.batch_id ?? null,
        amount,
      );
    }

    db.prepare('UPDATE returns SET total_minor = ? WHERE id = ?').run(total, returnId);
    db.prepare("UPDATE sales SET status = 'returned' WHERE id = ?").run(req.body.original_sale_id);
    writeAudit(db, { user_id: req.user!.id, action: 'returns.create', entity: 'return', entity_id: returnId });
    const ret = db.prepare('SELECT * FROM returns WHERE id = ?').get(returnId);
    const items = db.prepare('SELECT * FROM return_items WHERE return_id = ?').all(returnId);
    return { ...(ret as object), items };
  });

  res.status(201).json({ data: result });
});
