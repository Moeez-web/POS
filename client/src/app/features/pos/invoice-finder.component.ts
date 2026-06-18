import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { ReceiptService } from '../../core/receipt.service';
import { Toast } from '../../shared/toast';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

interface SaleRow { id: number; invoice_no: string; total_minor: number; status: string; created_at: string }
interface SaleItem { id: number; product_name: string; qty: number; returned_qty: number; unit_price_minor: number; line_total_minor: number }
interface SaleDetail extends SaleRow { items: SaleItem[]; subtotal_minor: number; tax_minor: number }

/** Quick "find a past invoice → refund" dialog, opened from the POS with F2. */
@Component({
  selector: 'app-invoice-finder',
  standalone: true,
  imports: [FormsModule, DatePipe, MoneyPipe, HasPermissionDirective],
  templateUrl: './invoice-finder.component.html',
})
export class InvoiceFinderComponent {
  private api = inject(Api);
  private receipt = inject(ReceiptService);
  private toast = inject(Toast);
  @Output() closed = new EventEmitter<void>();
  @Output() resume = new EventEmitter<number>();

  q = '';
  results = signal<SaleRow[]>([]);
  selected = signal<SaleDetail | null>(null);
  settings = signal<Record<string, string>>({});
  returnReason = '';
  returnQty: Record<number, number> = {};
  private timer: any;

  constructor() {
    this.search();
    this.api.get<Record<string, string>>('/settings').subscribe((s) => this.settings.set(s));
  }

  /** Reprint a past invoice's thermal receipt (to the printer). */
  printRow(s: SaleRow, ev: Event): void {
    ev.stopPropagation();
    this.api.get<any>(`/sales/${s.id}`).subscribe((d) => this.receipt.print(d, this.settings()));
  }
  printCurrent(): void {
    const d = this.selected();
    if (d) this.receipt.print(d, this.settings());
  }

  search(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.api.getPage<SaleRow>('/sales', { q: this.q, pageSize: 12 }).subscribe((p) => this.results.set(p.data));
    }, 200);
  }

  /** Row click: held → resume to POS; completed → open the refund view. */
  rowClick(s: SaleRow): void {
    if (s.status === 'held') this.resume.emit(s.id);
    else this.open(s);
  }

  open(s: SaleRow): void {
    this.api.get<SaleDetail>(`/sales/${s.id}`).subscribe((d) => {
      this.selected.set(d);
      this.returnQty = {};
      this.returnReason = '';
    });
  }

  resumeSale(s: SaleRow, ev: Event): void {
    ev.stopPropagation();
    this.resume.emit(s.id);
  }

  deleteSale(s: SaleRow, ev: Event): void {
    ev.stopPropagation();
    this.api.delete(`/sales/${s.id}`).subscribe({
      next: () => { this.toast.show(`Invoice ${s.invoice_no} removed`, 'success'); this.search(); },
    });
  }

  back(): void { this.selected.set(null); }
  maxReturn(it: SaleItem): number { return it.qty - it.returned_qty; }
  clampReturn(it: SaleItem, v: number): void {
    this.returnQty[it.id] = Math.max(0, Math.min(Math.floor(Number(v) || 0), this.maxReturn(it)));
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
        this.closed.emit();
      },
    });
  }

  close(): void { this.closed.emit(); }
}
