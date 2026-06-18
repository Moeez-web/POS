import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';

interface Ref { id: number; name: string; short_name?: string }

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective],
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  tab = signal<'general' | 'categories' | 'units'>('general');

  // All settings (bound by both the General and Receipt tabs).
  s = {
    shop_name: '', shop_address: '', shop_phone: '', currency: '',
    receipt_paper_width: '80', receipt_header: '', receipt_footer: '',
    batch_selection_strategy: 'fifo', idle_logout_minutes: '10',
  };

  // A sample sale used to render the live receipt preview.
  sample = {
    invoice_no: 'INV-000123',
    items: [
      { name: 'Coca Cola 500ml', qty: 2, price: 70, amount: 140 },
      { name: 'Lays Chips', qty: 1, price: 50, amount: 50 },
    ],
    subtotal: 190, tax: 0, total: 190, cash: 200, change: 10,
  };

  now = new Date().toLocaleString();

  // Reference data
  categories = signal<Ref[]>([]);
  expenseCats = signal<Ref[]>([]);
  units = signal<Ref[]>([]);
  newCategory = '';
  newExpenseCat = '';
  newUnit = { name: '', short_name: '' };

  constructor() {
    this.api.get<Record<string, string>>('/settings').subscribe((v) => (this.s = { ...this.s, ...v }));
    this.loadCategories();
    this.loadExpenseCats();
    this.loadUnits();
  }

  saveGeneral() {
    this.api.put('/settings', this.s).subscribe({ next: () => this.toast.show('Settings saved', 'success') });
  }

  // Product categories
  loadCategories() { this.api.get<Ref[]>('/categories').subscribe((c) => this.categories.set(c)); }
  addCategory() {
    if (!this.newCategory.trim()) return;
    this.api.post('/categories', { name: this.newCategory.trim() }).subscribe({ next: () => { this.newCategory = ''; this.toast.show('Category added', 'success'); this.loadCategories(); } });
  }
  deleteCategory(id: number) { this.api.delete(`/categories/${id}`).subscribe({ next: () => this.loadCategories() }); }

  // Expense categories
  loadExpenseCats() { this.api.get<Ref[]>('/expenses/categories').subscribe((c) => this.expenseCats.set(c)); }
  addExpenseCat() {
    if (!this.newExpenseCat.trim()) return;
    this.api.post('/expenses/categories', { name: this.newExpenseCat.trim() }).subscribe({ next: () => { this.newExpenseCat = ''; this.toast.show('Expense category added', 'success'); this.loadExpenseCats(); } });
  }
  deleteExpenseCat(id: number) { this.api.delete(`/expenses/categories/${id}`).subscribe({ next: () => this.loadExpenseCats() }); }

  // Units
  loadUnits() { this.api.get<Ref[]>('/units').subscribe((u) => this.units.set(u)); }
  addUnit() {
    if (!this.newUnit.name.trim() || !this.newUnit.short_name.trim()) { this.toast.show('Enter unit name and short form', 'error'); return; }
    this.api.post('/units', { name: this.newUnit.name.trim(), short_name: this.newUnit.short_name.trim() }).subscribe({ next: () => { this.newUnit = { name: '', short_name: '' }; this.toast.show('Unit added', 'success'); this.loadUnits(); } });
  }
  deleteUnit(id: number) { this.api.delete(`/units/${id}`).subscribe({ next: () => { this.toast.show('Unit removed', 'success'); this.loadUnits(); } }); }
}
