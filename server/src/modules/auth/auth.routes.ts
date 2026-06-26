import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { licenseGate } from '../../middleware/license-gate';
import { validate } from '../../middleware/validate';
import { loginSchema, changePasswordSchema } from './auth.schema';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.post('/login', licenseGate, validate(loginSchema), ctrl.login);
authRouter.get('/me', authenticate, ctrl.me);
authRouter.post('/logout', authenticate, ctrl.logout);
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), ctrl.changePassword);
