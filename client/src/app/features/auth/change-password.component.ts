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
        <form (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="label">Current password</label>
            <input class="input" type="password" name="old" [(ngModel)]="oldPassword" data-testid="cp-old" />
          </div>
          <div>
            <label class="label">New password</label>
            <input class="input" type="password" name="new" [(ngModel)]="newPassword" data-testid="cp-new" />
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
  loading = signal(false);

  submit(): void {
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
