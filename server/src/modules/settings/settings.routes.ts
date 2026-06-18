import { Router } from 'express';
import { z } from 'zod';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { writeAudit } from '../../lib/audit';

export const settingsRouter = Router();
settingsRouter.use(authenticate);

function readAll(req: Request): Record<string, string> {
  const rows = req.db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// Any authenticated user can read shop settings (cashiers need shop name/receipt info).
settingsRouter.get('/', (req: Request, res: Response) => {
  res.json({ data: readAll(req) });
});

const updateSchema = z.record(z.string(), z.string());

settingsRouter.put('/', requirePermission('settings.update'), validate(updateSchema), (req: Request, res: Response) => {
  const now = new Date().toISOString();
  const stmt = req.db.prepare(
    `INSERT INTO settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
  );
  for (const [k, v] of Object.entries(req.body as Record<string, string>)) {
    stmt.run(k, v, req.user!.id, now);
  }
  writeAudit(req.db, { user_id: req.user!.id, action: 'settings.update', entity: 'settings' });
  res.json({ data: readAll(req) });
});
