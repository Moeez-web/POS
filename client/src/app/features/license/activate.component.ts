import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LicenseService } from '../../core/license.service';
import { Toast } from '../../shared/toast';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="card w-full max-w-sm p-8">
        <div class="mb-6 text-center">
          <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-xl font-bold text-white">P</div>
          <h1 class="text-xl font-semibold">Activate this device</h1>
          <p class="text-sm text-slate-500">Enter the activation code from your POS Dashboard.</p>
        </div>
        <form (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label">Activation code</label>
            <input class="input" name="code" [(ngModel)]="activationCode" data-testid="activate-code" autofocus />
            @if (submitted() && !activationCode.trim()) {
              <p class="mt-1 text-sm text-red-600" data-testid="activate-error">Activation code is required</p>
            }
          </div>
          <button class="btn-primary w-full" type="submit" [disabled]="loading()" data-testid="activate-submit">
            {{ loading() ? 'Activating…' : 'Activate' }}
          </button>
        </form>
        <p class="mt-4 text-center text-xs text-slate-400">Need help? Contact support&#64;posdash.app</p>
      </div>
    </div>
  `,
})
export class ActivateComponent {
  private lic = inject(LicenseService);
  private router = inject(Router);
  private toast = inject(Toast);
  activationCode = '';
  submitted = signal(false);
  loading = signal(false);

  submit(): void {
    this.submitted.set(true);
    if (!this.activationCode.trim()) return;
    this.loading.set(true);
    this.lic.activate(this.activationCode.trim()).subscribe({
      next: (s) => {
        this.loading.set(false);
        if (s.state === 'ok' || s.state === 'payment_due') {
          this.toast.show('Device activated', 'success');
          this.router.navigateByUrl('/login');
        } else {
          this.router.navigateByUrl('/payment-due');
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
