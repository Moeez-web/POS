import { Injectable, inject } from '@angular/core';
import { Api } from '../../core/api';
import type { Product, Sale } from '../../core/models';

export interface CheckoutPayload {
  items: { product_id: number; qty: number; discount_minor?: number; batch_id?: number | null }[];
  payments?: { method: string; amount_minor: number }[];
  discount_minor?: number;
  customer_id?: number | null;
  customer?: { name?: string; phone?: string; email?: string } | null;
}

@Injectable({ providedIn: 'root' })
export class PosService {
  private api = inject(Api);

  scan(code: string) {
    return this.api.get<Product>(`/products/barcode/${encodeURIComponent(code)}`);
  }

  search(q: string) {
    return this.api.get<Product[]>('/products/search', { q });
  }

  checkout(payload: CheckoutPayload) {
    return this.api.post<Sale>('/sales', payload);
  }

  hold(payload: CheckoutPayload) {
    return this.api.post<Sale>('/sales/hold', payload);
  }
}
