import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { DB } from '../../db/connection';
import { createApp } from '../../app';
import { makeTestDb, createTestUser } from '../../test/make-test-db';

let db: DB;
let app: ReturnType<typeof createApp>;
let adminToken: string;

async function login(username: string, password: string) {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  return res.body.data.token as string;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function makeProduct(taxRate = 0): Promise<number> {
  const res = await request(app)
    .post('/api/products')
    .set(auth(adminToken))
    .send({ sku: `SKU-${Math.floor(Math.random() * 1e9)}`, name: 'Widget', tax_rate: taxRate });
  return res.body.data.id;
}

async function purchase(productId: number, qty: number, cost: number, sale: number) {
  return request(app)
    .post('/api/purchases')
    .set(auth(adminToken))
    .send({ items: [{ product_id: productId, qty, purchase_price_minor: cost, sale_price_minor: sale }] });
}

async function setStrategy(strategy: string) {
  return request(app).put('/api/settings').set(auth(adminToken)).send({ batch_selection_strategy: strategy });
}

beforeEach(async () => {
  db = makeTestDb();
  app = createApp(db);
  adminToken = await login('admin', 'admin123');
});

describe('checkout — FIFO batch deduction & per-batch cost snapshot', () => {
  it('splits a line across two batches, snapshots each batch cost, decrements stock', async () => {
    const p = await makeProduct();
    await purchase(p, 3, 100, 150); // batch A: cost 100, price 150
    await purchase(p, 5, 120, 180); // batch B: cost 120, price 180

    const res = await request(app)
      .post('/api/sales')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 4 }], payments: [{ method: 'cash', amount_minor: 70000 }] });

    expect(res.status).toBe(201);
    const sale = res.body.data;
    expect(sale.items).toHaveLength(2);

    const a = sale.items.find((i: any) => i.cost_price_minor === 100);
    const b = sale.items.find((i: any) => i.cost_price_minor === 120);
    expect(a.qty).toBe(3);
    expect(b.qty).toBe(1);
    // FIFO pricing: each slice charged its own batch's price (A=150, B=180), cost per batch.
    expect(a.unit_price_minor).toBe(150);
    expect(b.unit_price_minor).toBe(180);

    expect(sale.subtotal_minor).toBe(3 * 150 + 1 * 180); // 630
    expect(sale.total_minor).toBe(630);
    expect(sale.change_minor).toBe(70000 - 630);

    const stock = db.prepare('SELECT id, qty_remaining FROM batches WHERE product_id = ? ORDER BY id').all(p) as any[];
    expect(stock[0].qty_remaining).toBe(0); // batch A drained
    expect(stock[1].qty_remaining).toBe(4); // batch B 5 - 1
  });

  it('quote prices the cart by FIFO (matches checkout) without selling', async () => {
    const p = await makeProduct();
    await purchase(p, 3, 100, 150); // batch A
    await purchase(p, 5, 120, 180); // batch B

    const q = await request(app)
      .post('/api/sales/quote')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 4 }] });

    expect(q.status).toBe(200);
    expect(q.body.data.subtotal_minor).toBe(3 * 150 + 1 * 180); // 630 — same FIFO total the receipt will show
    expect(q.body.data.lines[0].line_total_minor).toBe(630);

    // read-only: stock untouched
    const left = db.prepare('SELECT COALESCE(SUM(qty_remaining),0) s FROM batches WHERE product_id = ?').get(p) as any;
    expect(Number(left.s)).toBe(8);
  });

  it('rejects selling more than total stock with 409 and rolls back (no stock change)', async () => {
    const p = await makeProduct();
    await purchase(p, 3, 100, 150);

    const res = await request(app)
      .post('/api/sales')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 99 }], payments: [{ method: 'cash', amount_minor: 1000000 }] });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');

    const stock = db.prepare('SELECT qty_remaining FROM batches WHERE product_id = ?').get(p) as any;
    expect(stock.qty_remaining).toBe(3); // untouched — transaction rolled back
    const sales = db.prepare('SELECT COUNT(*) c FROM sales').get() as any;
    expect(Number(sales.c)).toBe(0); // no sale row persisted
  });
});

