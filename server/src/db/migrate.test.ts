import { describe, it, expect } from 'vitest';
import { openDb } from './connection';
import { migrate, schemaVersion, latestSchemaVersion } from './migrate';
import { seed, PERMISSION_KEYS } from './seed';

describe('migrations & seed (first-run bootstrap)', () => {
  it('applies all migrations and is idempotent', () => {
    const db = openDb(':memory:');
    const first = migrate(db, {});
    expect(first.applied.length).toBeGreaterThan(0);
    expect(schemaVersion(db)).toBe(latestSchemaVersion());

    const second = migrate(db, {});
    expect(second.applied).toEqual([]); // nothing pending second time
  });

  it('seeds the full permission catalog, 3 system roles and a default admin', () => {
    const db = openDb(':memory:');
    migrate(db, {});
    seed(db);

    const perms = db.prepare('SELECT COUNT(*) c FROM permissions').get() as { c: number };
    expect(Number(perms.c)).toBe(PERMISSION_KEYS.length);

    const roles = db.prepare("SELECT name FROM roles WHERE is_system = 1").all() as { name: string }[];
    expect(roles.map((r) => r.name).sort()).toEqual(['admin', 'cashier', 'manager']);

    const admin = db.prepare("SELECT * FROM users WHERE username = 'admin'").get() as {
      must_change_password: number;
    };
    expect(admin).toBeTruthy();
    expect(admin.must_change_password).toBe(1);
  });

  it('seed is idempotent (re-running does not duplicate)', () => {
    const db = openDb(':memory:');
    migrate(db, {});
    seed(db);
    seed(db);
    const users = db.prepare("SELECT COUNT(*) c FROM users WHERE username = 'admin'").get() as { c: number };
    expect(Number(users.c)).toBe(1);
    const perms = db.prepare('SELECT COUNT(*) c FROM permissions').get() as { c: number };
    expect(Number(perms.c)).toBe(PERMISSION_KEYS.length);
  });
});
