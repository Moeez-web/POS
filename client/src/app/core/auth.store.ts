import { Injectable, computed, signal } from '@angular/core';
import type { User } from './models';

const TOKEN_KEY = 'pos_token';
const USER_KEY = 'pos_user';
const PERMS_KEY = 'pos_perms';

/** Holds the session (user, token, permissions) and survives a window reload via localStorage. */
@Injectable({ providedIn: 'root' })
export class AuthStore {
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<User | null>(JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'));
  readonly permissions = signal<Set<string>>(new Set(JSON.parse(localStorage.getItem(PERMS_KEY) ?? '[]')));

  readonly isAuthenticated = computed(() => !!this.token());
  readonly mustChangePassword = computed(() => !!this.user()?.must_change_password);

  setSession(token: string, user: User, permissions: string[]): void {
    this.token.set(token);
    this.user.set(user);
    this.permissions.set(new Set(permissions));
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
  }

  patchUser(user: User): void {
    this.user.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    this.token.set(null);
    this.user.set(null);
    this.permissions.set(new Set());
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMS_KEY);
  }

  can(permission: string): boolean {
    return this.permissions().has(permission);
  }

  canAny(...permissions: string[]): boolean {
    return permissions.some((p) => this.permissions().has(p));
  }
}
