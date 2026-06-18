import type { DB } from '../../db/connection';
import type { AuthUser } from '../../types/express';
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { writeAudit } from '../../lib/audit';
import { Conflict, NotFound, Forbidden } from '../../lib/errors';
import * as repo from './roles.repo';

export function listPermissions(db: DB) {
  return repo.listPermissions(db);
}

export function listRoles(db: DB) {
  return repo.listRoles(db).map((r) => ({ ...r, permissions: repo.rolePermissionKeys(db, r.id) }));
}

export function getRole(db: DB, id: number) {
  const role = repo.getRole(db, id);
  if (!role) throw new NotFound('Role not found');
  return { ...role, permissions: repo.rolePermissionKeys(db, id) };
}

export function createRole(
  db: DB,
  input: { name: string; description?: string | null; permission_keys: string[] },
  user: AuthUser,
) {
  if (repo.listRoles(db).some((r) => r.name.toLowerCase() === input.name.toLowerCase())) {
    throw new Conflict('A role with that name already exists');
  }
  return runInUnitOfWork(db, ({ db }) => {
    const id = repo.insertRole(db, input);
    repo.setRolePermissions(db, id, repo.permissionIdsByKeys(db, input.permission_keys));
    writeAudit(db, { user_id: user.id, action: 'roles.create', entity: 'role', entity_id: id });
    return getRole(db, id);
  });
}

export function updateRole(
  db: DB,
  id: number,
  input: { name?: string; description?: string | null; permission_keys?: string[] },
  user: AuthUser,
) {
  const role = repo.getRole(db, id);
  if (!role) throw new NotFound('Role not found');

  return runInUnitOfWork(db, ({ db }) => {
    repo.updateRole(db, id, input);
    if (input.permission_keys) {
      // Safety: the admin role must always keep the keys needed to manage access,
      // so an admin can never lock everyone out of user/role management.
      let keys = input.permission_keys;
      if (role.name === 'admin') {
        keys = Array.from(new Set([...keys, 'roles.read', 'roles.update', 'users.read', 'users.update']));
      }
      repo.setRolePermissions(db, id, repo.permissionIdsByKeys(db, keys));
    }
    writeAudit(db, { user_id: user.id, action: 'roles.update', entity: 'role', entity_id: id });
    return getRole(db, id);
  });
}

export function deleteRole(db: DB, id: number, user: AuthUser) {
  const role = repo.getRole(db, id);
  if (!role) throw new NotFound('Role not found');
  if (role.is_system) throw new Forbidden('System roles cannot be deleted');
  if (repo.usersInRole(db, id) > 0) throw new Conflict('Cannot delete a role that still has users');
  repo.deleteRole(db, id);
  writeAudit(db, { user_id: user.id, action: 'roles.delete', entity: 'role', entity_id: id });
}
