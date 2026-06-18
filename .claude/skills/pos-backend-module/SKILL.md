---
name: pos-backend-module
description: Scaffold a new backend/server API module for the POS system following the layered pattern (routes + controller + service + repository + zod validation + permission guard). Use whenever creating or adding a new server module, REST endpoint, route, controller, service, repository, or backend API feature for the POS (e.g. products, sales, expenses, reports). Keywords - backend module, new endpoint, API route, express module, controller, service, repository, server feature.
---

# POS Backend Module Scaffolder

Creates a consistent backend module under `server/modules/<name>/` following `docs/04-backend-design.md`. **Read `docs/04-backend-design.md` and `docs/05-api-spec.md` first** for the module's exact endpoints and permissions.

## Layered rules (never break these)
- **SQL only in `*.repo.ts`.** Business logic only in `*.service.ts`. Controllers thin. Routes just wire path + middleware.
- **Money** is always integer minor units (`*_minor`).
- **Multi-table writes** go through `runInUnitOfWork()` (`lib/unit-of-work.ts`).
- **Lists** are server-paginated via `lib/paginate.ts` → `{ data, total, page, pageSize }`.
- **Every write** is zod-validated. **Every route** has `requirePermission('<key>')`.
- **Cost/profit** fields pass through `serialize.ts` (stripped unless `reports.profit.view`).
- **Sensitive ops** call `audit.ts`.

## Files to create
```
server/modules/<name>/
  <name>.routes.ts       # router; wire requirePermission + validate + controller
  <name>.controller.ts   # parse req → call service → res {data} | list envelope
  <name>.service.ts      # business rules, UoW, audit
  <name>.repo.ts         # better-sqlite3 prepared statements (all SQL)
  <name>.schema.ts       # zod schemas for create/update/query
```

## Steps
1. Confirm endpoints + permission keys from `docs/05-api-spec.md`.
2. Create the 5 files (templates below). Use existing modules as the style reference.
3. Mount the router in `server/app.ts`: `app.use('/api/<name>', <name>Router)`.
4. If new permission keys are needed → invoke **pos-rbac-permission**.
5. If schema changes are needed → invoke **pos-db-migration**.
6. After implementing → invoke **pos-backend-tests** then **pos-feature-test-gate**.

## Templates

`<name>.routes.ts`
```ts
import { Router } from 'express';
import { requirePermission } from '../../middleware/require-permission';
import { validate } from '../../middleware/validate';
import { paginate } from '../../middleware/paginate';
import * as ctrl from './<name>.controller';
import { createSchema, updateSchema } from './<name>.schema';

export const <name>Router = Router();
<name>Router.get('/', requirePermission('<name>.read'), paginate, ctrl.list);
<name>Router.get('/:id', requirePermission('<name>.read'), ctrl.get);
<name>Router.post('/', requirePermission('<name>.create'), validate(createSchema), ctrl.create);
<name>Router.patch('/:id', requirePermission('<name>.update'), validate(updateSchema), ctrl.update);
```

`<name>.service.ts` (transactional example)
```ts
import { runInUnitOfWork } from '../../lib/unit-of-work';
import { writeAudit } from '../../lib/audit';
import * as repo from './<name>.repo';

export function create(input, user) {
  return runInUnitOfWork((uow) => {
    const row = repo.insert(uow.db, input);
    writeAudit(uow.db, { user_id: user.id, action: '<name>.create', entity: '<name>', entity_id: row.id });
    return row;
  });
}
```

## Checklist
- [ ] 5 files created, SQL only in repo, logic only in service
- [ ] Router mounted in `app.ts`
- [ ] Permissions wired (`requirePermission`)
- [ ] zod validation on writes; pagination on lists
- [ ] UoW + audit on multi-table/sensitive ops
- [ ] cost/profit serialized correctly
- [ ] Tests requested (backend-tests + feature-test-gate)
