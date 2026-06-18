import type { Request, Response, NextFunction } from 'express';
import { AppError, NotFound } from '../lib/errors';

export function notFound(_req: Request, _res: Response, next: NextFunction): void {
  next(new NotFound('Route not found'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
    return;
  }
  // SQLite unique-constraint → 409
  const msg = (err as Error)?.message ?? 'Internal server error';
  if (/UNIQUE constraint failed/i.test(msg)) {
    res.status(409).json({ error: 'A record with that value already exists', code: 'CONFLICT' });
    return;
  }
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL' });
}
