import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import type { Product } from '../../core/models';

interface Line {
  product: Product;
  qty: number;
  purchase_price: number; // major units in the form
  sale_price: number;
}

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [FormsModule, MoneyPipe, HasPermissionDirective],
  templateUrl: './purchases.component.html',
})
export class PurchasesComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  search = '';
  results = signal<Product[]>([]);
  lines = signal<Line[]>([]);

  total = computed(() => this.lines().reduce((a, l) => a + Math.round(l.purchase_price * 100) * l.qty, 0));

  onSearch(q: string): void {
    if (!q.trim()) { this.results.set([]); return; }
    this.api.get<Product[]>('/products/search', { q }).subscribe((r) => this.results.set(r));
  }

  addLine(p: Product): void {
    if (this.lines().some((l) => l.product.id === p.id)) return;
    this.lines.update((ls) => [...ls, { product: p, qty: 1, purchase_price: 0, sale_price: 0 }]);
    this.results.set([]);
    this.search = '';
  }

  removeLine(p: Product): void {
    this.lines.update((ls) => ls.filter((l) => l.product.id !== p.id));
  }

  submit(): void {
    const lines = this.lines();
    if (lines.length === 0) return;
    const body = {
      items: lines.map((l) => ({
        product_id: l.product.id,
        qty: Number(l.qty),
        purchase_price_minor: Math.round(Number(l.purchase_price) * 100),
        sale_price_minor: Math.round(Number(l.sale_price) * 100),
      })),
    };
    this.api.post('/purchases', body).subscribe({
      next: () => {
        this.toast.show('Stock received — batches created', 'success');
        this.lines.set([]);
      },
    });
  }
}
