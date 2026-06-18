import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page } from '../../core/models';

interface ExpenseCat { id: number; name: string }
interface Expense { id: number; amount_minor: number; description: string | null; date: string; category_name: string | null }

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [FormsModule, MoneyPipe, HasPermissionDirective, PaginatorComponent],
  template: `
    <div class="max-w-3xl space-y-4">
      <h1 class="text-2xl font-semibold">Expenses</h1>

      <div *appHasPermission="'expenses.create'" class="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-5">
        <select class="input sm:col-span-1" [(ngModel)]="form.expense_category_id" data-testid="exp-cat">
          @for (c of cats(); track c.id) { <option [value]="c.id">{{ c.name }}</option> }
        </select>
        <input class="input" type="number" placeholder="Amount" [(ngModel)]="form.amount" data-testid="exp-amount" />
        <input class="input sm:col-span-2" placeholder="Description" [(ngModel)]="form.description" data-testid="exp-desc" />
        <button class="btn-primary" (click)="add()" data-testid="exp-add">Add</button>
      </div>

      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="text-right">Amount</th></tr></thead>
          <tbody>
            @for (e of items(); track e.id) {
              <tr data-testid="exp-row">
                <td class="text-xs">{{ e.date }}</td><td>{{ e.category_name || '—' }}</td>
                <td>{{ e.description || '—' }}</td><td class="text-right">{{ e.amount_minor | money }}</td>
              </tr>
            }
            @if (items().length === 0) { <tr><td colspan="4" class="py-6 text-center text-slate-400">No expenses</td></tr> }
          </tbody>
        </table>
      </div>
      <app-paginator [total]="total()" [page]="pageNum" [pageSize]="20" (pageChange)="goPage($event)" />
    </div>
  `,
})
export class ExpensesComponent {
  private api = inject(Api);
  private toast = inject(Toast);
  cats = signal<ExpenseCat[]>([]);
  items = signal<Expense[]>([]);
  total = signal(0);
  pageNum = 1;
  form = { expense_category_id: 0, amount: 0, description: '' };

  constructor() {
    this.api.get<ExpenseCat[]>('/expenses/categories').subscribe((c) => { this.cats.set(c); if (c.length) this.form.expense_category_id = c[0].id; });
    this.load();
  }
  goPage(p: number) { this.pageNum = p; this.load(); }
  load() { this.api.getPage<Expense>('/expenses', { page: this.pageNum, pageSize: 20 }).subscribe((p: Page<Expense>) => { this.items.set(p.data); this.total.set(p.total); }); }
  add() {
    if (!this.form.amount) return;
    const today = new Date().toISOString().slice(0, 10);
    this.api.post('/expenses', {
      expense_category_id: Number(this.form.expense_category_id) || null,
      amount_minor: Math.round(Number(this.form.amount) * 100),
      description: this.form.description || null,
      date: today,
    }).subscribe({ next: () => { this.form.amount = 0; this.form.description = ''; this.toast.show('Expense recorded', 'success'); this.load(); } });
  }
}
