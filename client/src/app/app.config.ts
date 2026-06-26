import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor, errorInterceptor } from './core/interceptors';

// In Electron the app is served from file:// (preload sets POS_API_BASE). Use hash routing there
// so navigation works without pushState path issues; the browser (dev/e2e over http) keeps clean URLs.
const isElectron = typeof (globalThis as any).POS_API_BASE === 'string';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, ...(isElectron ? [withHashLocation()] : [])),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
  ],
};
