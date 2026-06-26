import path from 'node:path';

/**
 * Central config. In the Electron app these are overridden via env
 * (POS_DB_PATH points at userData, POS_JWT_SECRET is generated per install).
 */
export const config = {
  port: Number(process.env.POS_PORT) || 4317,
  dbPath: process.env.POS_DB_PATH || path.join(process.cwd(), 'pos.db'),
  jwtSecret: process.env.POS_JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.POS_JWT_TTL || '12h',
  appVersion: process.env.POS_APP_VERSION || '0.1.0',
  bcryptRounds: 10,
  installId: process.env.POS_INSTALL_ID || 'dev-install',
  dashboardUrl: process.env.POS_DASHBOARD_URL || 'http://localhost:4400/api/device',
};
