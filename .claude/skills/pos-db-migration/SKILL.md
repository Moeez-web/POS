---
name: pos-db-migration
description: Create and apply a SQLite database migration for the POS system (new table, new column, index, or schema change) using better-sqlite3, keeping schema.sql, the versioned migration files, the seed, and docs/03-database-schema.md in sync. Use whenever changing the database schema, adding a table or column, altering the data model, or creating a migration. Keywords - database migration, schema change, new table, add column, alter table, sqlite migration, db schema, migrate.
---

# POS DB Migration

Adds a versioned migration under `server/db/migrations/` and keeps everything in sync. Follows `docs/03-database-schema.md`.

## Rules
- **Money** columns are `INTEGER` minor units, suffixed `_minor`.
- **Timestamps** are ISO-8601 `TEXT` (UTC).
- **Foreign keys ON**; declare `REFERENCES`. Master data uses `is_active` soft-delete, no hard deletes.
- Audit fields where relevant: `created_at`, `updated_at`, `created_by`.
- Migrations are **append-only and immutable** once shipped — never edit an applied migration; add a new one.
- SQLite `ALTER TABLE` is limited (no drop/alter column) — for complex changes use the create-new-table → copy → drop → rename pattern.

## Steps
1. Pick the next number: `NNNN_<short_description>.sql` (zero-padded, sequential).
2. Write the migration SQL (idempotent-friendly; wrap in the migration runner's transaction).
3. Update `server/db/schema.sql` so a fresh install matches the migrated state.
4. Update `server/db/seed.ts` if new seed rows/permissions/settings are needed.
5. Update `docs/03-database-schema.md` (the table list + relationships diagram).
6. Run the migration (`npm run migrate` or app boot) and verify with a quick query.
7. If the change is permission-related → also invoke **pos-rbac-permission**.

## Template
`server/db/migrations/000N_add_<thing>.sql`
```sql
-- 000N: <what and why>
CREATE TABLE IF NOT EXISTS <table> (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
  amount_minor INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by INTEGER REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_<table>_<col> ON <table>(<col>);
```

## Checklist
- [ ] New numbered migration file (not editing an old one)
- [ ] `schema.sql` updated to match
- [ ] `seed.ts` updated if needed
- [ ] `docs/03-database-schema.md` updated
- [ ] Migration runs cleanly on a fresh DB and an existing DB
- [ ] FKs, money `_minor`, audit fields present
