import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { MoneyPipe } from '../../shared/money.pipe';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import { Toast } from '../../shared/toast';
import type { Batch, Page, Product } from '../../core/models';

interface Ref { id: number; name: string }

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule, MoneyPipe, HasPermissionDirective, PaginatorComponent],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  page = signal<Page<Product> | null>(null);
  categories = signal<Ref[]>([]);
  units = signal<Ref[]>([]);
  q = '';
  pageNum = 1;
  loading = signal(true);

  // create
  creating = signal(false);
  skuTouched = false;
  form = { name: '', sku: '', category_id: null as number | null, unit_id: null as number | null, tax_rate: 0, reorder_level: 0, sale_price: 0, cost_price: 0, opening_qty: 0 };
  newBarcodes = signal<string[]>([]);
  scanNew = '';

  // edit / price / stock / barcodes
  editing = signal<Product | null>(null);
  editForm = { name: '', category_id: null as number | null, unit_id: null as number | null, tax_rate: 0, reorder_level: 0 };
  pricing = signal<Product | null>(null);
  newPrice = 0;
  stocking = signal<Product | null>(null);
  stockForm = { qty: 0, cost_price: 0, sale_price: 0 };
  managing = signal<Product | null>(null);
  scanManage = '';
  // batch breakdown (stock / sale price / cost per batch)
  viewingBatches = signal<Product | null>(null);
  batchList = signal<Batch[]>([]);
  batchesLoading = signal(false);

  constructor() {
    this.api.get<Ref[]>('/categories').subscribe((c) => this.categories.set(c));
    this.api.get<Ref[]>('/units').subscribe((u) => this.units.set(u));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPage<Product>('/products', { q: this.q, page: this.pageNum, pageSize: 20 }).subscribe((p) => {
      this.page.set(p);
      this.loading.set(false);
    });
  }
  search(): void { this.pageNum = 1; this.load(); }
  goPage(p: number): void { this.pageNum = p; this.load(); }

  // ── create ──
  openCreate(): void {
    this.form = { name: '', sku: '', category_id: null, unit_id: null, tax_rate: 0, reorder_level: 0, sale_price: 0, cost_price: 0, opening_qty: 0 };
    this.newBarcodes.set([]);
    this.scanNew = '';
    this.skuTouched = false;
    this.creating.set(true);
  }
  onName(): void {
    if (!this.skuTouched) {
      this.form.sku = this.form.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
    }
  }
  addScannedBarcode(): void {
    const code = this.scanNew.trim();
    if (code && !this.newBarcodes().includes(code)) this.newBarcodes.update((b) => [...b, code]);
    this.scanNew = '';
  }
  removeNewBarcode(code: string): void { this.newBarcodes.update((b) => b.filter((c) => c !== code)); }

  saveCreate(): void {
    if (!this.form.name.trim() || !this.form.sku.trim()) { this.toast.show('Name and SKU are required', 'error'); return; }
    if (this.form.sale_price <= 0) { this.toast.show('Enter a sale price', 'error'); return; }
    const body: any = {
      sku: this.form.sku.trim(), name: this.form.name.trim(),
      category_id: this.form.category_id || null, unit_id: this.form.unit_id || null,
      tax_rate: Number(this.form.tax_rate), reorder_level: Number(this.form.reorder_level),
      sale_price_minor: Math.round(this.form.sale_price * 100),
      cost_price_minor: Math.round(this.form.cost_price * 100),
      opening_qty: Number(this.form.opening_qty) || 0,
    };
    if (this.newBarcodes().length) body.barcodes = this.newBarcodes();
    this.api.post('/products', body).subscribe({
      next: () => { this.toast.show('Product added', 'success'); this.creating.set(false); this.load(); },
    });
  }

  // ── edit basic info ──
  openEdit(p: Product): void {
    this.editing.set(p);
    this.editForm = { name: p.name, category_id: p.category_id, unit_id: p.unit_id, tax_rate: p.tax_rate, reorder_level: p.reorder_level };
  }
  saveEdit(): void {
    const p = this.editing();
    if (!p) return;
    this.api.patch(`/products/${p.id}`, { ...this.editForm, tax_rate: Number(this.editForm.tax_rate), reorder_level: Number(this.editForm.reorder_level) }).subscribe({
      next: () => { this.toast.show('Product updated', 'success'); this.editing.set(null); this.load(); },
    });
  }

  // ── price ──
  openPrice(p: Product): void { this.pricing.set(p); this.newPrice = (p.sale_price_minor ?? 0) / 100; }
  savePrice(): void {
    const p = this.pricing();
    if (!p) return;
    this.api.patch(`/products/${p.id}/price`, { sale_price_minor: Math.round(this.newPrice * 100) }).subscribe({
      next: () => { this.toast.show('Price updated', 'success'); this.pricing.set(null); this.load(); },
    });
  }

  // ── add stock ──
  openStock(p: Product): void { this.stocking.set(p); this.stockForm = { qty: 0, cost_price: (p.purchase_price_minor ?? 0) / 100, sale_price: (p.sale_price_minor ?? 0) / 100 }; }
  saveStock(): void {
    const p = this.stocking();
    if (!p || this.stockForm.qty <= 0) { this.toast.show('Enter a quantity', 'error'); return; }
    this.api.post(`/products/${p.id}/stock`, {
      qty: Number(this.stockForm.qty),
      cost_price_minor: Math.round(this.stockForm.cost_price * 100),
      sale_price_minor: Math.round(this.stockForm.sale_price * 100),
    }).subscribe({ next: () => { this.toast.show('Stock added', 'success'); this.stocking.set(null); this.load(); } });
  }

  // ── remove (soft-delete, frees SKU + barcodes) ──
  deactivate(p: Product): void {
    this.api.delete(`/products/${p.id}`).subscribe({ next: () => { this.toast.show('Product removed', 'success'); this.load(); } });
  }

  // ── batch breakdown ──
  openBatches(p: Product): void {
    this.viewingBatches.set(p);
    this.batchList.set([]);
    this.batchesLoading.set(true);
    this.api.get<Batch[]>(`/products/${p.id}/batches`).subscribe({
      next: (b) => { this.batchList.set(b); this.batchesLoading.set(false); },
      error: () => this.batchesLoading.set(false),
    });
  }

  // ── barcodes ──
  openManage(p: Product): void { this.managing.set(p); this.scanManage = ''; }
  addBarcodeToProduct(): void {
    const p = this.managing();
    const code = this.scanManage.trim();
    if (!p || !code) return;
    this.api.post<Product>(`/products/${p.id}/barcodes`, { barcode: code }).subscribe({
      next: (updated) => { this.managing.set(updated); this.scanManage = ''; this.toast.show('Barcode added', 'success'); this.load(); },
    });
  }
}
