import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { activateSchema } from './license.schema';
import * as ctrl from './license.controller';

/**
 * Local POS Express ↔ POS Angular endpoints. These are intentionally PUBLIC (no auth):
 * activation and the block screen must work before any user can log in.
 */
export const licenseRouter = Router();

licenseRouter.get('/status', ctrl.status);
licenseRouter.post('/activate', validate(activateSchema), ctrl.activate);
licenseRouter.post('/renew', ctrl.renew);
