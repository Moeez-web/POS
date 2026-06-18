import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Page } from './models';

/** Base URL: Electron's preload injects window.POS_API_BASE; dev falls back to localhost:4317. */
export function apiBase(): string {
  return (globalThis as any).POS_API_BASE ?? 'http://localhost:4317/api';
}

function toParams(obj?: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  if (obj) {
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
  }
  return p;
}

/** Thin typed wrapper around HttpClient. Unwraps the `{ data }` envelope. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private base = apiBase();

  get<T>(path: string, params?: Record<string, unknown>): Observable<T> {
    return this.http.get<{ data: T }>(this.base + path, { params: toParams(params) }).pipe(map((r) => r.data));
  }

  getPage<T>(path: string, params?: Record<string, unknown>): Observable<Page<T>> {
    return this.http.get<Page<T>>(this.base + path, { params: toParams(params) });
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<{ data: T }>(this.base + path, body).pipe(map((r) => r.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<{ data: T }>(this.base + path, body).pipe(map((r) => r.data));
  }

  put<T>(path: string, body: unknown): Observable<T> {
    return this.http.put<{ data: T }>(this.base + path, body).pipe(map((r) => r.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<{ data: T }>(this.base + path).pipe(map((r) => r.data));
  }
}
