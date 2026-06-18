---
name: pos-release
description: Cut a versioned release of the POS desktop app - bump the semantic version, run the full test gate, build and sign the installers, publish the electron-updater feed, and write the changelog plus DB migration notes. Use whenever releasing a new version, publishing an update, shipping a build, cutting a release, or bumping the app version. Keywords - release, new version, publish update, ship build, version bump, changelog, electron-builder, auto update, deploy app, cut release.
---

# POS Release

Produces a consistent, safe versioned release that installed machines can auto-update to. Follows `docs/09-versioning-and-updates.md`. **Never release red:** the full test suite must be green first.

## Pre-flight (block on failure)
1. Clean git working tree; on a release branch.
2. **Run the full test gate** across changed/affected features — Vitest + Playwright must be **all green** (invoke **pos-feature-test-gate**). No release on failing or flaky tests.
3. Verify pending DB migrations: list every new migration since the last release; confirm each is forward-only, immutable, backwards-safe, and idempotent for existing DBs.

## Versioning
4. Bump `version` in `package.json` using **semver**:
   - PATCH = fixes only, no schema change
   - MINOR = new features, additive/safe migrations
   - MAJOR = breaking changes
5. Confirm new permissions/settings have **idempotent inserts** for existing installs (not just fresh seed).

## Build & publish
6. `electron-builder` build for target OSes (Win NSIS `.exe`, mac `.dmg`, Linux `.AppImage`).
7. **Code-sign / notarize** (Win Authenticode, mac notarize) so auto-update installs cleanly.
8. **Publish** to the update feed (`electron-builder --publish always`) → uploads installers + `latest.yml`. Channel = `stable`.

## Document
9. **Changelog** entry: features, fixes, breaking changes.
10. **Migration notes:** list new migration numbers, what they change, any data transforms, and rollback note (pre-migration backup is automatic on the client).
11. Tag the release in git (`vX.Y.Z`) and push.

## Verify the update path
12. On a machine with the **previous** version + real-ish data: let it auto-detect the new feed, download, and (admin) "Update now".
13. Confirm on first launch of the new version: **backup created**, **pending migrations applied**, `schema_version`/`app_version` updated, app boots, a smoke sale works.
14. Confirm downgrade protection: an old binary refuses a newer-schema DB.

## Checklist
- [ ] Test gate fully green (no flakes)
- [ ] Migrations forward-only, idempotent seed deltas
- [ ] Version bumped per semver
- [ ] Installers built + signed/notarized
- [ ] Feed published (`latest.yml`)
- [ ] Changelog + migration notes written
- [ ] Git tagged `vX.Y.Z`
- [ ] Auto-update path verified prev→new with backup + migrate
- [ ] Downgrade protection verified
