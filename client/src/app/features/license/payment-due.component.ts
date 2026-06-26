import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LicenseService } from '../../core/license.service';

/**
 * Block screen for payment_blocked / needs_connection / suspended. Also reachable on a 423.
 * The Retry button asks the server to renew against the dashboard.
 */
@Component({
  selector: 'app-payment-due',
  standalone: true,
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="card w-full max-w-md p-8 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86l-8.48 14.7A1 1 0 002.66 20h18.68a1 1 0 00.85-1.44l-8.48-14.7a1 1 0 00-1.72 0z" />
          </svg>
        </div>
        <h1 class="text-xl font-semibold" data-testid="block-title">{{ title() }}</h1>
        <p class="mt-2 text-sm text-slate-500" data-testid="block-message">{{ message() }}</p>

        <button class="btn-primary mt-6 w-full" [disabled]="loading()" (click)="retry()" data-testid="block-retry">
          {{ loading() ? 'Checking…' : 'Retry' }}
        </button>
        <p class="mt-4 text-xs text-slate-400">Still stuck? Contact support&#64;posdash.app</p>
      </div>
    </div>
  `,
})
export class PaymentDueComponent {
  private lic = inject(LicenseService);
  private router = inject(Router);
  loading = signal(false);

  title = computed(() => {
    switch (this.lic.state()) {
      case 'needs_connection':
        return 'Connection required';
      case 'suspended':
        return 'License suspended';
      default:
        return 'Payment required';
    }
  });

  message = computed(() => {
    switch (this.lic.state()) {
      case 'needs_connection':
        return 'Connect to the internet to continue using the app.';
      case 'suspended':
        return 'This license has been suspended. Please contact support to restore access.';
      default:
        return 'Please clear payment to continue using the app.';
    }
  });

  retry(): void {
    this.loading.set(true);
    this.lic.renew().subscribe({
      next: (s) => {
        this.loading.set(false);
        if (s.state === 'ok' || s.state === 'payment_due') {
          this.router.navigateByUrl('/login');
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
