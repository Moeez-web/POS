import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private auth = inject(AuthService);
  username = '';
  password = '';
  submitted = signal(false);
  loading = signal(false);
  error = signal('');

  get usernameError(): string {
    return !this.username.trim() ? 'Username is required' : '';
  }
  get passwordError(): string {
    return !this.password ? 'Password is required' : '';
  }

  submit(): void {
    this.submitted.set(true);
    if (this.usernameError || this.passwordError) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.auth.redirectAfterLogin();
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(e.error?.error ?? 'Login failed');
      },
    });
  }
}
