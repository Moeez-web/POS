import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LicenseService } from '../../core/license.service';
import { Toast } from '../../shared/toast';

/**
 * Offline manual key-entry screen. Shows this machine's Install ID, takes a pasted monthly key,
 * and applies it via /api/license/manual. Also handles the clock_tampered case (no key needed —
 * it clears once the system clock is correct again).
 */
@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="card w-full max-w-md p-8">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">P</div>
          <h1 class="text-xl font-semibold">Activate this device</h1>
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
            <textarea class="input min-h-28 font-mono text-xs" name="key" [(ngModel)]="key" placeholder="Paste your license key here" data-testid="license-key"></textarea>
            @if (error()) {
              <p class="text-sm text-red-600" data-testid="license-error">{{ error() }}</p>
            }
            <button class="btn-primary w-full" type="submit" [disabled]="loading()" data-testid="license-apply">
              {{ loading() ? 'Applying…' : 'Apply key' }}
            </button>
          </form>

          <div class="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <div class="mb-1 font-medium text-slate-600">Your Install ID</div>
            <code class="break-all text-slate-800" data-testid="install-id">{{ installId() || '—' }}</code>
            <p class="mt-2">Send this ID to your provider to get your monthly key.</p>
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

  installId = computed(() => this.lic.installId());
  clockTampered = computed(() => this.lic.state() === 'clock_tampered');

  ngOnInit(): void {
    // Load the Install ID + current state (this route is public, so it may be unloaded).
    if (this.lic.state() === null) this.lic.refresh().subscribe({ error: () => {} });
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
