import { decodeJwt, decodeProtectedHeader, importJWK, importSPKI, jwtVerify, errors as joseErrors } from 'jose';
import type { JWK, KeyLike } from 'jose';
import type { DB } from '../db/connection';
import { config } from '../config';
import * as repo from '../modules/license/license.repo';

/**
 * Unified license state for BOTH licensing paths:
 *  - OFFLINE manual keys (pasted by the customer; kid 'manual-1', verified by the embedded issuer key)
 *  - ONLINE dashboard tokens (kid from JWKS; only usable once the dashboard is deployed)
 *
 * - none:           no/invalid token → must enter a key (offline) or activate (online)
 * - ok:             within paid period
 * - payment_due:    past accessUntil but within grace → works + header banner
 * - blocked:        past grace (or offline key expired) → key-entry screen
 * - clock_tampered: system clock wound back > 24h below the high-water mark → fix the date
 * - needs_connection: ONLINE-only — 14-day availability token expired and dashboard unreachable
 * - suspended:      ONLINE-only — dashboard revoked the install
 */
export type LicenseState =
  | 'none'
  | 'ok'
  | 'payment_due'
  | 'blocked'
  | 'clock_tampered'
  | 'needs_connection'
  | 'suspended';

export interface LicenseEval {
  state: LicenseState;
  accessUntil: number | null; // epoch seconds (null = lifetime)
  graceDays: number | null;
  plan: string | null;
}

/** States that block login (HTTP 423). PAYMENT_DUE (grace) and OK do not block. */
export const BLOCKED_STATES: LicenseState[] = ['none', 'blocked', 'clock_tampered', 'needs_connection', 'suspended'];
/** States routed to the manual key-entry screen (/activate). */
export const ACTIVATE_STATES: LicenseState[] = ['none', 'blocked', 'clock_tampered'];

const SKEW_SECONDS = 24 * 3600; // clock-rollback tolerance

/**
 * Offline-first fallback JWKS for ONLINE dashboard tokens. Refreshed from the dashboard on every
 * successful online check; this constant only bootstraps verification before first online contact.
 */
export const FALLBACK_JWKS: { keys: JWK[] } = {
  keys: [
    { kty: 'OKP', crv: 'Ed25519', x: 'Gk4nGtNeFgZeeYKEVMUp5WsrtQjRDns6RslarMbV0N0', kid: 'k_e77eab1b', alg: 'EdDSA', use: 'sig' },
    { kty: 'OKP', crv: 'Ed25519', x: 'xHalgEVFd2m3iT6THXZO_FsjwrbuHITkvar2aR-F5ZY', kid: 'k_7c5e0428', alg: 'EdDSA', use: 'sig' },
  ],
};

function loadJwks(jwksCache: string | null): { keys: JWK[] } {
  if (jwksCache) {
    try {
      const parsed = JSON.parse(jwksCache);
      if (parsed && Array.isArray(parsed.keys) && parsed.keys.length) return parsed;
    } catch {
      /* fall through to embedded fallback */
    }
  }
  return FALLBACK_JWKS;
}

/** Resolve a verification key for the token's `kid`: manual keys use the embedded issuer key. */
async function selectKey(jwksCache: string | null, kid: string | undefined): Promise<KeyLike | null> {
  if (kid === 'manual-1') {
    return importSPKI(config.issuerPublicKeyPem, 'EdDSA');
  }
  const jwk = loadJwks(jwksCache).keys.find((k) => k.kid === kid) ?? FALLBACK_JWKS.keys.find((k) => k.kid === kid);
  return jwk ? ((await importJWK(jwk, 'EdDSA')) as KeyLike) : null;
}

/** Verify a pasted manual key offline (no DB). Throws on any invalid/expired/wrong-install key. */
export async function verifyManualKey(key: string): Promise<Record<string, unknown>> {
  const header = decodeProtectedHeader(key);
  if (header.kid !== 'manual-1') throw new Error('not a manual key');
  const pub = await importSPKI(config.issuerPublicKeyPem, 'EdDSA');
  const { payload } = await jwtVerify(key, pub, { issuer: 'posdash' });
  const sub = payload.sub;
  if (sub !== '*' && sub !== config.installId) throw new Error('key not valid for this install');
  return payload as Record<string, unknown>;
}

