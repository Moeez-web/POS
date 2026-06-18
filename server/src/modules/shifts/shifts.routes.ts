import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { Conflict, NotFound } from '../../lib/errors';

export const shiftsRouter = Router();
shiftsRouter.use(authenticate);

function currentShift(req: Request, userId: number) {
  return req.db.prepare("SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY id DESC LIMIT 1").get(userId);
}

shiftsRouter.get('/current', requirePermission('shifts.read.own'), (req: Request, res: Response) => {
  res.json({ data: currentShift(req, req.user!.id) ?? null });
});

shiftsRouter.get('/', requirePermission('shifts.read.all'), (req: Request, res: Response) => {
  res.json({ data: req.db.prepare('SELECT * FROM shifts ORDER BY id DESC LIMIT 100').all() });
});

shiftsRouter.post(
  '/open',
  requirePermission('shifts.open'),
  validate(z.object({ opening_float_minor: z.number().int().min(0).default(0) })),
  (req: Request, res: Response) => {
    if (currentShift(req, req.user!.id)) throw new Conflict('You already have an open shift');
    const info = req.db
      .prepare("INSERT INTO shifts (user_id, opened_at, opening_float_minor, status) VALUES (?, ?, ?, 'open')")
      .run(req.user!.id, new Date().toISOString(), req.body.opening_float_minor);
    res.status(201).json({ data: req.db.prepare('SELECT * FROM shifts WHERE id = ?').get(Number(info.lastInsertRowid)) });
  },
);

shiftsRouter.post(
  '/close',
  requirePermission('shifts.close'),
  validate(z.object({ counted_minor: z.number().int().min(0) })),
  (req: Request, res: Response) => {
    const shift = currentShift(req, req.user!.id) as { id: number; opening_float_minor: number } | undefined;
    if (!shift) throw new NotFound('No open shift to close');
    const cash = (
      req.db
        .prepare(
          `SELECT COALESCE(SUM(p.amount_minor),0) s FROM payments p
           JOIN sales s2 ON s2.id = p.sale_id WHERE s2.shift_id = ? AND p.method = 'cash'`,
        )
        .get(shift.id) as { s: number }
    ).s;
    const expected = Number(shift.opening_float_minor) + Number(cash);
    const variance = req.body.counted_minor - expected;
    req.db
      .prepare("UPDATE shifts SET closed_at = ?, counted_minor = ?, expected_minor = ?, variance_minor = ?, status = 'closed' WHERE id = ?")
      .run(new Date().toISOString(), req.body.counted_minor, expected, variance, shift.id);
    res.json({ data: req.db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id) });
  },
);