describe('checkout — batch selection strategies (admin setting)', () => {
  it('latest: charges the newest batch price but still deducts FIFO + snapshots real costs', async () => {
    const p = await makeProduct();
    await purchase(p, 5, 100, 150); // batch C (older)
    await purchase(p, 5, 110, 200); // batch D (newer)
    await setStrategy('latest');

    const res = await request(app)
      .post('/api/sales')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 6 }], payments: [{ method: 'cash', amount_minor: 2000 }] });

    expect(res.status).toBe(201);
    const sale = res.body.data;
    // every slice charged at the latest price (200)
    for (const it of sale.items) expect(it.unit_price_minor).toBe(200);
    // but costs reflect each real batch
    expect(sale.items.map((i: any) => i.cost_price_minor).sort()).toEqual([100, 110]);
    expect(sale.subtotal_minor).toBe(6 * 200);
  });

  it('cashier: requires a batch_id (400) and deducts the chosen batch', async () => {
    const p = await makeProduct();
    const purA = await purchase(p, 5, 100, 150);
    const purB = await purchase(p, 5, 120, 180);
    void purA;
    const batchBId = (db.prepare('SELECT id FROM batches WHERE product_id = ? ORDER BY id DESC LIMIT 1').get(p) as any).id;
    await setStrategy('cashier');

    const missing = await request(app)
      .post('/api/sales')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 1 }], payments: [{ method: 'cash', amount_minor: 1000 }] });
    expect(missing.status).toBe(400);

    const ok = await request(app)
      .post('/api/sales')
      .set(auth(adminToken))
      .send({ items: [{ product_id: p, qty: 2, batch_id: batchBId }], payments: [{ method: 'cash', amount_minor: 1000 }] });
    expect(ok.status).toBe(201);
    expect(ok.body.data.items[0].unit_price_minor).toBe(180); // batch B's price
    const remB = (db.prepare('SELECT qty_remaining FROM batches WHERE id = ?').get(batchBId) as any).qty_remaining;
    expect(remB).toBe(3);
    void purB;
  });
});

describe('deleting an invoice restocks its products', () => {
  it('restores stock when a sale is deleted', async () => {
    const p = await makeProduct();
    await purchase(p, 10, 100, 150);
    const sale = (
      await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 4 }], payments: [{ method: 'cash', amount_minor: 600 }] })
    ).body.data;
    expect((db.prepare('SELECT SUM(qty_remaining) s FROM batches WHERE product_id=?').get(p) as any).s).toBe(6);

    const del = await request(app).delete(`/api/sales/${sale.id}`).set(auth(adminToken));
    expect(del.status).toBe(200);
    expect((db.prepare('SELECT SUM(qty_remaining) s FROM batches WHERE product_id=?').get(p) as any).s).toBe(10); // fully restocked
    expect((db.prepare('SELECT COUNT(*) c FROM sales').get() as any).c).toBe(0);
  });

  it('a cashier (no sales.delete permission) cannot delete an invoice (403)', async () => {
    const p = await makeProduct();
    await purchase(p, 10, 100, 150);
    const sale = (
      await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 1 }], payments: [{ method: 'cash', amount_minor: 150 }] })
    ).body.data;
    createTestUser(db, 'cash9', 'cashpass', 'cashier');
    const cashToken = await login('cash9', 'cashpass');
    const del = await request(app).delete(`/api/sales/${sale.id}`).set(auth(cashToken));
    expect(del.status).toBe(403);
  });

  it('refuses to delete an invoice that already has a refund (409)', async () => {
    const p = await makeProduct();
    await purchase(p, 10, 100, 150);
    const sale = (
      await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 4 }], payments: [{ method: 'cash', amount_minor: 600 }] })
    ).body.data;
    await request(app).post('/api/returns').set(auth(adminToken)).send({ original_sale_id: sale.id, items: [{ sale_item_id: sale.items[0].id, qty: 1 }] });

    const del = await request(app).delete(`/api/sales/${sale.id}`).set(auth(adminToken));
    expect(del.status).toBe(409);
  });
});

describe('RBAC — cashier never sees cost/profit', () => {
  it('strips cost fields from product and sale responses for a cashier', async () => {
    const p = await makeProduct();
    await purchase(p, 5, 100, 150);
    createTestUser(db, 'cash1', 'cashpass', 'cashier');
    const cashToken = await login('cash1', 'cashpass');

    const prod = await request(app).get(`/api/products/${p}`).set(auth(cashToken));
    expect(prod.status).toBe(200);
    expect(prod.body.data).not.toHaveProperty('purchase_price_minor');

    const sale = await request(app)
      .post('/api/sales')
      .set(auth(cashToken))
      .send({ items: [{ product_id: p, qty: 1 }], payments: [{ method: 'cash', amount_minor: 150 }] });
    expect(sale.status).toBe(201);
    expect(sale.body.data.items[0]).not.toHaveProperty('cost_price_minor');
  });
});
