import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { MoneyPipe } from '../../shared/money.pipe';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface ReturnRow { id: number; invoice_no: string; total_minor: number; reason: string | null; processed_by: string | null; created_at: string }
interface ReturnItem { id: number; product_name: string; qty: number; amount_minor: number }
interface ReturnDetail extends ReturnRow { items: ReturnItem[] }

@Component({
  selector: 'app-returns',
  standalone: true,
  imports: [FormsModule, DatePipe, MoneyPipe, PaginatorComponent],
  templateUrl: './returns.component.html',
})
export class ReturnsComponent {
  private api = inject(Api);

  page = signal<Page<ReturnRow> | null>(null);
  selected = signal<ReturnDetail | null>(null);
  q = '';
  pageNum = 1;

  constructor() { this.load(); }

  load(): void {
    this.api.getPage<ReturnRow>('/returns', { q: this.q, page: this.pageNum, pageSize: 20 }).subscribe((p) => this.page.set(p));
  }
  search(): void { this.pageNum = 1; this.load(); }
  goPage(p: number): void { this.pageNum = p; this.load(); }
  open(r: ReturnRow): void { this.api.get<ReturnDetail>(`/returns/${r.id}`).subscribe((d) => this.selected.set(d)); }
}
