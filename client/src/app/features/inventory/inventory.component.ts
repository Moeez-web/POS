import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface StockRow { id: number; sku: string; name: string; reorder_level: number; stock: number }

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, PaginatorComponent],
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold">Inventory</h1>
        <div class="flex items-center gap-3">
          <input class="input max-w-xs" placeholder="🔍 Search or scan barcode" [(ngModel)]="q" (input)="onSearch()" (keyup.enter)="load()" data-testid="inv-search" />
          <label class="flex shrink-0 items-center gap-2 text-sm">
            <input type="checkbox" [(ngModel)]="lowOnly" (change)="goPage(1)" data-testid="inv-low" /> Low stock only
          </label>
        </div>
      </div>
      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>SKU</th><th>Name</th><th class="text-right">Stock</th><th class="text-right">Reorder level</th></tr></thead>
          <tbody>
            @for (r of items(); track r.id) {
              <tr data-testid="inv-row">
                <td class="font-mono text-xs">{{ r.sku }}</td><td>{{ r.name }}</td>
                <td class="text-right" [class.text-amber-600]="r.stock <= r.reorder_level" [class.font-semibold]="r.stock <= r.reorder_level">{{ r.stock }}</td>
                <td class="text-right text-slate-500">{{ r.reorder_level }}</td>
              </tr>
            }
            @if (items().length === 0) { <tr><td colspan="4" class="py-6 text-center text-slate-400">Nothing to show</td></tr> }
          </tbody>
        </table>
      </div>
      <app-paginator [total]="total()" [page]="pageNum" [pageSize]="20" (pageChange)="goPage($event)" />
    </div>
  `,
})
export class InventoryComponent {
  private api = inject(Api);
  items = signal<StockRow[]>([]);
  total = signal(0);
  pageNum = 1;
  lowOnly = false;
  q = '';
  private timer: any;
  constructor() { this.load(); }
  onSearch() { this.pageNum = 1; clearTimeout(this.timer); this.timer = setTimeout(() => this.load(), 250); }
  goPage(p: number) { this.pageNum = p; this.load(); }
  load() {
    const path = this.lowOnly ? '/inventory/low-stock' : '/inventory';
    this.api.getPage<StockRow>(path, { page: this.pageNum, pageSize: 20, q: this.q }).subscribe((p: Page<StockRow>) => {
      this.items.set(p.data);
      this.total.set(p.total);
    });
  }
}
