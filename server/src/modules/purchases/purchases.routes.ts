import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';
import * as service from './purchases.service';

export const purchasesRouter = Router();
purchasesRouter.use(authenticate);

const createSchema = z.object({
  supplier_id: z.number().int().positive().optional().nullable(),
  invoice_no: z.string().trim().max(60).optional().nullable(),
  date: z.string().optional(),
  discount_minor: z.number().int().min(0).optional(),
  tax_minor: z.number().int().min(0).optional(),
  paid_minor: z.number().int().min(0).optional(),
  items: z
    .array(
      z.object({
        product_id: z.number().int().positive(),
        qty: z.number().int().positive(),
        purchase_price_minor: z.number().int().min(0),
        sale_price_minor: z.number().int().min(0),
        batch_no: z.string().trim().max(60).optional().nullable(),
        mfg_date: z.string().optional().nullable(),
        expiry_date: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

purchasesRouter.get('/', requirePermission('purchases.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const total = (req.db.prepare('SELECT COUNT(*) c FROM purchases').get() as { c: number }).c;
  const rows = req.db.prepare('SELECT * FROM purchases ORDER BY id DESC LIMIT ? OFFSET ?').all(p.pageSize, p.offset);
  res.json(pageEnvelope(rows, Number(total), p));
});

purchasesRouter.get('/:id', requirePermission('purchases.read'), (req: Request, res: Response) => {
  res.json({ data: service.get(req.db, Number(req.params.id)) });
});

purchasesRouter.post('/', requirePermission('purchases.create'), validate(createSchema), (req: Request, res: Response) => {
  res.status(201).json({ data: service.create(req.db, req.body, req.user!) });
});
