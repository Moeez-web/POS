import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import { createUserSchema, updateUserSchema, resetPasswordSchema } from './users.schema';
import * as ctrl from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.get('/', requirePermission('users.read'), paginate, ctrl.list);
usersRouter.get('/:id', requirePermission('users.read'), ctrl.get);
usersRouter.post('/', requirePermission('users.create'), validate(createUserSchema), ctrl.create);
usersRouter.patch('/:id', requirePermission('users.update'), validate(updateUserSchema), ctrl.update);
usersRouter.post(
  '/:id/reset-password',
  requirePermission('users.update'),
  validate(resetPasswordSchema),
  ctrl.resetPassword,
);
