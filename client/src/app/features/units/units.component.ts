import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

interface Unit { id: number; name: string; short_name: string }

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective],
  template: `
    <div class="max-w-xl space-y-4">
      <h1 class="text-2xl font-semibold">Units</h1>
      <div *appHasPermission="'units.create'" class="card flex gap-2 p-4">
        <input class="input" placeholder="Name (e.g. Kilogram)" [(ngModel)]="name" data-testid="unit-name" />
        <input class="input max-w-[120px]" placeholder="Short (kg)" [(ngModel)]="short" data-testid="unit-short" />
        <button class="btn-primary" (click)="add()" data-testid="unit-add">Add</button>
      </div>
      <div class="card overflow-hidden">
        <table class="table">
          <thead><tr><th>Name</th><th>Short</th></tr></thead>
          <tbody>
            @for (u of items(); track u.id) { <tr data-testid="unit-row"><td>{{ u.name }}</td><td>{{ u.short_name }}</td></tr> }
            @if (items().length === 0) { <tr><td colspan="2" class="py-6 text-center text-slate-400">No units</td></tr> }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class UnitsComponent {
  private api = inject(Api);
  private toast = inject(Toast);
  items = signal<Unit[]>([]);
  name = '';
  short = '';
  constructor() { this.load(); }
  load() { this.api.get<Unit[]>('/units').subscribe((u) => this.items.set(u)); }
  add() {
    if (!this.name.trim() || !this.short.trim()) return;
    this.api.post('/units', { name: this.name.trim(), short_name: this.short.trim() }).subscribe({ next: () => { this.name = ''; this.short = ''; this.toast.show('Unit added', 'success'); this.load(); } });
  }
}
