import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { DB } from '../../db/connection';
import { createApp } from '../../app';
import { makeTestDb, createTestUser } from '../../test/make-test-db';

let db: DB;
let app: ReturnType<typeof createApp>;
let adminToken: string;

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
async function login(u: string, p: string) {
  return (await request(app).post('/api/auth/login').send({ username: u, password: p })).body.data.token as string;
}

beforeEach(async () => {
  db = makeTestDb();
  app = createApp(db);
  adminToken = await login('admin', 'admin123');
});

async function productWithStock(qty: number, cost: number, sale: number): Promise<number> {
  const p = (
    await request(app).post('/api/products').set(auth(adminToken)).send({ sku: `S${Math.floor(Math.random() * 1e9)}`, name: 'P' })
  ).body.data.id;
  await request(app).post('/api/purchases').set(auth(adminToken)).send({ items: [{ product_id: p, qty, purchase_price_minor: cost, sale_price_minor: sale }] });
  return p;
}

describe('returns — restock & refund', () => {
  it('restocks the batch and records the refund total', async () => {
    const p = await productWithStock(5, 100, 150);
    const sale = (
      await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 3 }], payments: [{ method: 'cash', amount_minor: 450 }] })
    ).body.data;
    const saleItemId = sale.items[0].id;

    const ret = await request(app)
      .post('/api/returns')
      .set(auth(adminToken))
      .send({ original_sale_id: sale.id, reason: 'damaged', items: [{ sale_item_id: saleItemId, qty: 2 }] });

    expect(ret.status).toBe(201);
    expect(ret.body.data.total_minor).toBe(2 * 150);
    const stock = (db.prepare('SELECT qty_remaining FROM batches WHERE product_id = ?').get(p) as any).qty_remaining;
    expect(stock).toBe(5 - 3 + 2); // sold 3, returned 2

    const over = await request(app)
      .post('/api/returns')
      .set(auth(adminToken))
      .send({ original_sale_id: sale.id, items: [{ sale_item_id: saleItemId, qty: 5 }] });
    expect(over.status).toBe(409); // can't return more than sold
  });
});

describe('reports — profit (gross & net of expenses) is permission-gated', () => {
  it('computes gross profit, subtracts expenses for net profit', async () => {
    const p = await productWithStock(10, 100, 150);
    await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 4 }], payments: [{ method: 'cash', amount_minor: 600 }] });
    // revenue 4*150=600, cost 4*100=400, gross=200
    const today = new Date().toISOString().slice(0, 10);
    await request(app).post('/api/expenses').set(auth(adminToken)).send({ amount_minor: 50, description: 'bag', date: today });

    const rep = await request(app).get('/api/reports/profit').set(auth(adminToken));
    expect(rep.status).toBe(200);
    expect(rep.body.data.gross_profit_minor).toBe(200);
    expect(rep.body.data.expenses_minor).toBe(50);
    expect(rep.body.data.net_profit_minor).toBe(150);
  });

  it('nets refunds out of profit and goes negative (loss) when expenses exceed it', async () => {
    const p = await productWithStock(10, 10000, 15000);
    const sale = (
      await request(app).post('/api/sales').set(auth(adminToken)).send({ items: [{ product_id: p, qty: 4 }], payments: [{ method: 'cash', amount_minor: 60000 }] })
    ).body.data;
    const today = new Date().toISOString().slice(0, 10);
    await request(app).post('/api/expenses').set(auth(adminToken)).send({ amount_minor: 25000, description: 'rent', date: today });
    // gross 20000 - expenses 25000 = -5000 (loss)
    let rep = (await request(app).get('/api/reports/profit').query({ from: today, to: today }).set(auth(adminToken))).body.data;
    expect(rep.gross_profit_minor).toBe(20000);
    expect(rep.net_profit_minor).toBe(-5000);

    // Refund 1 unit → revenue -15000, cost -10000 → gross 15000, net -10000
    await request(app).post('/api/returns').set(auth(adminToken)).send({ original_sale_id: sale.id, items: [{ sale_item_id: sale.items[0].id, qty: 1 }] });
    rep = (await request(app).get('/api/reports/profit').query({ from: today, to: today }).set(auth(adminToken))).body.data;
    expect(rep.revenue_minor).toBe(45000);
    expect(rep.gross_profit_minor).toBe(15000);
    expect(rep.net_profit_minor).toBe(-10000);
  });

  it('forbids a cashier from the profit report (403)', async () => {
    createTestUser(db, 'cash1', 'cashpass', 'cashier');
    const cashToken = await login('cash1', 'cashpass');
    const rep = await request(app).get('/api/reports/profit').set(auth(cashToken));
    expect(rep.status).toBe(403);
  });
});
