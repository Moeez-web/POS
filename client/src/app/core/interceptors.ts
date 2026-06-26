import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
import { LicenseService } from './license.service';
import { Toast } from '../shared/toast';

/** Attaches the bearer token to every request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (token) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(req);
};

/** Surfaces API errors as toasts; on 401 clears the session and returns to login. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(Toast);
  const license = inject(LicenseService);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // 423 Locked = license enforcement. Body is { error: { code:'license_required', state } }.
      // Route by state: key-entry for offline states, the online block screen otherwise.
      if (err.status === 423 && err.error?.error?.code === 'license_required') {
        const state = err.error.error.state;
        if (state) license.setState(state);
        const onlineBlock = state === 'needs_connection' || state === 'suspended';
        router.navigateByUrl(onlineBlock ? '/payment-due' : '/activate');
        return throwError(() => err);
      }
      // A 401 from a credential-checking endpoint means "wrong password", not a dead
      // session — surface it as an error toast instead of force-logging-out the user.
      // (e.g. a wrong *current* password on the forced change-password screen.)
      const isCredentialCheck =
        req.url.endsWith('/auth/login') || req.url.endsWith('/auth/change-password');
      if (err.status === 401 && !isCredentialCheck) {
        store.clear();
        router.navigateByUrl('/login');
      } else {
        // Flat errors are `{ error: "message" }`; structured ones `{ error: { code } }`
        // are handled inline by the caller (e.g. invalid_key on the key screen) — don't toast those.
        const e = err.error?.error;
        if (typeof e === 'string') toast.show(e, 'error');
        else if (!e?.code) toast.show(err.message ?? 'Something went wrong', 'error');
      }
      return throwError(() => err);
    }),
  );
};
