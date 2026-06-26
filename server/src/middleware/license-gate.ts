import type { Request, Response, NextFunction } from 'express';
import { verifyLicense, BLOCKED_STATES } from '../lib/license-verify';

/**
 * Gates login on the license state. If the install is PAYMENT_BLOCKED, NEEDS_CONNECTION or
 * SUSPENDED, respond HTTP 423 (Locked) and refuse to issue a session. PAYMENT_DUE (grace) and
 * UNACTIVATED do NOT block login — the client handles those flows (banner / activation screen).
 */
export async function licenseGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { state } = await verifyLicense(req.db);
    if (BLOCKED_STATES.includes(state)) {
      res.status(423).json({ error: { code: 'license_locked', state } });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
