import type { DB } from '../db/connection';

export interface UnitOfWork {
  db: DB;
}

/**
 * Runs `work` inside a single SQLite transaction. Commits on success, rolls back on any
 * throw — so multi-table operations (checkout, purchase, return) are all-or-nothing.
 * node:sqlite has no nested transactions; do not call this re-entrantly on the same db.
 */
export function runInUnitOfWork<T>(db: DB, work: (uow: UnitOfWork) => T): T {
  db.exec('BEGIN');
  try {
    const result = work({ db });
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  }
}
