const { app, BrowserWindow } = require('electron');
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

/** Run the compiled API server using Electron's bundled Node (no extra runtime needed). */
function startServer() {
  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  const entry = path.join(__dirname, '..', 'server', 'dist', 'server.js');
  serverProc = spawn(process.execPath, [entry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      POS_DB_PATH: path.join(userData, 'pos.db'),
      POS_PORT: String(PORT),
      POS_JWT_SECRET: getJwtSecret(userData),
      POS_APP_VERSION: app.getVersion(),
    },
    stdio: 'inherit',
  });
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
    title: 'POS',
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
}

/** Optional auto-update — only in a packaged build with a configured feed (docs/09). */
function initAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch {
    /* electron-updater not installed in dev */
  }
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
  createWindow();
  initAutoUpdate();

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
