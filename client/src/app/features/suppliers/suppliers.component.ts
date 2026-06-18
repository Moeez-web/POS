import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface Supplier { id: number; name: string; phone: string | null }

@Component({
  selector: 'app-suppliers',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, PaginatorComponent],
  template: `
    <div class="max-w-2xl space-y-4">
      <h1 class="text-2xl font-semibold">Suppliers</h1>
      <div *appHasPermission="'suppliers.create'" class="card flex flex-wrap gap-2 p-4">
        <input class="input flex-1" placeholder="Supplier name" [(ngModel)]="form.name" data-testid="sup-name" />
        <input class="input max-w-[160px]" placeholder="Phone" [(ngModel)]="form.phone" data-testid="sup-phone" />
        <button class="btn-primary" (click)="add()" data-testid="sup-add">Add</button>
      </div>
      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>Name</th><th>Phone</th></tr></thead>
          <tbody>
            @for (s of items(); track s.id) { <tr data-testid="sup-row"><td>{{ s.name }}</td><td>{{ s.phone || '—' }}</td></tr> }
            @if (items().length === 0) { <tr><td colspan="2" class="py-6 text-center text-slate-400">No suppliers</td></tr> }
          </tbody>
        </table>
      </div>
      <app-paginator [total]="total()" [page]="pageNum" [pageSize]="20" (pageChange)="goPage($event)" />
    </div>
  `,
})
export class SuppliersComponent {
  private api = inject(Api);
  private toast = inject(Toast);
  items = signal<Supplier[]>([]);
  total = signal(0);
  pageNum = 1;
  form = { name: '', phone: '' };
  constructor() { this.load(); }
  goPage(p: number) { this.pageNum = p; this.load(); }
  load() { this.api.getPage<Supplier>('/suppliers', { page: this.pageNum, pageSize: 20 }).subscribe((p: Page<Supplier>) => { this.items.set(p.data); this.total.set(p.total); }); }
  add() {
    if (!this.form.name.trim()) return;
    this.api.post('/suppliers', { name: this.form.name.trim(), phone: this.form.phone.trim() || null }).subscribe({ next: () => { this.form = { name: '', phone: '' }; this.toast.show('Supplier added', 'success'); this.load(); } });
  }
}
