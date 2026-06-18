import type { Request, Response } from 'express';
import * as service from './auth.service';

export function login(req: Request, res: Response): void {
  res.json({ data: service.login(req.db, req.body.username, req.body.password) });
}

export function me(req: Request, res: Response): void {
  res.json({ data: service.me(req.db, req.user!.id) });
}

export function changePassword(req: Request, res: Response): void {
  res.json({ data: service.changePassword(req.db, req.user!.id, req.body.old_password, req.body.new_password) });
}

export function logout(_req: Request, res: Response): void {
  // Stateless JWT: client discards the token. Endpoint exists for audit/symmetry.
  res.json({ data: { ok: true } });
}
