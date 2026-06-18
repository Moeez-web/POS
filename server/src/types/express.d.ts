import type { DB } from '../db/connection';
import type { Pagination } from '../lib/pagination';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string | null;
  role_id: number;
  is_active: number;
  must_change_password: number;
  permissions: Set<string>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      db: DB;
      user?: AuthUser;
      pagination?: Pagination;
    }
  }
}

export {};
