import type { Request, Response, NextFunction } from 'express';
import { parsePagination } from '../lib/pagination';

export function paginate(req: Request, _res: Response, next: NextFunction): void {
  req.pagination = parsePagination(req.query as Record<string, unknown>);
  next();
}
