import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';

export const reportsRouter = Router();
reportsRouter.use(authenticate);

function range(req: Request): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  return {
    from: (req.query.from as string) || today,
    to: (req.query.to as string) || today,
  };
}
// created_at is a full ISO timestamp; compare on the date prefix.
const dayLo = (d: string) => `${d}T00:00:00.000Z`;
const dayHi = (d: string) => `${d}T23:59:59.999Z`;

// Per sale_item, the qty/amount already refunded (correlated subqueries — no JOIN fan-out).
const RET_QTY = '(SELECT COALESCE(SUM(ri.qty),0) FROM return_items ri WHERE ri.sale_item_id = si.id)';
const RET_AMT = '(SELECT COALESCE(SUM(ri.amount_minor),0) FROM return_items ri WHERE ri.sale_item_id = si.id)';
// Completed and (partially) returned sales both count; refunds are then netted out.
const SALE_STATUS = "s.status IN ('completed','returned')";

reportsRouter.get('/daily', requirePermission('reports.daily.view'), (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const ownOnly = !req.user!.permissions.has('reports.sales.view');
  const args: unknown[] = [dayLo(date), dayHi(date)];
  if (ownOnly) args.push(req.user!.id);
  const summary = req.db
    .prepare(
      `SELECT COUNT(*) AS sales_count, COALESCE(SUM(total_minor),0) AS gross_total, COALESCE(SUM(tax_minor),0) AS tax_minor
       FROM sales WHERE status IN ('completed','returned') AND created_at BETWEEN ? AND ? ${ownOnly ? 'AND user_id = ?' : ''}`,
    )
    .get(...args) as { sales_count: number; gross_total: number; tax_minor: number };
  const refArgs: unknown[] = [dayLo(date), dayHi(date)];
  if (ownOnly) refArgs.push(req.user!.id);
  const refunds = (
    req.db
      .prepare(`SELECT COALESCE(SUM(total_minor),0) r FROM returns WHERE created_at BETWEEN ? AND ? ${ownOnly ? 'AND user_id = ?' : ''}`)
      .get(...refArgs) as { r: number }
  ).r;
  res.json({
    data: { date, sales_count: summary.sales_count, total_minor: summary.gross_total - Number(refunds), tax_minor: summary.tax_minor, refunds_minor: Number(refunds) },
  });
});

reportsRouter.get('/sales', requirePermission('reports.sales.view'), (req: Request, res: Response) => {
  const { from, to } = range(req);
  const by = (req.query.by as string) || 'product';
  const args = [dayLo(from), dayHi(to)];
  let rows;
  if (by === 'cashier') {
    rows = req.db
      .prepare(
        `SELECT u.username AS label, COUNT(DISTINCT s.id) AS sales_count,
                COALESCE(SUM(si.line_total_minor),0) - COALESCE(SUM(${RET_AMT}),0) AS total_minor
         FROM sales s JOIN sale_items si ON si.sale_id = s.id JOIN users u ON u.id = s.user_id
         WHERE ${SALE_STATUS} AND s.created_at BETWEEN ? AND ? GROUP BY s.user_id ORDER BY total_minor DESC`,
      )
      .all(...args);
  } else if (by === 'category') {
    rows = req.db
      .prepare(
        `SELECT COALESCE(c.name,'Uncategorized') AS label,
                SUM(si.qty) - COALESCE(SUM(${RET_QTY}),0) AS qty,
                COALESCE(SUM(si.line_total_minor),0) - COALESCE(SUM(${RET_AMT}),0) AS total_minor
         FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE ${SALE_STATUS} AND s.created_at BETWEEN ? AND ? GROUP BY p.category_id ORDER BY total_minor DESC`,
      )
      .all(...args);
  } else {
    rows = req.db
      .prepare(
        `SELECT p.name AS label,
                SUM(si.qty) - COALESCE(SUM(${RET_QTY}),0) AS qty,
                COALESCE(SUM(si.line_total_minor),0) - COALESCE(SUM(${RET_AMT}),0) AS total_minor
         FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
         WHERE ${SALE_STATUS} AND s.created_at BETWEEN ? AND ? GROUP BY si.product_id
         HAVING total_minor > 0 ORDER BY total_minor DESC`,
      )
      .all(...args);
  }
  res.json({ data: { from, to, by, rows } });
});

