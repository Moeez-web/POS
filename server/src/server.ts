import { createApp } from './app';
import { openDb, setDb } from './db/connection';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { config } from './config';

/** Boot the API: open DB → migrate (with backup) → seed → listen. */
export function start(): void {
  const db = openDb(config.dbPath);
  const { applied } = migrate(db, { dbPath: config.dbPath });
  if (applied.length) {
    // eslint-disable-next-line no-console
    console.log(`Applied migrations: ${applied.join(', ')}`);
  }
  seed(db);
  setDb(db);

  const app = createApp(db);
  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`POS API listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  start();
}
