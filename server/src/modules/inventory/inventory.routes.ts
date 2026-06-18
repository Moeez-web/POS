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
import * as inv from './inventory.repo';
import * as batches from '../batches/batches.repo';

export const inventoryRouter = Router();
inventoryRouter.use(authenticate);

inventoryRouter.get('/', requirePermission('inventory.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const { rows, total } = inv.stockLevels(req.db, { limit: p.pageSize, offset: p.offset, q: p.q });
  res.json(pageEnvelope(rows, total, p));
});

inventoryRouter.get('/low-stock', requirePermission('inventory.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const { rows, total } = inv.stockLevels(req.db, { lowOnly: true, limit: p.pageSize, offset: p.offset, q: p.q });
  res.json(pageEnvelope(rows, total, p));
});

const adjustSchema = z.object({
  batch_id: z.number().int().positive(),
  qty_delta: z.number().int(),
  reason: z.string().trim().min(1).max(200),
});

inventoryRouter.post('/adjustment', requirePermission('inventory.adjust'), validate(adjustSchema), (req: Request, res: Response) => {
  const b = batches.byId(req.db, req.body.batch_id);
  if (!b) throw new NotFound('Batch not found');
  if (b.qty_remaining + req.body.qty_delta < 0) throw new Conflict('Adjustment would make stock negative');

  const result = runInUnitOfWork(req.db, ({ db }) => {
    batches.changeRemaining(db, b.id, req.body.qty_delta);
    inv.recordMovement(db, {
      product_id: b.product_id,
      batch_id: b.id,
      type: 'adjustment',
      qty: req.body.qty_delta,
      ref_table: 'adjustment',
      note: req.body.reason,
      user_id: req.user!.id,
    });
    writeAudit(db, { user_id: req.user!.id, action: 'inventory.adjust', entity: 'batch', entity_id: b.id, details: req.body });
    return batches.byId(db, b.id);
  });
  res.json({ data: result });
});
