import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Api } from './api';
import type { LicenseState, LicenseStatus } from './models';

/** States that send the user to the manual key-entry screen (/activate). */
const NEEDS_KEY: LicenseState[] = ['none', 'blocked', 'clock_tampered'];
/** ONLINE-only states routed to the dashboard block screen (/payment-due). */
const NEEDS_ONLINE: LicenseState[] = ['needs_connection', 'suspended'];

/** Wraps the local /license/* endpoints and holds the current license state as a signal. */
@Injectable({ providedIn: 'root' })
export class LicenseService {
  private api = inject(Api);

  readonly status = signal<LicenseStatus | null>(null);
  readonly state = computed<LicenseState | null>(() => this.status()?.state ?? null);
  readonly installId = computed(() => this.status()?.installId ?? null);

  readonly needsKey = computed(() => {
    const s = this.state();
    return s != null && NEEDS_KEY.includes(s);
  });
  readonly needsOnline = computed(() => {
    const s = this.state();
    return s != null && NEEDS_ONLINE.includes(s);
  });
  readonly paymentDue = computed(() => this.state() === 'payment_due');

  /** Days remaining until the grace window ends (for the PAYMENT_DUE banner). */
  readonly daysLeft = computed(() => {
    const s = this.status();
    if (!s || s.accessUntil == null) return null;
    const end = s.accessUntil + (s.graceDays ?? 0) * 86400;
    return Math.max(0, Math.ceil((end - Date.now() / 1000) / 86400));
  });

  /** Local-only check (no network). */
  refresh() {
    return this.api.get<LicenseStatus>('/license/status').pipe(tap((s) => this.status.set(s)));
  }

  /** Apply a pasted OFFLINE manual key. */
  manual(key: string) {
    return this.api.post<LicenseStatus>('/license/manual', { key }).pipe(tap((s) => this.status.set(s)));
  }

  /** ONLINE (dashboard) — kept for when the dashboard is deployed. */
  activate(activationCode: string) {
    return this.api.post<LicenseStatus>('/license/activate', { activationCode }).pipe(tap((s) => this.status.set(s)));
  }
  renew() {
    return this.api.post<LicenseStatus>('/license/renew', {}).pipe(tap((s) => this.status.set(s)));
  }

  /** Used by the interceptor when a 423 reveals the state without a /status round-trip. */
  setState(state: LicenseState): void {
    const cur = this.status();
    this.status.set({ accessUntil: null, graceDays: null, plan: null, installId: cur?.installId ?? '', ...(cur ?? {}), state });
  }
}
