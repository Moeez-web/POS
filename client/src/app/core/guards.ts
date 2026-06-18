import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (store.isAuthenticated()) return true;
  router.navigateByUrl('/login');
  return false;
};

/** Route must declare data.permission; the user's role must hold it. */
export const permissionGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  if (!store.isAuthenticated()) {
    router.navigateByUrl('/login');
    return false;
  }
  const required = route.data?.['permission'] as string | string[] | undefined;
  if (!required) return true;
  const perms = Array.isArray(required) ? required : [required];
  if (store.canAny(...perms)) return true;
  router.navigateByUrl('/app/forbidden');
  return false;
};
