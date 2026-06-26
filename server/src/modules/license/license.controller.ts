import type { Request, Response, NextFunction } from 'express';
import * as service from './license.service';
import { InvalidLicenseKey } from './license.service';

/** Local-only verification — safe to call before login. */
export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await service.getStatus(req.db) });
  } catch (e) {
    next(e);
  }
}

/** Apply a pasted OFFLINE manual key. Invalid keys → 400 { error: { code: 'invalid_key' } }. */
export async function manual(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await service.manual(req.db, req.body.key) });
  } catch (e) {
    if (e instanceof InvalidLicenseKey) {
      res.status(400).json({ error: { code: 'invalid_key' } });
      return;
    }
    next(e);
  }
}

export async function activate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await service.activate(req.db, req.body.activationCode) });
  } catch (e) {
    next(e);
  }
}

/** Backs the Retry button on the block screen — calls the dashboard /license/renew. */
export async function renew(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await service.renew(req.db) });
  } catch (e) {
    next(e);
  }
}
