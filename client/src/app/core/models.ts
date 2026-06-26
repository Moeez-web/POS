export type LicenseState =
  | 'none'
  | 'ok'
  | 'payment_due'
  | 'blocked'
  | 'clock_tampered'
  | 'needs_connection'
  | 'suspended';

export interface LicenseStatus {
  state: LicenseState;
  accessUntil: number | null;
  graceDays: number | null;
  plan: string | null;
  installId: string;
}

export interface User {
  id: number;
  username: string;
  full_name: string | null;
  role_id: number;
  role: string | null;
  must_change_password: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
  permissions: string[];
}

export interface Page<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  unit_id: number | null;
  tax_rate: number;
  reorder_level: number;
  is_active: number;
  stock: number;
  barcodes: string[];
  sale_price_minor: number | null;
  purchase_price_minor?: number | null;
}

export interface SaleItem {
  id: number;
  product_id: number;
  batch_id: number | null;
  qty: number;
  unit_price_minor: number;
  cost_price_minor?: number;
  discount_minor: number;
  line_total_minor: number;
}

export interface Sale {
  id: number;
  invoice_no: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  paid_minor: number;
  change_minor: number;
  status: string;
  items: SaleItem[];
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
  is_system: number;
  permissions: string[];
}

export interface Permission {
  id: number;
  key: string;
  module: string;
  action: string;
}

export interface CartLine {
  product: Product;
  qty: number;
  discount_minor: number;
}
