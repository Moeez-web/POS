import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Toast } from '../../shared/toast';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="card w-full max-w-sm p-8">
        <h1 class="mb-1 text-xl font-semibold">Change your password</h1>
        <p class="mb-6 text-sm text-slate-500">You must set a new password before continuing.</p>
        <form (ngSubmit)="submit()" class="space-y-4" novalidate>
          <div>
            <label class="label">Current password</label>
            <input class="input" type="password" name="old" [(ngModel)]="oldPassword" data-testid="cp-old" />
            @if (submitted() && oldError) {
              <p class="mt-1 text-sm text-red-600" data-testid="cp-old-error">{{ oldError }}</p>
            }
          </div>
          <div>
            <label class="label">New password</label>
            <input class="input" type="password" name="new" [(ngModel)]="newPassword" data-testid="cp-new" />
            @if ((submitted() || newPassword) && newError) {
              <p class="mt-1 text-sm text-red-600" data-testid="cp-new-error">{{ newError }}</p>
            }
          </div>
          <div>
            <label class="label">Confirm new password</label>
            <input class="input" type="password" name="confirm" [(ngModel)]="confirmPassword" data-testid="cp-confirm" />
            @if ((submitted() || confirmPassword) && confirmError) {
              <p class="mt-1 text-sm text-red-600" data-testid="cp-confirm-error">{{ confirmError }}</p>
            }
          </div>
          <button class="btn-primary w-full" type="submit" [disabled]="loading()" data-testid="cp-submit">Update password</button>
        </form>
      </div>
    </div>
  `,
})
export class ChangePasswordComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(Toast);
  oldPassword = '';
  newPassword = '';
  confirmPassword = '';
  submitted = signal(false);
  loading = signal(false);

  get oldError(): string {
    return !this.oldPassword ? 'Current password is required' : '';
  }
  get newError(): string {
    if (!this.newPassword) return 'New password is required';
    if (this.newPassword.length < 6) return 'New password must be at least 6 characters';
    return '';
  }
  get confirmError(): string {
    if (!this.confirmPassword) return 'Please confirm your new password';
    if (this.confirmPassword !== this.newPassword) return 'Passwords do not match';
    return '';
  }
  get isValid(): boolean {
    return !this.oldError && !this.newError && !this.confirmError;
  }

  submit(): void {
    this.submitted.set(true);
    if (!this.isValid) return;
    this.loading.set(true);
    this.auth.changePassword(this.oldPassword, this.newPassword).subscribe({
      next: () => {
        this.toast.show('Password updated', 'success');
        this.auth.refreshMe().subscribe(() => this.auth.redirectAfterLogin());
      },
      error: () => this.loading.set(false),
    });
  }
}
