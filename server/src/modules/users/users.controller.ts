import type { Request, Response } from 'express';
import * as service from './users.service';

export function list(req: Request, res: Response): void {
  res.json(service.list(req.db, req.pagination!));
}

export function get(req: Request, res: Response): void {
  res.json({ data: service.get(req.db, Number(req.params.id)) });
}

export function create(req: Request, res: Response): void {
  res.status(201).json({ data: service.create(req.db, req.body, req.user!) });
}

export function update(req: Request, res: Response): void {
  res.json({ data: service.update(req.db, Number(req.params.id), req.body, req.user!) });
}

export function resetPassword(req: Request, res: Response): void {
  res.json({ data: service.resetPassword(req.db, Number(req.params.id), req.body.new_password, req.user!) });
}
