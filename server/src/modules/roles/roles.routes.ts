import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { createRoleSchema, updateRoleSchema } from './roles.schema';
import * as ctrl from './roles.controller';

export const rolesRouter = Router();

rolesRouter.use(authenticate);
rolesRouter.get('/permissions', requirePermission('roles.read'), ctrl.listPermissions);
rolesRouter.get('/', requirePermission('roles.read'), ctrl.list);
rolesRouter.get('/:id', requirePermission('roles.read'), ctrl.get);
rolesRouter.post('/', requirePermission('roles.create'), validate(createRoleSchema), ctrl.create);
rolesRouter.patch('/:id', requirePermission('roles.update'), validate(updateRoleSchema), ctrl.update);
rolesRouter.delete('/:id', requirePermission('roles.delete'), ctrl.remove);
