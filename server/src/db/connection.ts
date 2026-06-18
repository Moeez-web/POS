import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'node-sqlite3-wasm';
import { config } from '../config';

/**
 * SQLite via `node-sqlite3-wasm` — a synchronous, file-backed WASM build with NO native
 * compilation. Works identically on any Node (dev/test on Node 25) and on Electron's bundled
 * Node (20), avoiding both the better-sqlite3 build failure and the node:sqlite version gap.
 *
 * The whole app only uses prepare/exec/run/get/all, so the engine lives in this one file.
 */
export interface Stmt {
  all(...params: any[]): any[];
  get(...params: any[]): any;
  run(...params: any[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

export interface DB {
  prepare(sql: string): Stmt;
  exec(sql: string): void;
  close(): void;
}

function args(p: any[]): any {
  return p.length ? p : undefined;
}

export function openDb(dbPath: string): DB {
  // Ensure the parent directory exists and use an absolute path so the engine
  // can always create the file. WAL is intentionally NOT used — WASM SQLite has
  // no shared memory, so the default rollback journal is the correct mode here.
  let target = dbPath;
  if (dbPath !== ':memory:') {
    target = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
  }
  const raw = new Database(target);
  raw.exec('PRAGMA foreign_keys = ON');

  return {
    exec: (sql: string) => raw.exec(sql),
    close: () => raw.close(),
    // Each prepare() returns a thin wrapper using the Database convenience methods,
    // which prepare+execute+finalize internally (no leaked statements).
    prepare: (sql: string): Stmt => ({
      run: (...p: any[]) => raw.run(sql, args(p)) as { changes: number | bigint; lastInsertRowid: number | bigint },
      get: (...p: any[]) => raw.get(sql, args(p)),
      all: (...p: any[]) => (raw.all(sql, args(p)) ?? []) as any[],
    }),
  };
}

let singleton: DB | null = null;

export function getDb(): DB {
  if (!singleton) singleton = openDb(config.dbPath);
  return singleton;
}

export function setDb(db: DB): void {
  singleton = db;
}
