import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';

export const suppliersRouter = Router();
suppliersRouter.use(authenticate);

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
});

suppliersRouter.get('/', requirePermission('suppliers.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const where = p.q ? 'WHERE name LIKE ?' : 'WHERE 1=1';
  const args = p.q ? [`%${p.q}%`] : [];
  const total = (req.db.prepare(`SELECT COUNT(*) c FROM suppliers ${where} AND is_active = 1`).get(...args) as { c: number }).c;
  const rows = req.db
    .prepare(`SELECT * FROM suppliers ${where} AND is_active = 1 ORDER BY name LIMIT ? OFFSET ?`)
    .all(...args, p.pageSize, p.offset);
  res.json(pageEnvelope(rows, Number(total), p));
});

suppliersRouter.post('/', requirePermission('suppliers.create'), validate(schema), (req: Request, res: Response) => {
  const b = req.body;
  const info = req.db
    .prepare('INSERT INTO suppliers (name, phone, email, address, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)')
    .run(b.name, b.phone ?? null, b.email ?? null, b.address ?? null, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

suppliersRouter.patch('/:id', requirePermission('suppliers.update'), validate(schema), (req: Request, res: Response) => {
  const b = req.body;
  req.db
    .prepare('UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?')
    .run(b.name, b.phone ?? null, b.email ?? null, b.address ?? null, Number(req.params.id));
  res.json({ data: req.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(Number(req.params.id)) });
});
