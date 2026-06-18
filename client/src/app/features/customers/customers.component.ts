import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface Customer { id: number; name: string; phone: string | null }

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, PaginatorComponent],
  template: `
    <div class="max-w-2xl space-y-4">
      <h1 class="text-2xl font-semibold">Customers</h1>
      <div *appHasPermission="'customers.create'" class="card flex flex-wrap gap-2 p-4">
        <input class="input flex-1" placeholder="Customer name" [(ngModel)]="form.name" data-testid="cust-name" />
        <input class="input max-w-[160px]" placeholder="Phone" [(ngModel)]="form.phone" data-testid="cust-phone" />
        <button class="btn-primary" (click)="add()" data-testid="cust-add">Add</button>
      </div>
      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>Name</th><th>Phone</th></tr></thead>
          <tbody>
            @for (c of items(); track c.id) { <tr data-testid="cust-row"><td>{{ c.name }}</td><td>{{ c.phone || '—' }}</td></tr> }
            @if (items().length === 0) { <tr><td colspan="2" class="py-6 text-center text-slate-400">No customers</td></tr> }
          </tbody>
        </table>
      </div>
      <app-paginator [total]="total()" [page]="pageNum" [pageSize]="20" (pageChange)="goPage($event)" />
    </div>
  `,
})
export class CustomersComponent {
  private api = inject(Api);
  private toast = inject(Toast);
  items = signal<Customer[]>([]);
  total = signal(0);
  pageNum = 1;
  form = { name: '', phone: '' };
  constructor() { this.load(); }
  goPage(p: number) { this.pageNum = p; this.load(); }
  load() { this.api.getPage<Customer>('/customers', { page: this.pageNum, pageSize: 20 }).subscribe((p: Page<Customer>) => { this.items.set(p.data); this.total.set(p.total); }); }
  add() {
    if (!this.form.name.trim()) return;
    this.api.post('/customers', { name: this.form.name.trim(), phone: this.form.phone.trim() || null }).subscribe({ next: () => { this.form = { name: '', phone: '' }; this.toast.show('Customer added', 'success'); this.load(); } });
  }
}
