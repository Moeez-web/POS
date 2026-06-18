import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

export const unitsRouter = Router();
unitsRouter.use(authenticate);

const schema = z.object({ name: z.string().trim().min(1).max(50), short_name: z.string().trim().min(1).max(20) });

unitsRouter.get('/', requirePermission('units.read', 'products.read'), (req: Request, res: Response) => {
  res.json({ data: req.db.prepare('SELECT * FROM units ORDER BY name').all() });
});

unitsRouter.post('/', requirePermission('units.create'), validate(schema), (req: Request, res: Response) => {
  const info = req.db
    .prepare('INSERT INTO units (name, short_name, created_at) VALUES (?, ?, ?)')
    .run(req.body.name, req.body.short_name, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM units WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

unitsRouter.patch('/:id', requirePermission('units.update'), validate(schema), (req: Request, res: Response) => {
  req.db.prepare('UPDATE units SET name = ?, short_name = ? WHERE id = ?').run(req.body.name, req.body.short_name, Number(req.params.id));
  res.json({ data: req.db.prepare('SELECT * FROM units WHERE id = ?').get(Number(req.params.id)) });
});

unitsRouter.delete('/:id', requirePermission('units.delete'), (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const inUse = req.db.prepare('SELECT 1 FROM products WHERE unit_id = ? LIMIT 1').get(id);
  if (inUse) return res.status(409).json({ error: 'This unit is used by products', code: 'CONFLICT' });
  req.db.prepare('DELETE FROM units WHERE id = ?').run(id);
  res.json({ data: { ok: true } });
});
