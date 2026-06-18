import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

/**
 * Logs the user out after N minutes of inactivity (default 10). Shows a 30s warning first.
 * The POS register subscribes to onWarningTimeout to auto-park the open cart before logout.
 */
@Injectable({ providedIn: 'root' })
export class IdleTimeoutService {
  private auth = inject(AuthService);
  private store = inject(AuthStore);

  readonly warning = signal(false);
  private idleMs = 10 * 60 * 1000;
  private warnMs = 30 * 1000;
  private idleTimer: any = null;
  private warnTimer: any = null;
  private onLogout: (() => void) | null = null;
  private started = false;

  configure(minutes: number): void {
    this.idleMs = Math.max(1, minutes) * 60 * 1000;
  }

  /** Called by the POS layout to flush the cart before the forced logout. */
  setBeforeLogout(fn: () => void): void {
    this.onLogout = fn;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach((ev) =>
      window.addEventListener(ev, this.reset, { passive: true }),
    );
    this.reset();
  }

  stop(): void {
    this.started = false;
    clearTimeout(this.idleTimer);
    clearTimeout(this.warnTimer);
    this.warning.set(false);
  }

  private reset = (): void => {
    if (!this.store.isAuthenticated()) return;
    this.warning.set(false);
    clearTimeout(this.idleTimer);
    clearTimeout(this.warnTimer);
    this.idleTimer = setTimeout(() => this.onIdle(), this.idleMs - this.warnMs);
  };

  private onIdle(): void {
    this.warning.set(true);
    this.warnTimer = setTimeout(() => {
      this.warning.set(false);
      try {
        this.onLogout?.();
      } finally {
        this.auth.logout();
      }
    }, this.warnMs);
  }
}
