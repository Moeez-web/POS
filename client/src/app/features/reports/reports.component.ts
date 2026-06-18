import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { AuthStore } from '../../core/auth.store';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

interface Row { label: string; qty?: number; total_minor: number; sales_count?: number }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [FormsModule, MoneyPipe, HasPermissionDirective],
  templateUrl: './reports.component.html',
})
export class ReportsComponent {
  private api = inject(Api);
  store = inject(AuthStore);

  from = '';
  to = '';

  profit = signal<any>(null);
  valuation = signal<any>(null);
  products = signal<Row[]>([]);
  categories = signal<Row[]>([]);
  cashiers = signal<Row[]>([]);
  expenses = signal<Row[]>([]);

  constructor() {
    const now = new Date();
    this.to = now.toISOString().slice(0, 10);
    this.from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.load();
  }

  setRange(days: number): void {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    this.to = to.toISOString().slice(0, 10);
    this.from = from.toISOString().slice(0, 10);
    this.load();
  }

  thisMonth(): void {
    const now = new Date();
    this.to = now.toISOString().slice(0, 10);
    this.from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    this.load();
  }

  load(): void {
    const p = { from: this.from, to: this.to };
    if (this.store.can('reports.profit.view')) this.api.get<any>('/reports/profit', p).subscribe({ next: (d) => this.profit.set(d), error: () => {} });
    if (this.store.can('reports.inventory_valuation.view')) this.api.get<any>('/reports/inventory-valuation').subscribe({ next: (d) => this.valuation.set(d), error: () => {} });
    if (this.store.can('reports.sales.view')) {
      this.api.get<any>('/reports/sales', { ...p, by: 'product' }).subscribe({ next: (d) => this.products.set(d.rows ?? []), error: () => {} });
      this.api.get<any>('/reports/sales', { ...p, by: 'category' }).subscribe({ next: (d) => this.categories.set(d.rows ?? []), error: () => {} });
      this.api.get<any>('/reports/sales', { ...p, by: 'cashier' }).subscribe({ next: (d) => this.cashiers.set(d.rows ?? []), error: () => {} });
    }
    if (this.store.can('reports.expenses.view')) this.api.get<any>('/reports/expenses', p).subscribe({ next: (d) => this.expenses.set(d.rows ?? []), error: () => {} });
  }

  /** Sum of net sales (for users who can see sales but not profit). */
  salesTotal(): number {
    return this.products().reduce((a, r) => a + (r.total_minor || 0), 0);
  }

  top(rows: Row[], n = 10): Row[] {
    return rows.slice(0, n);
  }
}
