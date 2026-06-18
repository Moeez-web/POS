import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/token';
import { Unauthorized } from '../lib/errors';
import { loadPermissions } from '../modules/roles/roles.repo';

/** Verifies the bearer token and loads the user + their permission set onto req.user. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw new Unauthorized();

  let payload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw new Unauthorized('Invalid or expired session');
  }

  const user = req.db
    .prepare(
      'SELECT id, username, full_name, role_id, is_active, must_change_password FROM users WHERE id = ?',
    )
    .get(payload.sub) as
    | {
        id: number;
        username: string;
        full_name: string | null;
        role_id: number;
        is_active: number;
        must_change_password: number;
      }
    | undefined;

  if (!user || !user.is_active) throw new Unauthorized();

  req.user = { ...user, permissions: loadPermissions(req.db, user.role_id) };
  next();
}
