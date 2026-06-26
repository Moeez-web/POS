import os from 'node:os';
import { config } from '../../config';
import { latestSchemaVersion } from '../../db/migrate';

/**
 * Thin client for the POS Dashboard Device API. Responses are RAW JSON (no `{ data }` envelope).
 * Base URL from config.dashboardUrl (default dev http://localhost:4400/api/device).
 */

export interface DashLicenseResponse {
  status: string; // ok | payment_due | invalid_code | seat_limit_reached | suspended | unknown_install
  token?: string;
  expiresAt?: string;
  accessUntil?: string | null;
  graceDays?: number;
}

export interface DashHeartbeatResponse {
  ok: boolean;
  licenseStatus: string;
  action: string; // none | lock
  latestVersion?: string;
  updateAvailable: boolean;
}

const TIMEOUT_MS = 8000;

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.dashboardUrl}${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    if (res.status === 204) return undefined as T;
    if (!res.ok) throw new Error(`Dashboard ${path} returned ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Fields the dashboard fleet view wants on every call so it stays current. */
function deviceMeta() {
  return {
    appVersion: config.appVersion,
    schemaVersion: latestSchemaVersion(),
  };
}

export function activate(activationCode: string): Promise<DashLicenseResponse> {
  return call<DashLicenseResponse>('POST', '/activate', {
    installId: config.installId,
    activationCode,
    machineLabel: os.hostname(),
    platform: process.platform,
    ...deviceMeta(),
  });
}

export function renew(): Promise<DashLicenseResponse> {
  return call<DashLicenseResponse>('POST', '/license/renew', {
    installId: config.installId,
    ...deviceMeta(),
  });
}

export function heartbeat(): Promise<DashHeartbeatResponse> {
  return call<DashHeartbeatResponse>('POST', '/heartbeat', {
    installId: config.installId,
    ...deviceMeta(),
  });
}

export function fetchJwks(): Promise<{ keys: unknown[] }> {
  return call<{ keys: unknown[] }>('GET', '/keys');
}

export function fetchTime(): Promise<{ now: string }> {
  return call<{ now: string }>('GET', '/time');
}

export function latestUpdate(channel = 'stable'): Promise<{ version: string; notes: string | null; url: string | null } | undefined> {
  const q = new URLSearchParams({ channel, appVersion: config.appVersion });
  return call('GET', `/updates/latest?${q.toString()}`);
}
