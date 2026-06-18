import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { createProductSchema, updateProductSchema, barcodeSchema, setPriceSchema, addStockSchema } from './products.schema';
import * as ctrl from './products.controller';

export const productsRouter = Router();
productsRouter.use(authenticate);

productsRouter.get('/', requirePermission('products.read'), paginate, ctrl.list);
productsRouter.get('/search', requirePermission('products.read'), ctrl.search);
productsRouter.get('/barcode/:code', requirePermission('products.read'), ctrl.byBarcode);
productsRouter.get('/:id', requirePermission('products.read'), ctrl.get);
productsRouter.post('/', requirePermission('products.create'), validate(createProductSchema), ctrl.create);
productsRouter.patch('/:id', requirePermission('products.update'), validate(updateProductSchema), ctrl.update);
productsRouter.delete('/:id', requirePermission('products.delete'), ctrl.remove);
productsRouter.patch('/:id/price', requirePermission('products.update'), validate(setPriceSchema), ctrl.setPrice);
productsRouter.post('/:id/stock', requirePermission('purchases.create', 'products.update'), validate(addStockSchema), ctrl.addStock);
productsRouter.post('/:id/barcodes', requirePermission('products.barcode.manage'), validate(barcodeSchema), ctrl.addBarcode);
productsRouter.delete('/:id/barcodes/:bid', requirePermission('products.barcode.manage'), ctrl.removeBarcode);
