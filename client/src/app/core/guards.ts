import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from './auth.store';
import { LicenseService } from './license.service';

/**
 * Routes the user based on license state: unactivated → /activate, blocked → /payment-due,
 * ok/payment_due → allowed. Loads status on first use. Applied to login + the app layouts.
 */
export const licenseGuard: CanActivateFn = async () => {
  const lic = inject(LicenseService);
  const router = inject(Router);
  if (lic.state() === null) {
    try {
      await firstValueFrom(lic.refresh());
    } catch {
      router.navigateByUrl('/activate');
      return false;
    }
  }
  if (lic.needsKey()) {
    router.navigateByUrl('/activate'); // none / blocked / clock_tampered → paste a key
    return false;
  }
  if (lic.needsOnline()) {
    router.navigateByUrl('/payment-due'); // needs_connection / suspended (online)
    return false;
  }
  return true; // ok or payment_due (grace)
};

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