/**
 * Verify the stored token and compute the current state. Runs the clock-rollback guard first,
 * then evaluates the two clocks using a monotonic `effectiveNow` so winding the clock back can
 * never extend a license. Persists last_status / last_seen_at.
 */
export async function verifyLicense(db: DB): Promise<LicenseEval> {
  const row = repo.get(db);
  const nowSec = Math.floor(Date.now() / 1000);
  const graceFallback = row?.grace_days ?? null;
  const planFallback = row?.plan ?? null;

  // Suspension (online) is authoritative and sticky until a successful renew re-issues a token.
  if (row?.last_status === 'suspended') {
    return { state: 'suspended', accessUntil: null, graceDays: graceFallback, plan: planFallback };
  }

  // --- Clock-rollback guard (run first) ---
  const lastSeenSec = row?.last_seen_at ? Math.floor(Date.parse(row.last_seen_at) / 1000) : 0;
  if (lastSeenSec && nowSec < lastSeenSec - SKEW_SECONDS) {
    repo.setStatus(db, 'clock_tampered'); // do NOT advance the high-water mark
    return { state: 'clock_tampered', accessUntil: null, graceDays: graceFallback, plan: planFallback };
  }
  const effectiveNow = Math.max(nowSec, lastSeenSec);
  if (nowSec > lastSeenSec) repo.setLastSeen(db, new Date(nowSec * 1000).toISOString());

  if (!row?.token) {
    repo.setStatus(db, 'none');
    return { state: 'none', accessUntil: null, graceDays: null, plan: null };
  }

  const mode = row.mode ?? 'online';
  let payload: Record<string, unknown>;
  let expiredButValid = false;
  try {
    const header = decodeProtectedHeader(row.token);
    const key = await selectKey(row.jwks_cache, header.kid);
    if (!key) {
      // Unknown signing key: offline → can't trust → none; online → refresh online.
      const state: LicenseState = mode === 'offline' ? 'none' : 'needs_connection';
      repo.setStatus(db, state);
      return { state, accessUntil: null, graceDays: graceFallback, plan: planFallback };
    }
    // Judge expiry by effectiveNow (not wall-clock) so a rolled-back clock can't revive a key.
    const res = await jwtVerify(row.token, key, { issuer: 'posdash', currentDate: new Date(effectiveNow * 1000) });
    payload = res.payload as Record<string, unknown>;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      // Signature is valid; only the time window lapsed. Decode claims to classify.
      payload = decodeJwt(row.token) as Record<string, unknown>;
      expiredButValid = true;
    } else {
      const state: LicenseState = mode === 'offline' ? 'none' : 'needs_connection';
      repo.setStatus(db, state);
      return { state, accessUntil: null, graceDays: graceFallback, plan: planFallback };
    }
  }

  // Reject a key minted for a different install.
  const sub = payload.sub;
  if (sub !== '*' && sub !== config.installId) {
    repo.setStatus(db, 'none');
    return { state: 'none', accessUntil: null, graceDays: graceFallback, plan: planFallback };
  }

  const accessUntil = (payload.accessUntil ?? null) as number | null;
  const graceDays = (typeof payload.graceDays === 'number' ? payload.graceDays : 0) as number;
  const plan = (payload.plan ?? planFallback) as string | null;
  const claimMode = (payload.mode as string) ?? mode;

  let state: LicenseState;
  if (expiredButValid && claimMode !== 'offline') {
    // Online availability token (~14d) lapsed → must go online.
    state = 'needs_connection';
  } else if (accessUntil === null) {
    state = 'ok'; // lifetime
  } else if (effectiveNow <= accessUntil) {
    state = 'ok';
  } else if (effectiveNow <= accessUntil + graceDays * 86400) {
    state = 'payment_due';
  } else {
    state = 'blocked';
  }

  repo.setStatus(db, state);
  return { state, accessUntil, graceDays, plan };
}

/** Decode (without verifying) the token claims we cache for display. */
export function decodeTokenClaims(token: string): Record<string, unknown> {
  try {
    return decodeJwt(token) as Record<string, unknown>;
  } catch {
    return {};
  }
}
