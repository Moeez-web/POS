import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { AuthService } from '../core/auth.service';
import { LicenseService } from '../core/license.service';
import { HasPermissionDirective } from '../shared/has-permission.directive';
import { UpdateBannerComponent } from '../shared/update-banner.component';

@Component({
  selector: 'app-pos-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HasPermissionDirective, UpdateBannerComponent],
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
      <app-update-banner />
      @if (license.paymentDue() && !bannerDismissed()) {
        <div class="flex items-center justify-between gap-4 bg-amber-100 px-5 py-2 text-sm text-amber-900" data-testid="payment-due-banner">
          <span>Your license expires in <strong>{{ license.daysLeft() }} day(s)</strong> — contact your provider for next month's key. <a routerLink="/activate" class="font-medium underline">Enter key</a></span>
          <button class="rounded px-2 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-200" (click)="dismissBanner()" data-testid="payment-due-dismiss">Dismiss</button>
        </div>
      }
      <main class="flex-1 overflow-hidden">
        <router-outlet />
      </main>
    </div>
  `,
})
export class PosLayoutComponent {
  store = inject(AuthStore);
  license = inject(LicenseService);
  bannerDismissed = signal(false);
  private auth = inject(AuthService);
  logout(): void {
    this.auth.logout();
  }
  dismissBanner(): void {
    this.bannerDismissed.set(true);
  }
}
