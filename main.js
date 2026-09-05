const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let updaterConfigured = false;
let updateDownloaded = false;

function loadUpdateConfig() {
  const candidates = [path.join(process.resourcesPath, 'update-config.json'), path.join(__dirname, 'update-config.json')];
  for (const file of candidates) {
    try { if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  }
  return { enabled: false, checkOnStartup: false };
}

function sendUpdate(type, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('adoshe:update-event', type, payload);
}

function configureUpdater() {
  const cfg = loadUpdateConfig();
  if (!cfg.enabled || !cfg.owner || !cfg.repo) return cfg;
  try {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.setFeedURL({ provider: 'github', owner: cfg.owner, repo: cfg.repo, releaseType: cfg.releaseType || 'release' });
    updaterConfigured = true;
    autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
    autoUpdater.on('update-available', info => sendUpdate('available', { version: info.version, releaseDate: info.releaseDate }));
    autoUpdater.on('update-not-available', info => sendUpdate('not-available', { version: info.version }));
    autoUpdater.on('download-progress', p => sendUpdate('progress', { percent: p.percent, transferred: p.transferred, total: p.total }));
    autoUpdater.on('update-downloaded', info => { updateDownloaded = true; sendUpdate('downloaded', { version: info.version }); });
    autoUpdater.on('error', err => sendUpdate('error', { message: err?.message || String(err) }));
  } catch (e) { sendUpdate('error', { message: e.message }); }
  return cfg;
}

async function checkForUpdates() {
  if (!app.isPackaged) return { ok: false, reason: 'development' };
  if (!updaterConfigured) { sendUpdate('error', { message: 'Automatic updates are not configured.' }); return { ok: false, reason: 'not-configured' }; }
  try { return await autoUpdater.checkForUpdates(); }
  catch (e) { sendUpdate('error', { message: e.message }); return { ok: false, reason: 'error' }; }
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, show: false, backgroundColor: '#eef2f5', autoHideMenuBar: true, webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, 'preload.js') } });
  mainWindow.loadFile(path.join(__dirname, 'adoshe.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

ipcMain.handle('adoshe:get-version', () => app.getVersion());
ipcMain.handle('adoshe:check-for-updates', () => checkForUpdates());
ipcMain.handle('adoshe:download-update', async () => { if (!updaterConfigured) { sendUpdate('error', { message: 'Automatic updates are not configured.' }); return; } try { await autoUpdater.downloadUpdate(); } catch (e) { sendUpdate('error', { message: e.message }); } });
ipcMain.handle('adoshe:install-update', () => { if (updateDownloaded) autoUpdater.quitAndInstall(false, true); else sendUpdate('error', { message: 'No downloaded update is ready to install.' }); });

app.whenReady().then(() => {
  const cfg = configureUpdater();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  if (cfg.enabled && cfg.checkOnStartup) setTimeout(() => checkForUpdates(), Number(cfg.startupDelayMs || 8000));
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
