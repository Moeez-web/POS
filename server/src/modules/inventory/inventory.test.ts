import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { DB } from '../../db/connection';
import { createApp } from '../../app';
import { makeTestDb } from '../../test/make-test-db';

let db: DB;
let app: ReturnType<typeof createApp>;
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });

beforeEach(async () => {
  db = makeTestDb();
  app = createApp(db);
  token = (await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' })).body.data.token;
});

async function makeProduct(reorder: number, qty: number) {
  const p = (
    await request(app).post('/api/products').set(auth()).send({
      sku: `S${Math.floor(Math.random() * 1e9)}`, name: 'Item', reorder_level: reorder,
      sale_price_minor: 1000, cost_price_minor: 500, opening_qty: qty,
    })
  ).body.data;
  return p;
}

describe('inventory stock levels', () => {
  it('GET /inventory returns stock per product (paginated)', async () => {
    await makeProduct(5, 20);
    await makeProduct(5, 1);
    const res = await request(app).get('/api/inventory').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.data.every((r: any) => typeof r.stock === 'number')).toBe(true);
  });

  it('GET /inventory/low-stock returns only items at/below reorder level', async () => {
    await makeProduct(5, 20); // healthy
    await makeProduct(5, 2); // low
    const res = await request(app).get('/api/inventory/low-stock').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].stock).toBe(2);
  });

  it('a removed product frees its SKU + barcode so they can be re-added', async () => {
    const first = await request(app).post('/api/products').set(auth()).send({ sku: 'REUSE1', name: 'First', sale_price_minor: 1000, opening_qty: 1, barcodes: ['111222'] });
    expect(first.status).toBe(201);
    await request(app).delete(`/api/products/${first.body.data.id}`).set(auth());

    // Same SKU + same barcode should now work (not "already exists").
    const second = await request(app).post('/api/products').set(auth()).send({ sku: 'REUSE1', name: 'Second', sale_price_minor: 2000, opening_qty: 3, barcodes: ['111222'] });
    expect(second.status).toBe(201);
    expect(second.body.data.name).toBe('Second');

    // Scanning the barcode resolves the new product.
    const scan = await request(app).get('/api/products/barcode/111222').set(auth());
    expect(scan.body.data.name).toBe('Second');
  });

  it('a removed (deactivated) product disappears from inventory', async () => {
    const p = await makeProduct(0, 10);
    let res = await request(app).get('/api/inventory').set(auth());
    expect(res.body.total).toBe(1);
    await request(app).patch(`/api/products/${p.id}`).set(auth()).send({ is_active: 0 });
    res = await request(app).get('/api/inventory').set(auth());
    expect(res.body.total).toBe(0);
  });

  it('inventory & products can be searched by scanning a barcode', async () => {
    await request(app).post('/api/products').set(auth()).send({
      sku: 'SCAN1', name: 'Scannable', sale_price_minor: 1000, opening_qty: 5, barcodes: ['8901234'],
    });
    await request(app).post('/api/products').set(auth()).send({ sku: 'OTHER1', name: 'Other', sale_price_minor: 1000, opening_qty: 5 });

    const inv = await request(app).get('/api/inventory').query({ q: '8901234' }).set(auth());
    expect(inv.body.total).toBe(1);
    expect(inv.body.data[0].sku).toBe('SCAN1');

    const prod = await request(app).get('/api/products').query({ q: '8901234' }).set(auth());
    expect(prod.body.total).toBe(1);
    expect(prod.body.data[0].sku).toBe('SCAN1');
  });
});
