import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';

export const categoriesRouter = Router();
categoriesRouter.use(authenticate);

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  parent_id: z.number().int().positive().optional().nullable(),
});

categoriesRouter.get('/', requirePermission('categories.read', 'products.read'), (req: Request, res: Response) => {
  res.json({ data: req.db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY name').all() });
});

categoriesRouter.post('/', requirePermission('categories.create'), validate(schema), (req: Request, res: Response) => {
  const info = req.db
    .prepare('INSERT INTO categories (name, parent_id, is_active, created_at) VALUES (?, ?, 1, ?)')
    .run(req.body.name, req.body.parent_id ?? null, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

categoriesRouter.patch('/:id', requirePermission('categories.update'), validate(schema), (req: Request, res: Response) => {
  req.db.prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?').run(req.body.name, req.body.parent_id ?? null, Number(req.params.id));
  res.json({ data: req.db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id)) });
});

categoriesRouter.delete('/:id', requirePermission('categories.delete'), (req: Request, res: Response) => {
  req.db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ data: { ok: true } });
});
