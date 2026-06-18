import type { Request, Response, NextFunction } from 'express';
import { Unauthorized, Forbidden } from '../lib/errors';

/** Guards a route: the authenticated user's role must hold the given permission key. */
export function requirePermission(...keys: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new Unauthorized();
    const ok = keys.some((k) => req.user!.permissions.has(k));
    if (!ok) throw new Forbidden(`Missing permission: ${keys.join(' or ')}`);
    next();
  };
}
