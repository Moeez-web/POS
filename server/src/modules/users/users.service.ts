import type { DB } from '../../db/connection';
import type { AuthUser } from '../../types/express';
import type { Pagination } from '../../lib/pagination';
import { pageEnvelope } from '../../lib/pagination';
import { hashPassword } from '../../lib/password';
import { writeAudit } from '../../lib/audit';
import { Conflict, NotFound } from '../../lib/errors';
import { getRole } from '../roles/roles.repo';
import * as repo from './users.repo';

export function list(db: DB, p: Pagination) {
  const { rows, total } = repo.list(db, p);
  return pageEnvelope(rows, total, p);
}

export function get(db: DB, id: number) {
  const u = repo.findById(db, id);
  if (!u) throw new NotFound('User not found');
  return u;
}

export function create(
  db: DB,
  input: { username: string; password: string; full_name?: string | null; role_id: number },
  actor: AuthUser,
) {
  if (repo.usernameExists(db, input.username)) throw new Conflict('Username already taken');
  if (!getRole(db, input.role_id)) throw new NotFound('Role not found');
  const id = repo.insert(db, {
    username: input.username,
    password_hash: hashPassword(input.password),
    full_name: input.full_name,
    role_id: input.role_id,
  });
  writeAudit(db, { user_id: actor.id, action: 'users.create', entity: 'user', entity_id: id });
  return repo.findById(db, id);
}

export function update(
  db: DB,
  id: number,
  input: { full_name?: string | null; role_id?: number; is_active?: boolean },
  actor: AuthUser,
) {
  if (!repo.findById(db, id)) throw new NotFound('User not found');
  if (input.role_id && !getRole(db, input.role_id)) throw new NotFound('Role not found');
  repo.update(db, id, {
    full_name: input.full_name,
    role_id: input.role_id,
    is_active: input.is_active === undefined ? undefined : input.is_active ? 1 : 0,
  });
  writeAudit(db, { user_id: actor.id, action: 'users.update', entity: 'user', entity_id: id });
  return repo.findById(db, id);
}

export function resetPassword(db: DB, id: number, newPassword: string, actor: AuthUser) {
  if (!repo.findById(db, id)) throw new NotFound('User not found');
  repo.setPassword(db, id, hashPassword(newPassword));
  writeAudit(db, { user_id: actor.id, action: 'users.reset_password', entity: 'user', entity_id: id });
  return { ok: true };
}
