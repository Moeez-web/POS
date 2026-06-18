import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { AuthService } from '../core/auth.service';
import { HasPermissionDirective } from '../shared/has-permission.directive';

@Component({
  selector: 'app-pos-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HasPermissionDirective],
  template: `
    <div class="flex h-screen flex-col overflow-hidden bg-slate-100">
      <header class="flex items-center justify-between bg-slate-900 px-5 py-2.5 text-white">
        <div class="flex items-center gap-3">
          <span class="font-semibold">POS Register</span>
          <a *appHasPermission="'products.read'" routerLink="/app/dashboard" class="text-xs text-slate-300 hover:text-white" data-testid="to-dashboard">← Dashboard</a>
        </div>
        <div class="flex items-center gap-3 text-sm">
          <span>{{ store.user()?.username }}</span>
          <button class="rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600" (click)="logout()" data-testid="logout">Logout</button>
        </div>
      </header>
      <main class="flex-1 overflow-hidden">
        <router-outlet />
      </main>
    </div>
  `,
})
export class PosLayoutComponent {
  store = inject(AuthStore);
  private auth = inject(AuthService);
  logout(): void {
    this.auth.logout();
  }
}
