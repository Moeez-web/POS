import { Injectable, NgZone, inject, signal } from '@angular/core';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'none'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface UpdaterApi {
  onStatus: (cb: (data: { status: UpdateStatus; version?: string; percent?: number; notes?: unknown; message?: string }) => void) => void;
  check: () => Promise<void>;
  install: () => Promise<void>;
}

/** Electron preload exposes window.POS_UPDATER; undefined in web/dev. */
function updater(): UpdaterApi | undefined {
  return (globalThis as any).POS_UPDATER;
}

/**
 * Tracks electron-updater status forwarded over IPC. Auto-download happens in the main
 * process; the customer chooses when to install. No-op when not running in Electron.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService {
  private zone = inject(NgZone);

  readonly status = signal<UpdateStatus>('idle');
  readonly version = signal<string | null>(null);
  readonly percent = signal<number>(0);

  constructor() {
    const u = updater();
    if (!u) return; // web/dev: nothing to listen to
    u.onStatus((data) => {
      // IPC callbacks fire outside Angular's zone — re-enter so signals refresh the view.
      this.zone.run(() => {
        if (data?.status) this.status.set(data.status);
        if (data?.version) this.version.set(data.version);
        if (typeof data?.percent === 'number') this.percent.set(data.percent);
      });
    });
  }

  /** Customer clicked "Install now" — restart into the new version. */
  install(): void {
    updater()?.install();
  }

  check(): void {
    updater()?.check();
  }
}
