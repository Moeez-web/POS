export interface Pagination {
  page: number;
  pageSize: number;
  offset: number;
  sort?: string;
  order: 'asc' | 'desc';
  q?: string;
  from?: string;
  to?: string;
}

export interface PageEnvelope<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    sort: typeof query.sort === 'string' ? query.sort : undefined,
    order: query.order === 'desc' ? 'desc' : 'asc',
    q: typeof query.q === 'string' && query.q.trim() ? query.q.trim() : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
  };
}

export function pageEnvelope<T>(data: T[], total: number, p: Pagination): PageEnvelope<T> {
  return { data, total, page: p.page, pageSize: p.pageSize };
}

/** Whitelist a sort column to avoid SQL injection via the `sort` param. */
export function safeSort(sort: string | undefined, allowed: string[], fallback: string): string {
  return sort && allowed.includes(sort) ? sort : fallback;
}
