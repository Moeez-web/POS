import { Injectable, computed, inject, signal } from '@angular/core';
import { tap } from 'rxjs/operators';
import { Api } from './api';
import type { LicenseState, LicenseStatus } from './models';

const BLOCKED: LicenseState[] = ['payment_blocked', 'needs_connection', 'suspended'];

/** Wraps the local /license/* endpoints and holds the current license state as a signal. */
@Injectable({ providedIn: 'root' })
export class LicenseService {
  private api = inject(Api);

  readonly status = signal<LicenseStatus | null>(null);
  readonly state = computed<LicenseState | null>(() => this.status()?.state ?? null);

  readonly unactivated = computed(() => this.state() === 'unactivated');
  readonly paymentDue = computed(() => this.state() === 'payment_due');
  readonly blocked = computed(() => {
    const s = this.state();
    return s != null && BLOCKED.includes(s);
  });

  /** Local-only check (no network). */
  refresh() {
    return this.api.get<LicenseStatus>('/license/status').pipe(tap((s) => this.status.set(s)));
  }

  activate(activationCode: string) {
    return this.api.post<LicenseStatus>('/license/activate', { activationCode }).pipe(tap((s) => this.status.set(s)));
  }

  /** Backs the Retry button — asks the server to renew against the dashboard. */
  renew() {
    return this.api.post<LicenseStatus>('/license/renew', {}).pipe(tap((s) => this.status.set(s)));
  }

  /** Used by the interceptor when a 423 reveals the state without a /status round-trip. */
  setState(state: LicenseState): void {
    const cur = this.status();
    this.status.set({ accessUntil: null, graceDays: null, plan: null, ...(cur ?? {}), state });
  }
}
