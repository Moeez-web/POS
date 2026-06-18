import fs from 'node:fs';
import path from 'node:path';
import type { DB } from './connection';
import { config } from '../config';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

export interface MigrationFile {
  id: number;
  name: string;
  file: string;
}

export function listMigrations(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => {
      const m = f.match(/^(\d+)_(.+)\.sql$/);
      if (!m) throw new Error(`Bad migration filename: ${f}`);
      return { id: Number(m[1]), name: m[2], file: path.join(MIGRATIONS_DIR, f) };
    })
    .sort((a, b) => a.id - b.id);
}

function ensureMigrationsTable(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL,
    app_version TEXT
  )`);
}

function appliedIds(db: DB): Set<number> {
  const rows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[];
  return new Set(rows.map((r) => Number(r.id)));
}

/** Highest applied migration number = the DB schema version. */
export function schemaVersion(db: DB): number {
  ensureMigrationsTable(db);
  const ids = [...appliedIds(db)];
  return ids.length ? Math.max(...ids) : 0;
}

/** Highest migration number the current code knows about. */
export function latestSchemaVersion(): number {
  const m = listMigrations();
  return m.length ? m[m.length - 1].id : 0;
}

/**
 * Apply pending migrations. Backs up a real (file) DB before applying and restores
 * it on failure, so an update never leaves a half-migrated database. See docs/09.
 */
export function migrate(db: DB, opts: { dbPath?: string } = {}): { applied: number[] } {
  ensureMigrationsTable(db);

  // Downgrade protection: refuse to run if the DB is newer than this code understands.
  const dbVer = schemaVersion(db);
  const codeVer = latestSchemaVersion();
  if (dbVer > codeVer) {
    throw new Error(
      `Database schema (v${dbVer}) is newer than this app (v${codeVer}). Please update the app.`,
    );
  }

  const done = appliedIds(db);
  const pending = listMigrations().filter((m) => !done.has(m.id));
  if (pending.length === 0) return { applied: [] };

  const dbPath = opts.dbPath;
  let backupPath: string | null = null;
  if (dbPath && dbPath !== ':memory:' && fs.existsSync(dbPath)) {
    const dir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = path.join(dir, `pos-${ts}-v${dbVer}.db`);
    fs.copyFileSync(dbPath, backupPath);
  }

  const insert = db.prepare(
    'INSERT INTO schema_migrations (id, name, applied_at, app_version) VALUES (?, ?, ?, ?)',
  );

  const applied: number[] = [];
  for (const m of pending) {
    const sql = fs.readFileSync(m.file, 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      insert.run(m.id, m.name, new Date().toISOString(), config.appVersion);
      db.exec('COMMIT');
      applied.push(m.id);
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        /* ignore */
      }
      if (backupPath && dbPath) {
        try {
          db.close();
        } catch {
          /* ignore */
        }
        fs.copyFileSync(backupPath, dbPath);
      }
      throw new Error(`Migration ${m.id}_${m.name} failed: ${(err as Error).message}`);
    }
  }
  return { applied };
}

// CLI: `npm run migrate`
if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { openDb } = require('./connection');
  const db = openDb(config.dbPath);
  const res = migrate(db, { dbPath: config.dbPath });
  // eslint-disable-next-line no-console
  console.log(res.applied.length ? `Applied migrations: ${res.applied.join(', ')}` : 'No pending migrations.');
}
