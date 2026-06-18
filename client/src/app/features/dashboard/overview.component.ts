import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [RouterLink, MoneyPipe, HasPermissionDirective],
  templateUrl: './overview.component.html',
})
export class OverviewComponent {
  private api = inject(Api);
  store = inject(AuthStore);

  daily = signal<any>(null);
  profit = signal<any>(null);
  lowStock = signal<number>(0);
  productCount = signal<number | null>(null);

  constructor() {
    this.api.get<any>('/reports/daily').subscribe({ next: (d) => this.daily.set(d), error: () => {} });
    if (this.store.can('reports.profit.view')) {
      this.api.get<any>('/reports/profit').subscribe({ next: (d) => this.profit.set(d), error: () => {} });
    }
    if (this.store.can('inventory.read')) {
      this.api.getPage<any>('/inventory/low-stock', { pageSize: 1 }).subscribe({ next: (p) => this.lowStock.set(p.total), error: () => {} });
    }
    if (this.store.can('products.read')) {
      this.api.getPage<any>('/products', { pageSize: 1 }).subscribe({ next: (p) => this.productCount.set(p.total), error: () => {} });
    }
  }
}
