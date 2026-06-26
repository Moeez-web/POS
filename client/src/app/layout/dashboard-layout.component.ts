import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '../core/auth.store';
import { AuthService } from '../core/auth.service';
import { LicenseService } from '../core/license.service';
import { HasPermissionDirective } from '../shared/has-permission.directive';
import { UpdateBannerComponent } from '../shared/update-banner.component';
import { LogoComponent } from '../shared/logo.component';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, HasPermissionDirective, UpdateBannerComponent, LogoComponent],
  templateUrl: './dashboard-layout.component.html',
})
export class DashboardLayoutComponent {
  store = inject(AuthStore);
  license = inject(LicenseService);
  bannerDismissed = signal(false);
  private auth = inject(AuthService);

  dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  // icon = a heroicons-style SVG path (rendered inline; no icon-font dependency, works offline).
  nav = [
    { label: 'Dashboard', path: '/app/dashboard', perm: null, icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3v-6h6v6h3a1 1 0 001-1V10' },
    { label: 'Sell (POS)', path: '/pos', perm: 'sales.create', icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 4h12M9 21a1 1 0 100-2 1 1 0 000 2zm8 0a1 1 0 100-2 1 1 0 000 2z' },
    { label: 'Products', path: '/app/products', perm: 'products.read', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-14L4 7m8 4v10M4 7v10l8 4' },
    { label: 'Suppliers', path: '/app/suppliers', perm: 'suppliers.read', icon: 'M3 9h13v7H3zM16 13h3l2 3v0h-5M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm11 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
    { label: 'Receive Stock', path: '/app/purchases', perm: 'purchases.create', icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2' },
    { label: 'Invoices', path: '/app/invoices', perm: 'sales.read', icon: 'M9 2h6a2 2 0 012 2v16l-3-2-2 2-2-2-3 2V4a2 2 0 012-2zM9 7h6M9 11h6' },
    { label: 'Returns', path: '/app/returns', perm: 'returns.read', icon: 'M3 7h11a4 4 0 014 4v0a4 4 0 01-4 4H6m-3-8l3-3M3 7l3 3' },
    { label: 'Inventory', path: '/app/inventory', perm: 'inventory.read', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { label: 'Expenses', path: '/app/expenses', perm: 'expenses.read', icon: 'M3 6h18M3 6v12a2 2 0 002 2h14a2 2 0 002-2V6M3 6l2-3h14l2 3M12 11a2 2 0 100 4 2 2 0 000-4z' },
    { label: 'Reports', path: '/app/reports', perm: 'reports.daily.view', icon: 'M4 19V5m0 14h16M8 17V9m4 8V5m4 12v-6' },
    { label: 'Customers', path: '/app/customers', perm: 'customers.read', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z' },
    { label: 'Users', path: '/app/users', perm: 'users.read', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-2a4 4 0 014-4h8a4 4 0 014 4v2' },
    { label: 'Roles', path: '/app/roles', perm: 'roles.read', icon: 'M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z' },
    { label: 'Settings', path: '/app/settings', perm: 'settings.read', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13a1.7 1.7 0 00.4 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1A1.7 1.7 0 005 19.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 003 13H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 5L4.5 5a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 0011 3.6V3a2 2 0 114 0v.1a1.7 1.7 0 002.9 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00.4 1.9' },
  ];

  logout(): void {
    this.auth.logout();
  }
}
