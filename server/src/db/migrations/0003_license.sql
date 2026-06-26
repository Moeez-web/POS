-- 0003: single-row license table for offline license/token enforcement.
CREATE TABLE IF NOT EXISTS license (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  install_id       TEXT,
  customer_ref     INTEGER,
  token            TEXT,
  plan             TEXT,
  issued_at        TEXT,
  token_expires_at TEXT,   -- availability exp (~14d)
  access_until     TEXT,   -- payment date (null = lifetime)
  grace_days       INTEGER,
  jwks_cache       TEXT,   -- last JWKS JSON fetched from the dashboard
  last_check_at    TEXT,
  last_seen_at     TEXT,   -- clock-tamper anchor (monotonic)
  last_status      TEXT,   -- ok | payment_due | payment_blocked | needs_connection | suspended
  updated_at       TEXT
);
INSERT OR IGNORE INTO license (id) VALUES (1);
