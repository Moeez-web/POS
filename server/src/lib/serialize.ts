/**
 * Strips cost/profit fields from API responses unless the caller holds `reports.profit.view`.
 * Protects cost data on product/batch/checkout responses, not just reports (docs/02).
 */
const COST_KEYS = [
  'purchase_price_minor',
  'cost_price_minor',
  'cost_minor',
  'profit_minor',
  'gross_profit_minor',
  'net_profit_minor',
  'margin',
];

export const PROFIT_PERMISSION = 'reports.profit.view';

function stripOne<T extends Record<string, unknown>>(obj: T): T {
  const copy = { ...obj };
  for (const k of COST_KEYS) delete copy[k];
  return copy;
}

export function stripCost<T>(value: T, permissions: Set<string>): T {
  if (permissions.has(PROFIT_PERMISSION)) return value;
  if (Array.isArray(value)) {
    return value.map((v) =>
      v && typeof v === 'object' ? stripOne(v as Record<string, unknown>) : v,
    ) as unknown as T;
  }
  if (value && typeof value === 'object') {
    return stripOne(value as Record<string, unknown>) as unknown as T;
  }
  return value;
}
