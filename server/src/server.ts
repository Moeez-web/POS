import { createApp } from './app';
import type { DB } from './db/connection';
import { openDb, setDb } from './db/connection';
import { migrate } from './db/migrate';
import { seed } from './db/seed';
import { config } from './config';
import { runBackgroundRefresh } from './modules/license/license.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Renew the license shortly after boot, then once a day. Best-effort (no-op when offline). */
function startLicenseSync(db: DB): void {
  const tick = () => {
    runBackgroundRefresh(db).catch(() => {
      /* offline / transient — the local verifier still gates access */
    });
  };
  setTimeout(tick, 5000); // shortly after boot
  setInterval(tick, DAY_MS); // daily heartbeat + stale-token renew
}

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

  startLicenseSync(db);
}

if (require.main === module) {
  start();
}
