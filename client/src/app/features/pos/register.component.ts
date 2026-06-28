import { AfterViewInit, Component, ElementRef, HostListener, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PosService } from './pos.service';
import { Api } from '../../core/api';
import { ReceiptService } from '../../core/receipt.service';
import { MoneyPipe } from '../../shared/money.pipe';
import { Toast } from '../../shared/toast';
import { InvoiceFinderComponent } from './invoice-finder.component';
import type { CartLine, Product } from '../../core/models';

interface Cart {
  id: number;
  lines: CartLine[];
}

interface QuoteLine {
  product_id: number;
  qty: number;
  line_total_minor: number;
  unit_price_minor: number;
}
interface QuoteResult {
  lines: QuoteLine[];
  subtotal_minor: number;
  tax_minor: number;
  total_minor: number;
}

const STORE_KEY = 'pos_carts';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, MoneyPipe, InvoiceFinderComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements AfterViewInit {
  finderOpen = signal(false);

  // F2 → open the invoice finder / refund dialog.
  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'F2') {
      e.preventDefault();
      this.finderOpen.set(true);
    } else if (e.key === 'F4') {
      // Void the last item in the active cart.
      e.preventDefault();
      if (!this.paying() && !this.finderOpen()) this.removeLast();
    } else if (e.key === 'Escape' && this.finderOpen()) {
      this.finderOpen.set(false);
    }
  }

  removeLast(): void {
    const lines = this.cart();
    if (lines.length) {
      this.remove(lines[lines.length - 1]);
      this.toast.show('Last item removed', 'info');
    }
    this.refocusScan();
  }

  private pos = inject(PosService);
  private api = inject(Api);
  private receipt = inject(ReceiptService);
  private toast = inject(Toast);
  @ViewChild('scan') scanInput?: ElementRef<HTMLInputElement>;

  settings = signal<Record<string, string>>({});

  scanCode = '';
  searchResults = signal<Product[]>([]);
  paying = signal(false);
  cashAmount = signal(0);
  payCustomer = { name: '', phone: '', email: '' };

  // Cart discount — fixed amount or percentage of the subtotal.
  discountMode = signal<'amount' | 'percent'>('amount');
  discountValue = signal(0);

  // Multiple parked carts shown as tabs (persisted so nothing is lost on reload/idle logout).
  carts = signal<Cart[]>(this.restore());
  activeId = signal<number>(this.carts()[0].id);
  private seq = Math.max(...this.carts().map((c) => c.id), 0);

  cart = computed(() => this.carts().find((c) => c.id === this.activeId())?.lines ?? []);

  // The cart is priced by the server (FIFO) via /sales/quote, so the on-screen totals and each
  // line exactly equal what the receipt will print. Falls back to the product price while loading.
  quote = signal<QuoteResult | null>(null);
  private quoteSeq = 0;
  private quoteTimer: ReturnType<typeof setTimeout> | null = null;

  subtotal = computed(() => this.quote()?.subtotal_minor ?? this.fallbackSubtotal());
  tax = computed(() => this.quote()?.tax_minor ?? 0);

  private fallbackSubtotal(): number {
    return this.cart().reduce((a, l) => a + (l.product.sale_price_minor ?? 0) * l.qty - l.discount_minor, 0);
  }

  /** FIFO line total for a cart row (from the server quote); falls back to product price. */
  lineTotal(l: CartLine): number {
    const q = this.quote()?.lines.find((x) => x.product_id === l.product.id);
    return q ? q.line_total_minor : (l.product.sale_price_minor ?? 0) * l.qty - l.discount_minor;
  }
  /** Effective per-unit price for the row (line total ÷ qty), so it reflects any FIFO batch split. */
  unitPrice(l: CartLine): number {
    return l.qty > 0 ? Math.round(this.lineTotal(l) / l.qty) : (l.product.sale_price_minor ?? 0);
  }

  private scheduleQuote(items: { product_id: number; qty: number; discount_minor: number }[]): void {
    if (this.quoteTimer) clearTimeout(this.quoteTimer);
    const seq = ++this.quoteSeq;
    this.quoteTimer = setTimeout(() => {
      if (!items.length) {
        this.quote.set(null);
        return;
      }
      this.api.post<QuoteResult>('/sales/quote', { items }).subscribe({
        next: (q) => {
          if (seq === this.quoteSeq) this.quote.set(q);
        },
        error: () => {
          /* keep the last quote; any real stock issue is enforced at checkout */
        },
      });
    }, 120);
  }
  discountMinor = computed(() => {
    const v = Number(this.discountValue()) || 0;
    if (v <= 0) return 0;
    if (this.discountMode() === 'percent') return Math.round((this.subtotal() * Math.min(100, v)) / 100);
    return Math.min(this.subtotal(), Math.round(v * 100));
  });
  total = computed(() => Math.max(0, this.subtotal() + this.tax() - this.discountMinor()));
  cashMinor = computed(() => Math.round((Number(this.cashAmount()) || 0) * 100));
  change = computed(() => Math.max(0, this.cashMinor() - this.total()));
  shortfall = computed(() => Math.max(0, this.total() - this.cashMinor()));
  isPaidEnough = computed(() => this.cashMinor() >= this.total());

  exactCash(): void { this.cashAmount.set(this.total() / 100); }
  addCash(note: number): void { this.cashAmount.set((Number(this.cashAmount()) || 0) + note); }
  clearCash(): void { this.cashAmount.set(0); }
  // Common note values (used as quick-tender buttons).
  notes = [50, 100, 500, 1000, 5000];

  private resetDiscount(): void {
    this.discountValue.set(0);
    this.discountMode.set('amount');
  }

  /** Keep the scanner field focused unless the user is in another field or a dialog is open. */
  refocusScan(): void {
    setTimeout(() => {
      if (this.paying() || this.finderOpen()) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      this.scanInput?.nativeElement.focus();
    }, 80);
  }

  constructor() {
    // Persist carts whenever they change.
    effect(() => localStorage.setItem(STORE_KEY, JSON.stringify(this.carts())));
    // Re-price the active cart on the server (FIFO) whenever it changes, debounced.
    effect(() => {
      const items = this.cart().map((l) => ({ product_id: l.product.id, qty: l.qty, discount_minor: l.discount_minor }));
      this.scheduleQuote(items);
    });
    this.api.get<Record<string, string>>('/settings').subscribe((s) => this.settings.set(s));
  }

  ngAfterViewInit(): void {
    this.refocusScan(); // ready to scan immediately, no manual click needed
  }

  private restore(): Cart[] {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
      if (Array.isArray(saved) && saved.length) return saved;
    } catch {
      /* ignore */
    }
    return [{ id: 1, lines: [] }];
  }

  private setActiveLines(updater: (lines: CartLine[]) => CartLine[]): void {
    this.carts.update((cs) => cs.map((c) => (c.id === this.activeId() ? { ...c, lines: updater(c.lines) } : c)));
  }

  // ── tabs ──
  tabLabel(c: Cart, i: number): string {
    const count = c.lines.reduce((a, l) => a + l.qty, 0);
    return `Sale ${i + 1}${count ? ` (${count})` : ''}`;
  }
  switchTo(id: number): void {
    this.activeId.set(id);
    this.resetDiscount();
    this.refocusScan();
  }
  newSale(): void {
    const id = ++this.seq;
    this.carts.update((cs) => [...cs, { id, lines: [] }]);
    this.activeId.set(id);
    this.resetDiscount();
    this.refocusScan();
  }
  closeCart(c: Cart, ev: Event): void {
    ev.stopPropagation();
    this.carts.update((cs) => cs.filter((x) => x.id !== c.id));
    if (this.carts().length === 0) this.newSale();
    else if (this.activeId() === c.id) this.activeId.set(this.carts()[0].id);
  }

  /** Resume a held/parked sale into a fresh POS tab, then remove the held record (restoring its stock). */
  onResume(saleId: number): void {
    this.finderOpen.set(false);
    this.api.get<any>(`/sales/${saleId}`).subscribe((sale) => {
      const items = sale.items ?? [];
      if (items.length === 0) return;
      forkJoin(items.map((it: any) => this.api.get<Product>(`/products/${it.product_id}`))).subscribe((prods: any) => {
        const lines: CartLine[] = (prods as Product[]).map((p, i) => ({ product: p, qty: items[i].qty, discount_minor: 0 }));
        const id = ++this.seq;
        this.carts.update((cs) => [...cs, { id, lines }]);
        this.activeId.set(id);
        this.api.delete(`/sales/${saleId}`).subscribe(); // free the held record + restore stock
        this.toast.show(`Resumed ${sale.invoice_no}`, 'success');
        this.scanInput?.nativeElement.focus();
      });
    });
  }

  // ── cart editing ──
  onScan(): void {
    const code = this.scanCode.trim();
    if (!code) return;
    this.pos.scan(code).subscribe({
      next: (p) => { this.addProduct(p); this.scanCode = ''; },
      error: () => { this.toast.show('No product for that barcode', 'error'); this.scanCode = ''; },
    });
  }
  onSearch(q: string): void {
    if (!q.trim()) { this.searchResults.set([]); return; }
    this.pos.search(q).subscribe((r) => this.searchResults.set(r));
  }
  addProduct(p: Product): void {
    if (p.sale_price_minor == null || p.stock <= 0) { this.toast.show(`${p.name} is out of stock`, 'error'); return; }
    const existing = this.cart().find((l) => l.product.id === p.id);
    if (existing) {
      if (existing.qty + 1 > p.stock) {
        this.toast.show(`Only ${p.stock} of "${p.name}" in stock`, 'error');
      } else {
        this.setActiveLines((lines) => lines.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)));
      }
    } else {
      this.setActiveLines((lines) => [...lines, { product: p, qty: 1, discount_minor: 0 }]);
    }
    this.searchResults.set([]);
    this.scanInput?.nativeElement.focus();
  }
  setQty(line: CartLine, qty: number): void {
    let q = Math.floor(Number(qty));
    // Ignore empty/invalid (e.g. mid-edit after backspace). Items are removed via ✕ only.
    if (!Number.isFinite(q) || q < 1) return;
    // Never let the cart quantity exceed what's in stock.
    const stock = line.product.stock ?? q;
    if (q > stock) {
      q = stock;
      this.toast.show(`Only ${stock} of "${line.product.name}" in stock`, 'error');
    }
    this.setActiveLines((lines) => lines.map((l) => (l.product.id === line.product.id ? { ...l, qty: q } : l)));
  }
  /** If the qty box is left empty, restore the stored quantity on blur. */
  onQtyBlur(line: CartLine, ev: Event): void {
    const el = ev.target as HTMLInputElement;
    if (!el.value || Number(el.value) < 1) el.value = String(line.qty);
  }
  remove(line: CartLine): void {
    this.setActiveLines((lines) => lines.filter((l) => l.product.id !== line.product.id));
  }

  // ── pay ──
  openPay(): void {
    if (this.cart().length === 0) return;
    this.cashAmount.set(this.total() / 100);
    this.payCustomer = { name: '', phone: '', email: '' };
    this.paying.set(true);
  }
  confirmPay(): void {
    if (!this.isPaidEnough()) { this.toast.show('Cash received is less than the total', 'error'); return; }
    const payload = {
      items: this.cart().map((l) => ({ product_id: l.product.id, qty: l.qty, discount_minor: l.discount_minor })),
      payments: [{ method: 'cash', amount_minor: this.cashMinor() }],
      customer: this.payCustomer,
      discount_minor: this.discountMinor(),
    };
    this.pos.checkout(payload).subscribe({
      next: (sale) => {
        this.toast.show(`Sale ${sale.invoice_no} completed`, 'success');
        this.receipt.print(sale, this.settings());
        // Close the paid cart; keep other parked tabs.
        const paidId = this.activeId();
        this.carts.update((cs) => cs.filter((c) => c.id !== paidId));
        if (this.carts().length === 0) this.newSale();
        else this.activeId.set(this.carts()[0].id);
        this.resetDiscount();
        this.paying.set(false);
        this.refocusScan();
      },
      error: () => this.paying.set(false),
    });
  }

}
