import { describe, it, expect, beforeEach } from 'vitest';
import type { DB } from '../../db/connection';
import { makeTestDb } from '../../test/make-test-db';
import { login, me, changePassword } from './auth.service';
import { loadPermissions } from '../roles/roles.repo';
import { roleIdByName } from '../../test/make-test-db';

let db: DB;
beforeEach(() => {
  db = makeTestDb();
});

describe('auth.login', () => {
  it('logs in the seeded admin and returns a token + permissions', () => {
    const res = login(db, 'admin', 'admin123');
    expect(res.token).toBeTypeOf('string');
    expect(res.user.username).toBe('admin');
    expect(res.user.role).toBe('admin');
    expect(res.user.must_change_password).toBe(true);
    expect(res.permissions).toContain('settings.update');
  });

  it('rejects a wrong password', () => {
    expect(() => login(db, 'admin', 'wrong')).toThrowError(/Invalid username or password/);
  });

  it('rejects an unknown user', () => {
    expect(() => login(db, 'nobody', 'x')).toThrowError(/Invalid username or password/);
  });

  it('rejects an inactive user', () => {
    db.prepare("UPDATE users SET is_active = 0 WHERE username = 'admin'").run();
    expect(() => login(db, 'admin', 'admin123')).toThrowError(/Invalid/);
  });
});

describe('auth.changePassword', () => {
  it('changes the password and clears must_change_password', () => {
    changePassword(db, 1, 'admin123', 'newpass123');
    const u = db.prepare('SELECT must_change_password FROM users WHERE id = 1').get() as {
      must_change_password: number;
    };
    expect(u.must_change_password).toBe(0);
    expect(() => login(db, 'admin', 'admin123')).toThrow();
    expect(login(db, 'admin', 'newpass123').token).toBeTypeOf('string');
  });

  it('rejects a wrong current password', () => {
    expect(() => changePassword(db, 1, 'wrong', 'newpass123')).toThrowError(/incorrect/);
  });

  it('rejects a too-short new password', () => {
    expect(() => changePassword(db, 1, 'admin123', '123')).toThrowError(/at least 6/);
  });
});

describe('RBAC permission sets', () => {
  it('cashier role excludes cost/profit and management permissions', () => {
    const perms = loadPermissions(db, roleIdByName(db, 'cashier'));
    expect(perms.has('sales.create')).toBe(true);
    expect(perms.has('reports.profit.view')).toBe(false);
    expect(perms.has('users.create')).toBe(false);
    expect(perms.has('settings.update')).toBe(false);
  });

  it('manager role has business reports but not user/role management or audit', () => {
    const perms = loadPermissions(db, roleIdByName(db, 'manager'));
    expect(perms.has('reports.profit.view')).toBe(true);
    expect(perms.has('purchases.create')).toBe(true);
    expect(perms.has('users.create')).toBe(false);
    expect(perms.has('roles.create')).toBe(false);
    expect(perms.has('reports.activity.view')).toBe(false);
  });

  it('admin role has every permission', () => {
    const perms = loadPermissions(db, roleIdByName(db, 'admin'));
    const all = db.prepare('SELECT key FROM permissions').all() as { key: string }[];
    for (const { key } of all) expect(perms.has(key)).toBe(true);
  });

  it('me() returns the user and permission keys', () => {
    const out = me(db, 1);
    expect(out.user.username).toBe('admin');
    expect(out.permissions.length).toBeGreaterThan(10);
  });
});
