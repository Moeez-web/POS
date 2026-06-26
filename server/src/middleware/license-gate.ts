import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { verifyLicense, BLOCKED_STATES } from '../lib/license-verify';

/**
 * Gates login on the license state. If the install is none / blocked / clock_tampered /
 * needs_connection / suspended, respond HTTP 423 (Locked) and refuse to issue a session.
 * PAYMENT_DUE (grace) and OK do NOT block — the client shows a banner instead.
 */
export async function licenseGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (config.licenseBypass) return next();
    const { state } = await verifyLicense(req.db);
    if (BLOCKED_STATES.includes(state)) {
      res.status(423).json({ error: { code: 'license_required', state } });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
