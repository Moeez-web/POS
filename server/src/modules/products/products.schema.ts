import { z } from 'zod';

export const createProductSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(150),
  category_id: z.number().int().positive().optional().nullable(),
  unit_id: z.number().int().positive().optional().nullable(),
  tax_rate: z.number().min(0).max(100).default(0),
  reorder_level: z.number().int().min(0).default(0),
  barcodes: z.array(z.string().trim().min(1)).optional(),
  // Opening price + stock (creates the first batch in the same call).
  sale_price_minor: z.number().int().min(0).optional(),
  cost_price_minor: z.number().int().min(0).optional(),
  opening_qty: z.number().int().min(0).optional(),
});

export const setPriceSchema = z.object({
  sale_price_minor: z.number().int().min(0),
});

export const addStockSchema = z.object({
  qty: z.number().int().positive(),
  cost_price_minor: z.number().int().min(0),
  sale_price_minor: z.number().int().min(0),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  category_id: z.number().int().positive().optional().nullable(),
  unit_id: z.number().int().positive().optional().nullable(),
  tax_rate: z.number().min(0).max(100).optional(),
  reorder_level: z.number().int().min(0).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
});

export const barcodeSchema = z.object({ barcode: z.string().trim().min(1).max(60) });
