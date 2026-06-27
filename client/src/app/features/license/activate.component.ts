import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LicenseService } from '../../core/license.service';
import { LogoComponent } from '../../shared/logo.component';
import { Toast } from '../../shared/toast';

/**
 * Offline manual key-entry screen. Shows this machine's Install ID, takes a pasted monthly key,
 * and applies it via /api/license/manual. Also handles the clock_tampered case (no key needed —
 * it clears once the system clock is correct again).
 */
@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [FormsModule, LogoComponent],
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="card w-full max-w-md p-8">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex justify-center"><app-logo [size]="48" /></div>
          <h1 class="text-xl font-semibold">Activate CounterPro</h1>
        </div>

        @if (clockTampered()) {
          <div class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800" data-testid="clock-tampered">
            <p class="font-medium">Your system clock has been set backwards.</p>
            <p class="mt-1">Set the correct date &amp; time on this computer to continue. No new key is needed — this clears once the clock is correct.</p>
          </div>
          <button class="btn-ghost mt-4 w-full" (click)="recheck()" data-testid="clock-recheck">I've fixed the date — re-check</button>
        } @else {
          <p class="mb-4 text-sm text-slate-500">Paste the monthly license key from your provider.</p>
          <form (ngSubmit)="apply()" class="space-y-3" novalidate>
            <input class="input font-mono text-xs" name="key" [(ngModel)]="key" placeholder="Paste your license key" data-testid="license-key" />
            @if (error()) {
              <p class="text-sm text-red-600" data-testid="license-error">{{ error() }}</p>
            }
            <button class="btn-primary w-full" type="submit" [disabled]="loading()" data-testid="license-apply">
              {{ loading() ? 'Applying…' : 'Apply key' }}
            </button>
          </form>

          <div class="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <div class="mb-1 font-medium text-slate-600">Your Install ID</div>
            @if (installId()) {
              <code class="break-all text-slate-800" data-testid="install-id">{{ installId() }}</code>
              <p class="mt-2">Send this ID to your provider to get your monthly key.</p>
            } @else if (serviceError()) {
              <p class="text-red-600" data-testid="service-error">Couldn't reach the local service ({{ serviceError() }}). The app's background service may have failed to start.</p>
              <button class="btn-ghost mt-2 w-full" (click)="retry()" data-testid="service-retry">Retry</button>
            } @else {
              <span class="text-slate-400" data-testid="install-id">Connecting to the local service…</span>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ActivateComponent implements OnInit {
  private lic = inject(LicenseService);
  private router = inject(Router);
  private toast = inject(Toast);
  key = '';
  loading = signal(false);
  error = signal('');
  serviceError = signal('');
  private attempts = 0;

  installId = computed(() => this.lic.installId());
  clockTampered = computed(() => this.lic.state() === 'clock_tampered');

  ngOnInit(): void {
    this.load();
  }

  /** Load the Install ID + state; the local server may still be starting, so retry a few times. */
  load(): void {
    this.lic.refresh().subscribe({
      next: () => this.serviceError.set(''),
      error: (e: { status?: number; statusText?: string; message?: string }) => {
        this.serviceError.set(e?.status ? `HTTP ${e.status} ${e.statusText ?? ''}`.trim() : e?.message ?? 'connection failed');
        if (++this.attempts < 8) setTimeout(() => this.load(), 1500);
      },
    });
  }

  retry(): void {
    this.attempts = 0;
    this.serviceError.set('');
    this.load();
  }

  apply(): void {
    this.error.set('');
    if (!this.key.trim()) {
      this.error.set('Paste your license key first.');
      return;
    }
    this.loading.set(true);
    this.lic.manual(this.key.trim()).subscribe({
      next: (s) => {
        this.loading.set(false);
        if (s.state === 'ok' || s.state === 'payment_due') {
          this.toast.show('License activated', 'success');
          this.router.navigateByUrl('/login');
        } else {
          this.error.set('That key did not activate this device.');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('That key is invalid or expired. Check you pasted the whole key.');
      },
    });
  }

  /** Re-check after the user fixes the clock; proceeds if the license is valid again. */
  recheck(): void {
    this.lic.refresh().subscribe({
      next: (s) => {
        if (s.state === 'ok' || s.state === 'payment_due') this.router.navigateByUrl('/login');
      },
    });
  }
}
