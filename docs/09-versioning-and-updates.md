# Versioning & Updates

The app supports **version updates** in two independent dimensions:
1. **App update** — shipping a new version of the desktop app to installed machines (auto-update via internet feed, admin-triggered install).
2. **Data/schema update** — migrating the existing local `pos.db` to the new version's schema safely, with a backup, automatically on launch.

> The store's **data never leaves the machine**. Only the app's installer/binaries are served from an internet update feed. Data is local-only and on-prem.

## Versioning scheme
- **Semantic versioning** `MAJOR.MINOR.PATCH` in `package.json` → shown in Settings → About.
- Each release maps to a set of **migrations** (0..N new ones). `schema_version` = highest applied migration number.
- The app records both `app_version` and `schema_version` in the DB.

---

## 1. App update (electron-updater)

- **Mechanism:** `electron-updater` against a hosted release feed produced by `electron-builder` (e.g. **GitHub Releases** or a generic HTTPS/S3 endpoint). Publishing uploads installers + `latest.yml` (the feed manifest).
- **Check & download (background):** on launch and on a periodic timer, `autoUpdater.checkForUpdates()`; `autoDownload = true` fetches the new package quietly. No install happens automatically.
- **Install (admin-triggered):** when an update is downloaded, the renderer is notified → **Settings → Updates** shows *"Version X.Y.Z is ready"* with release notes and an **"Update now"** button (visible only with `settings.update` permission). Clicking calls `autoUpdater.quitAndInstall()` → app restarts on the new version. This avoids interrupting a sale mid-shift.
- **Security:** feed served over **HTTPS**; electron-updater verifies the package signature. **Code-sign** Windows (Authenticode) and macOS (notarize) builds so updates install without warnings.
- **Offline behavior:** if there's no internet, checks fail silently; the app keeps running. Update simply happens next time a machine is online.
- **Downgrade protection:** the app refuses to run against a `pos.db` whose `schema_version` is **newer** than it understands, and tells the user to update the app (prevents an older binary corrupting a newer DB).

### Electron main responsibilities
- Configure `autoUpdater` (feed URL, channel `stable`).
- IPC: `update:status` (checking / available / downloaded / none / error), `update:install`.
- Expose current version + pending version to the renderer via preload.

---

## 2. Data/schema update (migrate-on-launch, with backup)

Runs **every launch**, before the server accepts requests:

1. Open `pos.db`. Read applied migrations from **`schema_migrations`**.
2. Compute **pending** migrations (files in `db/migrations/` with id > last applied).
3. If none → continue boot.
4. If pending → **back up** `pos.db` first: copy to `userData/backups/pos-<YYYYMMDD-HHMMSS>-v<from>.db`.
5. Apply each pending migration **inside a transaction**, recording it in `schema_migrations` (id, applied_at, app_version).
6. On **any failure** → roll back the transaction, **restore from the backup**, refuse to start with a clear error (don't run on a half-migrated DB).
7. On success → update `settings.app_version`, prune old backups (keep last N), continue boot.

### Rules for migrations across versions
- **Forward-only & immutable:** never edit a shipped migration; add a new numbered one (enforced by **pos-db-migration**).
- **Backwards-safe:** new columns are nullable or have defaults; renames/splits use the create→copy→swap pattern; data transforms live in the migration.
- **Rollback strategy:** SQLite single-file → rely on the pre-migration **backup** rather than down-migrations. Restore is available from Settings.
- **Seed deltas:** new permissions/settings introduced by a version are inserted **idempotently** for existing DBs (see **pos-rbac-permission**), not only in fresh-install seed.

### `schema_migrations` table
`id INTEGER PK` (migration number) · `name TEXT` · `applied_at TEXT` · `app_version TEXT`.

---

## Settings → Updates / About (UI)
- Current app version + schema version, last update check, last backup time.
- "Check for updates" + "Update now" (when ready) — `settings.update` permission.
- "Backup database now" / "Restore from backup" (admin).

## Release process
Cutting a version is handled by the **pos-release** skill: bump version → run the full test gate → build + sign installers → publish the feed (`latest.yml`) → write changelog + migration notes → tag in git. See `.claude/skills/pos-release/`.
