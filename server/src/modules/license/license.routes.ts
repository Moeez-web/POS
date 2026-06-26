import { Router } from 'express';
import { validate } from '../../middleware/validate';
import { activateSchema, manualSchema } from './license.schema';
import * as ctrl from './license.controller';

/**
 * Local POS Express ↔ POS Angular endpoints. These are intentionally PUBLIC (no auth):
 * key entry / activation / the block screen must work before any user can log in.
 */
export const licenseRouter = Router();

licenseRouter.get('/status', ctrl.status);
licenseRouter.post('/manual', validate(manualSchema), ctrl.manual); // offline pasted key
licenseRouter.post('/activate', validate(activateSchema), ctrl.activate); // online (dashboard)
licenseRouter.post('/renew', ctrl.renew); // online (dashboard)
