import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from './auth.store';
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
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // A 401 from a credential-checking endpoint means "wrong password", not a dead
      // session — surface it as an error toast instead of force-logging-out the user.
      // (e.g. a wrong *current* password on the forced change-password screen.)
      const isCredentialCheck =
        req.url.endsWith('/auth/login') || req.url.endsWith('/auth/change-password');
      if (err.status === 401 && !isCredentialCheck) {
        store.clear();
        router.navigateByUrl('/login');
      } else {
        const msg = err.error?.error ?? err.message ?? 'Something went wrong';
        toast.show(msg, 'error');
      }
      return throwError(() => err);
    }),
  );
};
