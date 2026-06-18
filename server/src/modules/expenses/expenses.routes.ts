import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { pageEnvelope } from '../../lib/pagination';
import { writeAudit } from '../../lib/audit';

export const expensesRouter = Router();
expensesRouter.use(authenticate);

// ── Expense categories ──
const catSchema = z.object({ name: z.string().trim().min(1).max(80) });

expensesRouter.get('/categories', requirePermission('expenses.read'), (req: Request, res: Response) => {
  res.json({ data: req.db.prepare('SELECT * FROM expense_categories WHERE is_active = 1 ORDER BY name').all() });
});

expensesRouter.post('/categories', requirePermission('expense_categories.manage'), validate(catSchema), (req: Request, res: Response) => {
  const info = req.db.prepare('INSERT INTO expense_categories (name, is_active, created_at) VALUES (?, 1, ?)').run(req.body.name, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM expense_categories WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

expensesRouter.delete('/categories/:id', requirePermission('expense_categories.manage'), (req: Request, res: Response) => {
  req.db.prepare('UPDATE expense_categories SET is_active = 0 WHERE id = ?').run(Number(req.params.id));
  res.json({ data: { ok: true } });
});

// ── Expenses ──
const schema = z.object({
  expense_category_id: z.number().int().positive().optional().nullable(),
  amount_minor: z.number().int().min(0),
  description: z.string().trim().max(250).optional().nullable(),
  payment_method: z.string().trim().max(30).optional().nullable(),
  date: z.string(),
});

expensesRouter.get('/', requirePermission('expenses.read'), paginate, (req: Request, res: Response) => {
  const p = req.pagination!;
  const filters: string[] = [];
  const args: unknown[] = [];
  if (req.query.category_id) { filters.push('e.expense_category_id = ?'); args.push(Number(req.query.category_id)); }
  if (p.from) { filters.push('e.date >= ?'); args.push(p.from); }
  if (p.to) { filters.push('e.date <= ?'); args.push(p.to); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const total = (req.db.prepare(`SELECT COUNT(*) c FROM expenses e ${where}`).get(...args) as { c: number }).c;
  const rows = req.db
    .prepare(`SELECT e.*, c.name AS category_name FROM expenses e LEFT JOIN expense_categories c ON c.id = e.expense_category_id ${where} ORDER BY e.date DESC, e.id DESC LIMIT ? OFFSET ?`)
    .all(...args, p.pageSize, p.offset);
  res.json(pageEnvelope(rows, Number(total), p));
});

expensesRouter.post('/', requirePermission('expenses.create'), validate(schema), (req: Request, res: Response) => {
  const b = req.body;
  const info = req.db
    .prepare('INSERT INTO expenses (expense_category_id, amount_minor, description, payment_method, date, user_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(b.expense_category_id ?? null, b.amount_minor, b.description ?? null, b.payment_method ?? null, b.date, req.user!.id, new Date().toISOString());
  res.status(201).json({ data: req.db.prepare('SELECT * FROM expenses WHERE id = ?').get(Number(info.lastInsertRowid)) });
});

expensesRouter.patch('/:id', requirePermission('expenses.update'), validate(schema.partial()), (req: Request, res: Response) => {
  const cur = req.db.prepare('SELECT * FROM expenses WHERE id = ?').get(Number(req.params.id)) as any;
  if (!cur) return res.status(404).json({ error: 'Expense not found', code: 'NOT_FOUND' });
  const b = req.body;
  req.db
    .prepare('UPDATE expenses SET expense_category_id = ?, amount_minor = ?, description = ?, payment_method = ?, date = ?, updated_at = ? WHERE id = ?')
    .run(
      b.expense_category_id ?? cur.expense_category_id,
      b.amount_minor ?? cur.amount_minor,
      b.description ?? cur.description,
      b.payment_method ?? cur.payment_method,
      b.date ?? cur.date,
      new Date().toISOString(),
      cur.id,
    );
  res.json({ data: req.db.prepare('SELECT * FROM expenses WHERE id = ?').get(cur.id) });
});

expensesRouter.delete('/:id', requirePermission('expenses.delete'), (req: Request, res: Response) => {
  req.db.prepare('DELETE FROM expenses WHERE id = ?').run(Number(req.params.id));
  writeAudit(req.db, { user_id: req.user!.id, action: 'expenses.delete', entity: 'expense', entity_id: Number(req.params.id) });
  res.json({ data: { ok: true } });
});
