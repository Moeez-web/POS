import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface SaleRow { id: number; invoice_no: string; total_minor: number; status: string; created_at: string }
interface SaleItem { id: number; product_name: string; qty: number; returned_qty: number; returned_amount_minor: number; unit_price_minor: number; line_total_minor: number }
interface SaleDetail extends SaleRow { items: SaleItem[]; payments: { method: string; amount_minor: number }[]; subtotal_minor: number; tax_minor: number; discount_minor: number; paid_minor: number; change_minor: number; refunded_minor: number; net_total_minor: number }

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [FormsModule, DatePipe, MoneyPipe, HasPermissionDirective, PaginatorComponent],
  templateUrl: './invoices.component.html',
})
export class InvoicesComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  page = signal<Page<SaleRow> | null>(null);
  pageNum = 1;
  selected = signal<SaleDetail | null>(null);

  returning = signal(false);
  returnReason = '';
  returnQty: Record<number, number> = {};

  constructor() { this.load(); }

  load(): void {
    this.api.getPage<SaleRow>('/sales', { page: this.pageNum, pageSize: 20 }).subscribe((p) => this.page.set(p));
  }
  goPage(p: number): void { this.pageNum = p; this.load(); }

  open(s: SaleRow): void {
    this.api.get<SaleDetail>(`/sales/${s.id}`).subscribe((d) => this.selected.set(d));
  }

  maxReturn(it: SaleItem): number { return it.qty - it.returned_qty; }
  clampReturn(it: SaleItem, v: number): void {
    this.returnQty[it.id] = Math.max(0, Math.min(Math.floor(Number(v) || 0), this.maxReturn(it)));
  }

  openReturn(): void {
    this.returnReason = '';
    this.returnQty = {};
    this.returning.set(true);
  }

  submitReturn(): void {
    const sale = this.selected();
    if (!sale) return;
    const items = sale.items
      .filter((it) => (this.returnQty[it.id] || 0) > 0)
      .map((it) => ({ sale_item_id: it.id, qty: Math.min(this.returnQty[it.id], this.maxReturn(it)) }));
    if (items.length === 0) { this.toast.show('Enter a quantity to return', 'error'); return; }
    this.api.post('/returns', { original_sale_id: sale.id, reason: this.returnReason || null, items }).subscribe({
      next: () => {
        this.toast.show('Refund processed — stock restored', 'success');
        this.returning.set(false);
        this.open(sale); // refresh detail
        this.load();
      },
    });
  }
}
