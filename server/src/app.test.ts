import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { DB } from './db/connection';
import { createApp } from './app';
import { makeTestDb, createTestUser } from './test/make-test-db';

let db: DB;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = makeTestDb();
  app = createApp(db);
});

async function tokenFor(username: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.data.token;
}

describe('health & auth endpoints', () => {
  it('GET /api/health → 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });

  it('POST /api/auth/login with bad body → 400 validation', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('POST /api/auth/login admin → 200 + token', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTypeOf('string');
  });
});

describe('RBAC enforcement on endpoints', () => {
  it('GET /api/users without a token → 401', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('admin can list users (paginated envelope)', async () => {
    const token = await tokenFor('admin', 'admin123');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('pageSize');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('cashier is forbidden from listing users → 403', async () => {
    createTestUser(db, 'cash1', 'cashpass', 'cashier');
    const token = await tokenFor('cash1', 'cashpass');
    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('admin can create a user; duplicate username → 409', async () => {
    const token = await tokenFor('admin', 'admin123');
    const role = (db.prepare("SELECT id FROM roles WHERE name='cashier'").get() as { id: number }).id;

    const create = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newcashier', password: 'secret1', full_name: 'New', role_id: role });
    expect(create.status).toBe(201);
    expect(create.body.data.username).toBe('newcashier');

    const dup = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'newcashier', password: 'secret1', role_id: role });
    expect(dup.status).toBe(409);
  });
});

describe('roles RBAC management', () => {
  it('admin reads the permission catalog and creates a custom role', async () => {
    const token = await tokenFor('admin', 'admin123');

    const cat = await request(app).get('/api/roles/permissions').set('Authorization', `Bearer ${token}`);
    expect(cat.status).toBe(200);
    expect(cat.body.data.length).toBeGreaterThan(10);

    const created = await request(app)
      .post('/api/roles')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Stock Clerk', description: 'inventory only', permission_keys: ['products.read', 'inventory.read'] });
    expect(created.status).toBe(201);
    expect(created.body.data.permissions.sort()).toEqual(['inventory.read', 'products.read']);
  });

  it('a system role cannot be deleted → 403', async () => {
    const token = await tokenFor('admin', 'admin123');
    const cashierId = (db.prepare("SELECT id FROM roles WHERE name='cashier'").get() as { id: number }).id;
    const res = await request(app).delete(`/api/roles/${cashierId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
