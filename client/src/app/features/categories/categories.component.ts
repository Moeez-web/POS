import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

interface Category { id: number; name: string }

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective],
  template: `
    <div class="max-w-xl space-y-4">
      <h1 class="text-2xl font-semibold">Categories</h1>
      <div *appHasPermission="'categories.create'" class="card flex gap-2 p-4">
        <input class="input" placeholder="New category name" [(ngModel)]="name" (keyup.enter)="add()" data-testid="cat-name" />
        <button class="btn-primary" (click)="add()" data-testid="cat-add">Add</button>
      </div>
      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>Name</th></tr></thead>
          <tbody>
            @for (c of items(); track c.id) { <tr data-testid="cat-row"><td>{{ c.name }}</td></tr> }
            @if (items().length === 0) { <tr><td class="py-6 text-center text-slate-400">No categories</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CategoriesComponent {
  private api = inject(Api);
  private toast = inject(Toast);
  items = signal<Category[]>([]);
  name = '';
  constructor() { this.load(); }
  load() { this.api.get<Category[]>('/categories').subscribe((c) => this.items.set(c)); }
  add() {
    if (!this.name.trim()) return;
    this.api.post('/categories', { name: this.name.trim() }).subscribe({ next: () => { this.name = ''; this.toast.show('Category added', 'success'); this.load(); } });
  }
}
