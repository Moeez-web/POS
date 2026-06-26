import type { DB } from '../../db/connection';

/** The single license row (id = 1). */
export interface LicenseRow {
  id: number;
  install_id: string | null;
  customer_ref: number | null;
  token: string | null;
  plan: string | null;
  mode: string | null;
  issued_at: string | null;
  token_expires_at: string | null;
  access_until: string | null;
  grace_days: number | null;
  jwks_cache: string | null;
  last_check_at: string | null;
  last_seen_at: string | null;
  last_status: string | null;
  updated_at: string | null;
}

export function get(db: DB): LicenseRow | undefined {
  return db.prepare('SELECT * FROM license WHERE id = 1').get() as LicenseRow | undefined;
}

/** Save a freshly-issued token plus its derived fields. */
export function saveToken(
  db: DB,
  fields: {
    token: string;
    plan: string | null;
    issued_at: string | null;
    token_expires_at: string | null;
    access_until: string | null;
    grace_days: number | null;
    customer_ref: number | null;
    install_id: string | null;
    last_status: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE license SET token = ?, plan = ?, mode = 'online', issued_at = ?, token_expires_at = ?, access_until = ?,
       grace_days = ?, customer_ref = ?, install_id = ?, last_status = ?, last_check_at = ?, updated_at = ?
     WHERE id = 1`,
  ).run(
    fields.token,
    fields.plan,
    fields.issued_at,
    fields.token_expires_at,
    fields.access_until,
    fields.grace_days,
    fields.customer_ref,
    fields.install_id,
    fields.last_status,
    now,
    now,
  );
}

/** Save a pasted OFFLINE manual key (mode='offline'); clears online-only fields. */
export function saveManual(
  db: DB,
  fields: {
    token: string;
    plan: string | null;
    access_until: string | null;
    grace_days: number | null;
    expires_at: string | null;
    last_status: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `UPDATE license SET token = ?, plan = ?, mode = 'offline', access_until = ?, grace_days = ?,
       token_expires_at = ?, customer_ref = NULL, jwks_cache = NULL, last_status = ?, updated_at = ?
     WHERE id = 1`,
  ).run(
    fields.token,
    fields.plan,
    fields.access_until,
    fields.grace_days,
    fields.expires_at,
    fields.last_status,
    now,
  );
}

export function saveJwks(db: DB, jwksJson: string): void {
  db.prepare('UPDATE license SET jwks_cache = ?, updated_at = ? WHERE id = 1').run(jwksJson, new Date().toISOString());
}

export function setStatus(db: DB, status: string): void {
  db.prepare('UPDATE license SET last_status = ?, updated_at = ? WHERE id = 1').run(status, new Date().toISOString());
}

export function setLastSeen(db: DB, iso: string): void {
  db.prepare('UPDATE license SET last_seen_at = ?, updated_at = ? WHERE id = 1').run(iso, new Date().toISOString());
}

export function setLastCheck(db: DB, iso: string): void {
  db.prepare('UPDATE license SET last_check_at = ?, updated_at = ? WHERE id = 1').run(iso, new Date().toISOString());
}
