import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';

export const customersRouter = Router();
customersRouter.use(authenticate);

const schema = z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().max(40).optional().nullable() });

customersRouter.get('/', requirePermission('customers.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const where = p.q ? 'WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ?)' : 'WHERE is_active = 1';
  const args = p.q ? [`%${p.q}%`, `%${p.q}%`] : [];
  const total = (req.db.prepare(`SELECT COUNT(*) c FROM customers ${where}`).get(...args) as { c: number }).c;
  const rows = req.db.prepare(`SELECT * FROM customers ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...args, p.pageSize, p.offset);
  res.json(pageEnvelope(rows, Number(total), p));
});

customersRouter.post('/', requirePermission('customers.create'), validate(schema), (req: Request, res: Response) => {
  const info = req.db
    .prepare('INSERT INTO customers (name, phone, is_active, created_at) VALUES (?, ?, 1, ?)')
    .run(req.body.name, req.body.phone ?? null, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

customersRouter.patch('/:id', requirePermission('customers.update'), validate(schema), (req: Request, res: Response) => {
  req.db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(req.body.name, req.body.phone ?? null, Number(req.params.id));
  res.json({ data: req.db.prepare('SELECT * FROM customers WHERE id = ?').get(Number(req.params.id)) });
});
