import type { DB } from '../../db/connection';
import { config } from '../../config';
import { AppError, ValidationError } from '../../lib/errors';
import { verifyLicense, decodeTokenClaims, type LicenseEval } from '../../lib/license-verify';
import * as repo from './license.repo';
import * as dash from './dashboard-client';

/** Public shape returned to the Angular client. */
export interface LicenseStatusDto {
  state: LicenseEval['state'];
  accessUntil: number | null;
  graceDays: number | null;
  plan: string | null;
}

function toDto(e: LicenseEval): LicenseStatusDto {
  return { state: e.state, accessUntil: e.accessUntil, graceDays: e.graceDays, plan: e.plan };
}

/** Local-only verification result (no network). */
export async function getStatus(db: DB): Promise<LicenseStatusDto> {
  return toDto(await verifyLicense(db));
}

/** Cache the dashboard's current JWKS (required so a freshly-issued token verifies). */
async function cacheJwks(db: DB): Promise<void> {
  const jwks = await dash.fetchJwks();
  repo.saveJwks(db, JSON.stringify(jwks));
}

/** Re-anchor the monotonic clock from the dashboard's authoritative time. Best-effort. */
async function anchorTime(db: DB): Promise<void> {
  try {
    const t = await dash.fetchTime();
    if (t?.now) repo.setLastSeen(db, t.now);
  } catch {
    /* keep the existing anchor if the clock endpoint is unreachable */
  }
}

/** Persist a freshly-issued token and its derived fields. */
function applyIssuedToken(db: DB, resp: dash.DashLicenseResponse): void {
  const claims = decodeTokenClaims(resp.token!);
  repo.saveToken(db, {
    token: resp.token!,
    plan: (claims.plan ?? null) as string | null,
    issued_at: typeof claims.iat === 'number' ? new Date(claims.iat * 1000).toISOString() : null,
    token_expires_at: resp.expiresAt ?? null,
    access_until: resp.accessUntil ?? null,
    grace_days: resp.graceDays ?? null,
    customer_ref: (claims.cid ?? null) as number | null,
    install_id: config.installId,
    last_status: resp.status === 'payment_due' ? 'payment_due' : 'ok',
  });
}

/** Activate this install with a dashboard-issued activation code. */
export async function activate(db: DB, activationCode: string): Promise<LicenseStatusDto> {
  let resp: dash.DashLicenseResponse;
  try {
    resp = await dash.activate(activationCode);
  } catch {
    throw new AppError('license_offline', 'Could not reach the licensing server. Check your connection.', 503);
  }

  if (resp.status === 'invalid_code') throw new ValidationError('Invalid activation code');
  if (resp.status === 'seat_limit_reached') throw new ValidationError('Seat limit reached for this license');
  if (resp.status === 'suspended' || !resp.token) {
    repo.setStatus(db, 'suspended');
    return getStatus(db);
  }

  // Fetch the dashboard's signing keys first so the new token verifies (its kid is dynamic).
  try {
    await cacheJwks(db);
  } catch {
    throw new AppError('license_offline', 'Could not reach the licensing server. Check your connection.', 503);
  }
  applyIssuedToken(db, resp);
  await anchorTime(db);
  return getStatus(db);
}

/** Renew the availability token. Never throws (backs the Retry button); returns the new state. */
export async function renew(db: DB): Promise<LicenseStatusDto> {
  try {
    const resp = await dash.renew();
    if (resp.token && (resp.status === 'ok' || resp.status === 'payment_due')) {
      await cacheJwks(db);
      applyIssuedToken(db, resp);
      await anchorTime(db);
    } else if (resp.status === 'suspended' || resp.status === 'unknown_install') {
      repo.setStatus(db, 'suspended');
    }
  } catch {
    /* offline: fall through and report the locally-computed state */
  }
  return getStatus(db);
}

/**
 * Background sync: daily heartbeat + renew when the token is older than ~7 days.
 * Keeps the dashboard fleet view current and catches revokes within the 14-day window.
 */
export async function runBackgroundRefresh(db: DB): Promise<void> {
  const row = repo.get(db);
  if (!row?.token) return; // unactivated — nothing to refresh

  try {
    const hb = await dash.heartbeat();
    if (hb.action === 'lock' || hb.licenseStatus === 'suspended') repo.setStatus(db, 'suspended');
  } catch {
    /* offline heartbeat is non-fatal */
  }

  const issuedSec = row.issued_at ? Math.floor(Date.parse(row.issued_at) / 1000) : 0;
  const ageDays = issuedSec ? (Date.now() / 1000 - issuedSec) / 86400 : Infinity;
  if (ageDays > 7) await renew(db);

  repo.setLastCheck(db, new Date().toISOString());
}
