import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';
import { NotFound } from '../../lib/errors';
import * as service from './sales.service';

export const salesRouter = Router();
salesRouter.use(authenticate);

const checkoutSchema = z.object({
  customer_id: z.number().int().positive().optional().nullable(),
  customer: z
    .object({
      name: z.string().trim().max(120).optional(),
      phone: z.string().trim().max(40).optional(),
      email: z.string().trim().max(120).optional(),
    })
    .optional()
    .nullable(),
  shift_id: z.number().int().positive().optional().nullable(),
  discount_minor: z.number().int().min(0).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        qty: z.number().int().positive(),
        discount_minor: z.number().int().min(0).optional(),
        batch_id: z.number().int().positive().optional().nullable(),
      }),
    )
    .min(1),
  payments: z.array(z.object({ method: z.string().min(1), amount_minor: z.number().int().min(0) })).optional(),
});

salesRouter.get('/', requirePermission('sales.read', 'sales.read.own'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  // If the user only has read.own, scope to their sales.
  const ownOnly = !req.user!.permissions.has('sales.read') && req.user!.permissions.has('sales.read.own');
  const { rows, total } = service.list(req.db, { limit: p.pageSize, offset: p.offset, q: p.q, userId: ownOnly ? req.user!.id : undefined });
  res.json(pageEnvelope(rows, total, p));
});

salesRouter.get('/held', requirePermission('sales.hold'), (req: Request, res: Response) => {
  res.json({ data: req.db.prepare("SELECT * FROM sales WHERE status = 'held' ORDER BY id DESC").all() });
});

salesRouter.get('/:id', requirePermission('sales.read', 'sales.read.own'), (req: Request, res: Response) => {
  res.json({ data: service.get(req.db, Number(req.params.id), req.user!.permissions) });
});

salesRouter.post('/', requirePermission('sales.create'), validate(checkoutSchema), (req: Request, res: Response) => {
  res.status(201).json({ data: service.checkout(req.db, req.body, req.user!) });
});

// Price a cart without selling (FIFO breakdown + totals) so the POS shows exactly what the receipt prints.
salesRouter.post('/quote', requirePermission('sales.create'), validate(checkoutSchema), (req: Request, res: Response) => {
  res.json({ data: service.quote(req.db, req.body) });
});

salesRouter.delete('/:id', requirePermission('sales.delete'), (req: Request, res: Response) => {
  res.json({ data: service.remove(req.db, Number(req.params.id), req.user!) });
});

salesRouter.post('/hold', requirePermission('sales.hold'), validate(checkoutSchema), (req: Request, res: Response) => {
  res.status(201).json({ data: service.checkout(req.db, { ...req.body, hold: true }, req.user!) });
});

// Resume a held sale: returns it for editing, marks it cancelled so stock can be re-resolved on re-checkout.
salesRouter.post('/:id/resume', requirePermission('sales.hold'), (req: Request, res: Response) => {
  const sale = service.get(req.db, Number(req.params.id), req.user!.permissions) as { status: string };
  if (sale.status !== 'held') throw new NotFound('No held sale to resume');
  res.json({ data: sale });
});
