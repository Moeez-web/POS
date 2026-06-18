# Build Status & How to Run

Last updated: 2026-06-06

## Status summary

| Layer | Status | Verified by |
|---|---|---|
| **Backend API** (`server/`) | ✅ Complete | 31 Vitest tests + live HTTP smoke |
| **Backend compiles** (`tsc`) | ✅ Clean | `npm --prefix server run build` |
| **Angular frontend** (`client/`) | ✅ Builds; core flows done | `npx ng build` (lazy chunks, Tailwind) |
| **Electron shell** (`electron/`) | ✅ Written | boots API child + loads UI (needs a display to run) |
| **Packaging + auto-update** | ✅ Configured | electron-builder + electron-updater wired (feed URL TBD) |
| **Playwright E2E** | ✅ Specs written | ready to run after `npx playwright install chromium` |

### Frontend screens
- **Done (real):** login, forced change-password, role-based landing, both layouts (POS + Dashboard), POS register (scan → cart → split-pay → receipt), dashboard KPIs, products (list + create), idle-timeout warning, toast, permission-gated nav, route guards.
- **Scaffolded placeholders (API is live, UI pending):** purchases, inventory, expenses, reports, customers, users, roles, settings. Each is permission-gated and navigable; wire to the existing endpoints next.

## Prerequisites
- Any Node 18+ (tested on Node 25). The DB engine is **`node-sqlite3-wasm`** (synchronous, file-backed WASM) instead of better-sqlite3 — no native build, and it runs on both your system Node and Electron's bundled Node 20. Engine is isolated in `server/src/db/connection.ts`.

## Run in development
```bash
# 1. Backend API (terminal A)
cd server && npm install && npm run dev      # http://localhost:4317/api  (login admin/admin123)

# 2. Angular UI (terminal B)
cd client && npm install && npm start         # http://localhost:4200

# …or run everything + Electron together from the repo root:
npm install
npm run dev                                    # server + client + electron window
```
Default login: **admin / admin123** (forced password change on first run).

## Run the tests
```bash
# Backend unit/integration (Vitest) — 31 tests
cd server && npm test

# Frontend E2E (Playwright) — from repo root, once:
npm install
npx playwright install chromium
npm run test:e2e
```

## Build & package the desktop app
```bash
npm run build        # compiles server (tsc) + builds Angular (prod)
npm run package      # electron-builder → release/  (.exe / .dmg / .AppImage)
```
The packaged app stores its database at the OS userData path (`pos.db`), runs migrations with a backup on first launch, and (when `build.publish.url` points at a real feed) auto-updates per `docs/09`.

## Remaining work
1. Flesh out the placeholder management pages (purchases, inventory, expenses, reports, customers, users, roles, settings) against the existing API.
2. Run the Playwright gate (browser install) and extend specs per feature.
3. Validate `electron-builder` packaging on each target OS and set the real auto-update feed URL + code signing.