reportsRouter.get('/profit', requirePermission('reports.profit.view'), (req: Request, res: Response) => {
  const { from, to } = range(req);
  const args = [dayLo(from), dayHi(to)];
  // Revenue is the discounted sale value (subtotal − cart discount); cost comes from items.
  const sales = req.db
    .prepare(
      `SELECT COALESCE(SUM(subtotal_minor - discount_minor),0) AS revenue_minor, COUNT(*) AS sales_count
       FROM sales s WHERE ${SALE_STATUS} AND s.created_at BETWEEN ? AND ?`,
    )
    .get(...args) as { revenue_minor: number; sales_count: number };
  const cost_minor = (
    req.db
      .prepare(
        `SELECT COALESCE(SUM(si.cost_price_minor * si.qty),0) AS cost_minor
         FROM sale_items si JOIN sales s ON s.id = si.sale_id
         WHERE ${SALE_STATUS} AND s.created_at BETWEEN ? AND ?`,
      )
      .get(...args) as { cost_minor: number }
  ).cost_minor;
  const gross = { revenue_minor: sales.revenue_minor, cost_minor, sales_count: sales.sales_count };
  // Net out refunds (revenue and the cost of returned items).
  const ret = req.db
    .prepare(
      `SELECT COALESCE(SUM(ri.amount_minor),0) AS ret_rev, COALESCE(SUM(si.cost_price_minor * ri.qty),0) AS ret_cost
       FROM return_items ri JOIN returns r ON r.id = ri.return_id JOIN sale_items si ON si.id = ri.sale_item_id
       WHERE r.created_at BETWEEN ? AND ?`,
    )
    .get(dayLo(from), dayHi(to)) as { ret_rev: number; ret_cost: number };
  const revenue = gross.revenue_minor - ret.ret_rev;
  const cost = gross.cost_minor - ret.ret_cost;
  const expenses = (
    req.db.prepare('SELECT COALESCE(SUM(amount_minor),0) e FROM expenses WHERE date BETWEEN ? AND ?').get(from, to) as { e: number }
  ).e;
  const grossProfit = revenue - cost;
  res.json({
    data: {
      from,
      to,
      sales_count: gross.sales_count,
      revenue_minor: revenue,
      cost_minor: cost,
      gross_profit_minor: grossProfit,
      expenses_minor: Number(expenses),
      net_profit_minor: grossProfit - Number(expenses),
    },
  });
});

reportsRouter.get('/inventory-valuation', requirePermission('reports.inventory_valuation.view'), (req: Request, res: Response) => {
  const total = req.db
    .prepare(
      `SELECT COALESCE(SUM(b.qty_remaining * b.purchase_price_minor),0) AS valuation_minor, COALESCE(SUM(b.qty_remaining),0) AS units
       FROM batches b JOIN products p ON p.id = b.product_id WHERE p.is_active = 1`,
    )
    .get();
  res.json({ data: total });
});

reportsRouter.get('/expenses', requirePermission('reports.expenses.view'), (req: Request, res: Response) => {
  const { from, to } = range(req);
  const rows = req.db
    .prepare(
      `SELECT COALESCE(c.name,'Uncategorized') AS label, COALESCE(SUM(e.amount_minor),0) AS total_minor
       FROM expenses e LEFT JOIN expense_categories c ON c.id = e.expense_category_id
       WHERE e.date BETWEEN ? AND ? GROUP BY e.expense_category_id ORDER BY total_minor DESC`,
    )
    .all(from, to);
  res.json({ data: { from, to, rows } });
});

reportsRouter.get('/activity', requirePermission('reports.activity.view'), (req: Request, res: Response) => {
  const rows = req.db
    .prepare('SELECT a.*, u.username FROM activity_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 200')
    .all();
  res.json({ data: rows });
});
