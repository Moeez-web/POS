import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify, errors as joseErrors } from 'jose';
import type { JWK } from 'jose';
import type { DB } from '../db/connection';
import * as repo from '../modules/license/license.repo';

/**
 * Offline license state. Stored lowercase in `license.last_status` and returned to the client.
 * - unactivated:      no token yet → first-run activation needed
 * - ok:               normal, fully usable (offline-capable while the token is fresh)
 * - payment_due:      access lapsed but within grace → works + header banner
 * - payment_blocked:  past grace → block screen (login blocked)
 * - needs_connection: availability token expired / unverifiable / clock rolled back → must go online
 * - suspended:        revoked/suspended by the dashboard → locked
 */
export type LicenseState =
  | 'unactivated'
  | 'ok'
  | 'payment_due'
  | 'payment_blocked'
  | 'needs_connection'
  | 'suspended';

export interface LicenseEval {
  state: LicenseState;
  accessUntil: number | null; // epoch seconds (null = lifetime)
  graceDays: number | null;
  plan: string | null;
}

export const BLOCKED_STATES: LicenseState[] = ['payment_blocked', 'needs_connection', 'suspended'];

/**
 * Offline-first fallback JWKS. The app refreshes this from GET {dashboard}/keys on every
 * successful online check and caches the result in `license.jwks_cache`; this constant only
 * bootstraps verification before the first online contact. Replace with the production
 * dashboard's JWKS at build time: `curl https://<dashboard>/api/device/keys`.
 */
export const FALLBACK_JWKS: { keys: JWK[] } = {
  keys: [
    { kty: 'OKP', crv: 'Ed25519', x: 'Gk4nGtNeFgZeeYKEVMUp5WsrtQjRDns6RslarMbV0N0', kid: 'k_e77eab1b', alg: 'EdDSA', use: 'sig' },
    { kty: 'OKP', crv: 'Ed25519', x: 'xHalgEVFd2m3iT6THXZO_FsjwrbuHITkvar2aR-F5ZY', kid: 'k_7c5e0428', alg: 'EdDSA', use: 'sig' },
  ],
};

const SKEW_SECONDS = 60;

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

/** Find the JWK matching the token's `kid` in the cached JWKS, falling back to the embedded one. */
function findKey(jwksCache: string | null, kid: string | undefined): JWK | undefined {
  const cached = loadJwks(jwksCache).keys.find((k) => k.kid === kid);
  if (cached) return cached;
  return FALLBACK_JWKS.keys.find((k) => k.kid === kid);
}

/**
 * Verify the stored license token and compute the current state from the two clocks
 * (availability `exp` via the signed token; payment `accessUntil` + `graceDays` from claims).
 * Persists the computed `last_status` and advances the monotonic `last_seen_at` anchor.
 */
export async function verifyLicense(db: DB): Promise<LicenseEval> {
  const row = repo.get(db);
  const nowSec = Math.floor(Date.now() / 1000);

  // Suspension is authoritative and sticky until a successful renew re-issues a token.
  if (row?.last_status === 'suspended') {
    return { state: 'suspended', accessUntil: null, graceDays: row?.grace_days ?? null, plan: row?.plan ?? null };
  }

  if (!row?.token) {
    repo.setStatus(db, 'unactivated');
    return { state: 'unactivated', accessUntil: null, graceDays: null, plan: null };
  }

  // Clock-tamper guard: if the system clock is meaningfully earlier than the last anchor,
  // force NEEDS_CONNECTION until an online refresh re-anchors via {dashboard}/time.
  const lastSeenSec = row.last_seen_at ? Math.floor(Date.parse(row.last_seen_at) / 1000) : 0;
  if (lastSeenSec && nowSec < lastSeenSec - SKEW_SECONDS) {
    repo.setStatus(db, 'needs_connection');
    return { state: 'needs_connection', accessUntil: null, graceDays: row.grace_days ?? null, plan: row.plan ?? null };
  }

  let payload: Record<string, unknown>;
  try {
    const header = decodeProtectedHeader(row.token);
    const jwk = findKey(row.jwks_cache, header.kid);
    if (!jwk) {
      // Unknown signing key (likely rotated while offline) → must refresh online.
      repo.setStatus(db, 'needs_connection');
      return { state: 'needs_connection', accessUntil: null, graceDays: row.grace_days ?? null, plan: row.plan ?? null };
    }
    const key = await importJWK(jwk, 'EdDSA');
    const res = await jwtVerify(row.token, key, { issuer: 'posdash', subject: undefined });
    payload = res.payload as Record<string, unknown>;
  } catch (err) {
    // Expired availability token OR an untrusted/invalid signature → go online to recover.
    void (err instanceof joseErrors.JWTExpired);
    repo.setStatus(db, 'needs_connection');
    return { state: 'needs_connection', accessUntil: null, graceDays: row.grace_days ?? null, plan: row.plan ?? null };
  }

  const accessUntil = (payload.accessUntil ?? null) as number | null;
  const graceDays = (typeof payload.graceDays === 'number' ? payload.graceDays : 0) as number;
  const plan = (payload.plan ?? row.plan ?? null) as string | null;

  let state: LicenseState;
  if (accessUntil === null) {
    state = 'ok'; // lifetime
  } else if (nowSec <= accessUntil) {
    state = 'ok';
  } else if (nowSec <= accessUntil + graceDays * 86400) {
    state = 'payment_due';
  } else {
    state = 'payment_blocked';
  }

  // Advance the monotonic anchor and persist the computed status.
  repo.setStatus(db, state);
  if (!lastSeenSec || nowSec > lastSeenSec) repo.setLastSeen(db, new Date(nowSec * 1000).toISOString());

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
