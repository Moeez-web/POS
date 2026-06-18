import { openDb, type DB } from '../db/connection';
import { migrate } from '../db/migrate';
import { seed } from '../db/seed';
import { hashPassword } from '../lib/password';

/** A fresh, fully migrated + seeded in-memory database. One per test for isolation. */
export function makeTestDb(): DB {
  const db = openDb(':memory:');
  migrate(db, {});
  seed(db);
  return db;
}

export function roleIdByName(db: DB, name: string): number {
  const row = db.prepare('SELECT id FROM roles WHERE name = ?').get(name) as { id: number };
  return Number(row.id);
}

/** Create a user with a known password for tests. Returns the user id. */
export function createTestUser(
  db: DB,
  username: string,
  password: string,
  roleName: string,
): number {
  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, full_name, role_id, is_active, must_change_password, created_at)
       VALUES (?, ?, ?, ?, 1, 0, ?)`,
    )
    .run(username, hashPassword(password), username, roleIdByName(db, roleName), now);
  return Number(info.lastInsertRowid);
}
