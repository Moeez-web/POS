import express from 'express';
import cors from 'cors';
import type { DB } from './db/connection';
import { getDb } from './db/connection';
import { notFound, errorHandler } from './middleware/error-handler';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { rolesRouter } from './modules/roles/roles.routes';
import { settingsRouter } from './modules/settings/settings.routes';
import { unitsRouter } from './modules/units/units.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { suppliersRouter } from './modules/suppliers/suppliers.routes';
import { productsRouter } from './modules/products/products.routes';
import { productBatchesHandler } from './modules/batches/batches.routes';
import { batchesRouter } from './modules/batches/batches.routes';
import { purchasesRouter } from './modules/purchases/purchases.routes';
import { inventoryRouter } from './modules/inventory/inventory.routes';
import { shiftsRouter } from './modules/shifts/shifts.routes';
import { salesRouter } from './modules/sales/sales.routes';
import { customersRouter } from './modules/customers/customers.routes';
import { expensesRouter } from './modules/expenses/expenses.routes';
import { returnsRouter } from './modules/returns/returns.routes';
import { reportsRouter } from './modules/reports/reports.routes';
import { licenseRouter } from './modules/license/license.routes';

/**
 * Builds the Express app. Pass an explicit `db` in tests; in production the
 * bootstrap calls setDb() and we fall back to the singleton.
 */
export function createApp(db?: DB) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    req.db = db ?? getDb();
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ data: { ok: true } }));
  app.use('/api/license', licenseRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/units', unitsRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.get('/api/products/:id/batches', ...productBatchesHandler);
  app.use('/api/products', productsRouter);
  app.use('/api/batches', batchesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/shifts', shiftsRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/expenses', expensesRouter);
  app.use('/api/returns', returnsRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
