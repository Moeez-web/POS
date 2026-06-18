import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Api } from './api';
import { AuthStore } from './auth.store';
import type { LoginResponse } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(Api);
  private store = inject(AuthStore);
  private router = inject(Router);

  login(username: string, password: string) {
    return this.api
      .post<LoginResponse>('/auth/login', { username, password })
      .pipe(tap((r) => this.store.setSession(r.token, r.user, r.permissions)));
  }

  changePassword(oldPassword: string, newPassword: string) {
    return this.api.post('/auth/change-password', { old_password: oldPassword, new_password: newPassword });
  }

  refreshMe() {
    return this.api
      .get<LoginResponse>('/auth/me')
      .pipe(tap((r) => this.store.setSession(this.store.token()!, r.user, r.permissions)));
  }

  logout(): void {
    this.api.post('/auth/logout', {}).subscribe({ next: () => {}, error: () => {} });
    this.store.clear();
    this.router.navigateByUrl('/login');
  }

  /** Role-based landing: cashier-type users go to the register, managers/admins to the dashboard. */
  redirectAfterLogin(): void {
    const store = this.store;
    if (store.mustChangePassword()) {
      this.router.navigateByUrl('/change-password');
      return;
    }
    // If the user can sell but has no management dashboard permissions, send them to POS.
    const managementPerm = ['users.read', 'roles.read', 'reports.sales.view', 'products.create', 'purchases.read'];
    const isCashierLike = store.can('sales.create') && !store.canAny(...managementPerm);
    this.router.navigateByUrl(isCashierLike ? '/pos' : '/app/dashboard');
  }
}
