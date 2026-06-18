import type { DB } from '../../db/connection';

export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: number;
  created_at: string;
  updated_at: string | null;
}

export interface Permission {
  id: number;
  key: string;
  module: string;
  action: string;
  description: string | null;
}

/** The permission keys granted to a role (used by auth middleware). */
export function loadPermissions(db: DB, roleId: number): Set<string> {
  const rows = db
    .prepare(
      `SELECT p.key FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = ?`,
    )
    .all(roleId) as { key: string }[];
  return new Set(rows.map((r) => r.key));
}

export function listPermissions(db: DB): Permission[] {
  return db.prepare('SELECT * FROM permissions ORDER BY module, action').all() as Permission[];
}

export function listRoles(db: DB): Role[] {
  return db.prepare('SELECT * FROM roles ORDER BY id').all() as Role[];
}

export function getRole(db: DB, id: number): Role | undefined {
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id) as Role | undefined;
}

export function rolePermissionKeys(db: DB, roleId: number): string[] {
  return [...loadPermissions(db, roleId)];
}

export function permissionIdsByKeys(db: DB, keys: string[]): number[] {
  if (keys.length === 0) return [];
  const placeholders = keys.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT id FROM permissions WHERE key IN (${placeholders})`)
    .all(...keys) as { id: number }[];
  return rows.map((r) => Number(r.id));
}

export function insertRole(
  db: DB,
  input: { name: string; description?: string | null },
): number {
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO roles (name, description, is_system, created_at, updated_at) VALUES (?, ?, 0, ?, ?)')
    .run(input.name, input.description ?? null, now, now);
  return Number(info.lastInsertRowid);
}

export function updateRole(db: DB, id: number, input: { name?: string; description?: string | null }): void {
  const role = getRole(db, id);
  if (!role) return;
  db.prepare('UPDATE roles SET name = ?, description = ?, updated_at = ? WHERE id = ?').run(
    input.name ?? role.name,
    input.description ?? role.description,
    new Date().toISOString(),
    id,
  );
}

export function setRolePermissions(db: DB, roleId: number, permissionIds: number[]): void {
  db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(roleId);
  const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const pid of permissionIds) ins.run(roleId, pid);
}

export function deleteRole(db: DB, id: number): void {
  db.prepare('DELETE FROM roles WHERE id = ?').run(id);
}

export function usersInRole(db: DB, roleId: number): number {
  const row = db.prepare('SELECT COUNT(*) c FROM users WHERE role_id = ?').get(roleId) as { c: number };
  return Number(row.c);
}
