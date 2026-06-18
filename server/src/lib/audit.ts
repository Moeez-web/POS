import type { DB } from '../db/connection';

export interface AuditEntry {
  user_id?: number | null;
  action: string;
  entity?: string | null;
  entity_id?: number | null;
  details?: unknown;
}

export function writeAudit(db: DB, e: AuditEntry): void {
  db.prepare(
    'INSERT INTO activity_logs (user_id, action, entity, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(
    e.user_id ?? null,
    e.action,
    e.entity ?? null,
    e.entity_id ?? null,
    e.details != null ? JSON.stringify(e.details) : null,
    new Date().toISOString(),
  );
}
