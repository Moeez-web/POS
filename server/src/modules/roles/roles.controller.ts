import type { Request, Response } from 'express';
import * as service from './roles.service';

export function listPermissions(req: Request, res: Response): void {
  res.json({ data: service.listPermissions(req.db) });
}

export function list(req: Request, res: Response): void {
  res.json({ data: service.listRoles(req.db) });
}

export function get(req: Request, res: Response): void {
  res.json({ data: service.getRole(req.db, Number(req.params.id)) });
}

export function create(req: Request, res: Response): void {
  res.status(201).json({ data: service.createRole(req.db, req.body, req.user!) });
}

export function update(req: Request, res: Response): void {
  res.json({ data: service.updateRole(req.db, Number(req.params.id), req.body, req.user!) });
}

export function remove(req: Request, res: Response): void {
  service.deleteRole(req.db, Number(req.params.id), req.user!);
  res.json({ data: { ok: true } });
}
