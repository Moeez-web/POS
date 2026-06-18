import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { writeAudit } from '../../lib/audit';
import * as repo from './batches.repo';

export const batchesRouter = Router();
batchesRouter.use(authenticate);

batchesRouter.get('/expiring', requirePermission('batches.read'), (req: Request, res: Response) => {
  const days = Number(req.query.days) || 30;
  res.json({ data: repo.expiring(req.db, days) });
});

const adjustSchema = z.object({
  sale_price_minor: z.number().int().min(0).optional(),
  qty_remaining: z.number().int().min(0).optional(),
});

batchesRouter.patch('/:id', requirePermission('batches.update'), validate(adjustSchema), (req: Request, res: Response) => {
  const b = repo.byId(req.db, Number(req.params.id));
  if (!b) return res.status(404).json({ error: 'Batch not found', code: 'NOT_FOUND' });
  req.db
    .prepare('UPDATE batches SET sale_price_minor = ?, qty_remaining = ? WHERE id = ?')
    .run(req.body.sale_price_minor ?? b.sale_price_minor, req.body.qty_remaining ?? b.qty_remaining, b.id);
  writeAudit(req.db, { user_id: req.user!.id, action: 'batches.update', entity: 'batch', entity_id: b.id, details: req.body });
  res.json({ data: repo.byId(req.db, b.id) });
});

// mounted under products: GET /api/products/:id/batches
export const productBatchesHandler = [
  authenticate,
  requirePermission('batches.read'),
  (req: Request, res: Response) => {
    res.json({ data: repo.byProduct(req.db, Number(req.params.id)) });
  },
];
