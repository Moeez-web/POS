const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.POS_PORT) || 4317;
const API_BASE = `http://localhost:${PORT}/api`;
let serverProc = null;

/** Persist a per-install JWT secret in userData. */
function getJwtSecret(userData) {
  const file = path.join(userData, 'jwt.secret');
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(file, secret);
    return secret;
  }
}

/** Persist a stable per-install id in userData (used for license activation/heartbeat). */
function getInstallId(userData) {
  const file = path.join(userData, 'install.id');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    const id = crypto.randomUUID();
    fs.writeFileSync(file, id);
    return id;
  }
}

/** Run the compiled API server using Electron's bundled Node (no extra runtime needed). */
function startServer() {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const entry = path.join(__dirname, '..', 'server', 'dist', 'server.js');
  // Capture the API server's output to a log file so packaged-build startup failures are diagnosable
  // (there's no console in a packaged app). See userData/server.log.
  const logPath = path.join(userData, 'server.log');
  const log = (m) => {
    try {
      fs.appendFileSync(logPath, m + '\n');
    } catch {
      /* ignore */
    }
  };
  log(`\n=== ${new Date().toISOString()} starting server (v${app.getVersion()}) ===`);
  log(`execPath=${process.execPath}`);
  log(`entry=${entry} exists=${fs.existsSync(entry)}`);
  const logFd = fs.openSync(logPath, 'a');
  serverProc = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      POS_DB_PATH: path.join(userData, 'pos.db'),
      POS_PORT: String(PORT),
      POS_JWT_SECRET: getJwtSecret(userData),
      POS_APP_VERSION: app.getVersion(),
      POS_INSTALL_ID: getInstallId(userData),
      POS_DASHBOARD_URL: process.env.POS_DASHBOARD_URL || 'http://localhost:4400/api/device',
    },
    stdio: ['ignore', logFd, logFd],
  });
  serverProc.on('error', (e) => log(`[spawn error] ${String(e)}`));
  serverProc.on('exit', (code, sig) => log(`[server exited] code=${code} signal=${sig}`));
}

function waitForServer() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const ping = () => {
      http
        .get(`${API_BASE.replace('/api', '')}/api/health`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (++tries > 60) return reject(new Error('API did not start'));
          setTimeout(ping, 200);
        });
    };
    ping();
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'CounterPro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      additionalArguments: [`--pos-api-base=${API_BASE}`],
    },
  });

  const devUrl = process.env.POS_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'client', 'dist', 'client', 'browser', 'index.html'));
  }
  return win;
}

/**
 * Auto-update (docs/09): download in the background, but NEVER install without explicit consent.
 * Status is forwarded to the renderer, which shows an in-app banner; the customer chooses.
 */
function initAutoUpdate(win) {
  if (!app.isPackaged) return; // dev: no updater
  let autoUpdater;
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch {
    return; // not installed in dev
  }

  autoUpdater.autoDownload = true; // fetch in background
  autoUpdater.autoInstallOnAppQuit = false; // NEVER install without explicit consent

  const send = (status, payload = {}) => {
    if (win && !win.isDestroyed()) win.webContents.send('update:status', { status, ...payload });
  };
  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (i) => send('available', { version: i.version }));
  autoUpdater.on('update-not-available', () => send('none'));
  autoUpdater.on('download-progress', (p) => send('downloading', { percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => send('downloaded', { version: i.version, notes: i.releaseNotes }));
  autoUpdater.on('error', (e) => send('error', { message: String(e?.message || e) }));

  ipcMain.handle('update:check', () => autoUpdater.checkForUpdates().catch(() => {}));
  ipcMain.handle('update:install', () => autoUpdater.quitAndInstall()); // customer clicked "Install now"

  autoUpdater.checkForUpdates().catch(() => {}); // on launch
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000); // every 6h
}

app.whenReady().then(async () => {
  // In dev (POS_DEV_URL set) the API is already running via `npm run dev:server`.
  // In a packaged/production run we start the bundled server ourselves.
  if (!process.env.POS_DEV_URL) startServer();
  try {
    await waitForServer();
  } catch (e) {
    console.error(e);
  }
  const win = createWindow();
  initAutoUpdate(win);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
  if (serverProc) serverProc.kill();
});
