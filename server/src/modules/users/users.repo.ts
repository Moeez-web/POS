import type { DB } from '../../db/connection';
import type { Pagination } from '../../lib/pagination';
import { safeSort } from '../../lib/pagination';

const SAFE_COLUMNS = ['id', 'username', 'full_name', 'created_at'];

export interface UserRow {
  id: number;
  username: string;
  full_name: string | null;
  role_id: number;
  role_name?: string;
  is_active: number;
  must_change_password: number;
  created_at: string;
}

export function list(db: DB, p: Pagination): { rows: UserRow[]; total: number } {
  const sort = safeSort(p.sort, SAFE_COLUMNS, 'id');
  const where = p.q ? 'WHERE u.username LIKE ? OR u.full_name LIKE ?' : '';
  const args: unknown[] = p.q ? [`%${p.q}%`, `%${p.q}%`] : [];
  const total = (
    db.prepare(`SELECT COUNT(*) c FROM users u ${where}`).get(...args) as { c: number }
  ).c;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role_id, r.name AS role_name,
              u.is_active, u.must_change_password, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id
       ${where} ORDER BY u.${sort} ${p.order} LIMIT ? OFFSET ?`,
    )
    .all(...args, p.pageSize, p.offset) as UserRow[];
  return { rows, total: Number(total) };
}

export function findById(db: DB, id: number): UserRow | undefined {
  return db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role_id, r.name AS role_name,
              u.is_active, u.must_change_password, u.created_at
       FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    )
    .get(id) as UserRow | undefined;
}

export function insert(
  db: DB,
  input: { username: string; password_hash: string; full_name?: string | null; role_id: number },
): number {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role_id, is_active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, 1, 1, ?)`,
    )
    .run(input.username, input.password_hash, input.full_name ?? null, input.role_id, now);
  return Number(info.lastInsertRowid);
}

export function update(
  db: DB,
  id: number,
  input: { full_name?: string | null; role_id?: number; is_active?: number },
): void {
  const u = findById(db, id);
  if (!u) return;
  db.prepare('UPDATE users SET full_name = ?, role_id = ?, is_active = ?, updated_at = ? WHERE id = ?').run(
    input.full_name !== undefined ? input.full_name : u.full_name,
    input.role_id ?? u.role_id,
    input.is_active !== undefined ? input.is_active : u.is_active,
    new Date().toISOString(),
    id,
  );
}

export function setPassword(db: DB, id: number, password_hash: string): void {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = ? WHERE id = ?').run(
    password_hash,
    new Date().toISOString(),
    id,
  );
}

export function usernameExists(db: DB, username: string): boolean {
  return !!db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
}
