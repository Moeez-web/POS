import type { DB } from '../../db/connection';
import { verifyPassword, hashPassword } from '../../lib/password';
import { signToken } from '../../lib/token';
import { Unauthorized, ValidationError } from '../../lib/errors';
import { loadPermissions } from '../roles/roles.repo';
import { writeAudit } from '../../lib/audit';

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  full_name: string | null;
  role_id: number;
  is_active: number;
  must_change_password: number;
}

function publicUser(db: DB, u: UserRow) {
  const role = db.prepare('SELECT name FROM roles WHERE id = ?').get(u.role_id) as { name: string } | undefined;
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role_id: u.role_id,
    role: role?.name ?? null,
    must_change_password: !!u.must_change_password,
  };
}

export function login(db: DB, username: string, password: string) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) {
    throw new Unauthorized('Invalid username or password');
  }
  const token = signToken({ sub: user.id, role_id: user.role_id });
  const permissions = [...loadPermissions(db, user.role_id)];
  writeAudit(db, { user_id: user.id, action: 'auth.login', entity: 'user', entity_id: user.id });
  return { token, user: publicUser(db, user), permissions };
}

export function me(db: DB, userId: number) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user) throw new Unauthorized();
  return { user: publicUser(db, user), permissions: [...loadPermissions(db, user.role_id)] };
}

export function changePassword(db: DB, userId: number, oldPassword: string, newPassword: string) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!user || !verifyPassword(oldPassword, user.password_hash)) {
    throw new Unauthorized('Current password is incorrect');
  }
  if (newPassword.length < 6) throw new ValidationError('New password must be at least 6 characters');
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?').run(
    hashPassword(newPassword),
    new Date().toISOString(),
    userId,
  );
  writeAudit(db, { user_id: userId, action: 'auth.change_password', entity: 'user', entity_id: userId });
  return { ok: true };
}
