const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const db = require('./src/db');
const S = require('./src/scheduler');

let win;

function initAutoUpdate() {
  autoUpdater.autoDownload = true;
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Dostupno je ažuriranje',
      message: `Preuzeta je nova verzija (${info.version}). Restartovati aplikaciju sada da bi se instalirala?`,
      buttons: ['Restartuj sada', 'Kasnije'],
      defaultId: 0,
      cancelId: 1,
    }).then((res) => {
      if (res.response === 0) autoUpdater.quitAndInstall();
    });
  });
  autoUpdater.on('error', (err) => console.error('AutoUpdater error:', err));
  autoUpdater.checkForUpdates();
}

async function createWindow() {
  const dbFile = path.join(app.getPath('userData'), 'raspored.sqlite');
  await db.init(dbFile);

  win = new BrowserWindow({
    width: 1320, height: 880, minWidth: 1000, minHeight: 640,
    title: 'Raspored radnika',
    backgroundColor: '#0f1115',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  win.removeMenu();

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    win.loadURL(devUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, 'dist-renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  if (app.isPackaged) initAutoUpdate();
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// Da greske u main procesu ne ostanu nevidljive
process.on('uncaughtException', (e) => { console.error('MAIN ERROR:', e); });

ipcMain.handle('app:version', () => app.getVersion());

// ---------- auth / settings ----------
ipcMain.handle('auth:check', (e, pin) => {
  const stored = db.getSetting('pin');
  if (!stored) return { ok: true, firstRun: true };
  if (String(pin) === String(stored)) return { ok: true };
  if (db.checkRecoveryCode(pin)) return { ok: true, viaRecovery: true };
  return { ok: false };
});
ipcMain.handle('auth:setPin', (e, pin) => { db.setSetting('pin', pin || ''); return true; });
ipcMain.handle('auth:hasPin', () => !!db.getSetting('pin'));
ipcMain.handle('auth:generateRecoveryCodes', () => db.generateRecoveryCodes());
ipcMain.handle('auth:recoveryStatus', () => db.getRecoveryStatus());
ipcMain.handle('settings:get', (e, key) => db.getSetting(key));
ipcMain.handle('settings:set', (e, key, value) => { db.setSetting(key, value); return true; });

// ---------- skills ----------
ipcMain.handle('skills:list', () => db.getSkills());
ipcMain.handle('skills:add', (e, name) => db.addSkill(name));
ipcMain.handle('skills:update', (e, id, name) => { db.updateSkill(id, name); return true; });
ipcMain.handle('skills:delete', (e, id) => { db.deleteSkill(id); return true; });

// ---------- workers ----------
ipcMain.handle('workers:list', () => db.getWorkers());
ipcMain.handle('workers:add', (e, w) => db.addWorker(w));
ipcMain.handle('workers:update', (e, w) => { db.updateWorker(w); return true; });
ipcMain.handle('workers:delete', (e, id) => { db.deleteWorker(id); return true; });

// ---------- locations ----------
ipcMain.handle('locations:list', () => db.getLocations());
ipcMain.handle('locations:add', (e, l) => db.addLocation(l));
ipcMain.handle('locations:update', (e, l) => { db.updateLocation(l); return true; });
ipcMain.handle('locations:delete', (e, id) => { db.deleteLocation(id); return true; });

// ---------- schedule ----------
ipcMain.handle('schedule:generate', (e, startISO, days) => {
  const workers = db.getWorkers();
  const locations = db.getLocations();
  const anchor = db.getSetting('anchor') || startISO;
  const endISO = S.addDaysISO(startISO, days - 1);
  const counts = db.getCounts();
  const locks = db.getLocks(startISO, endISO);
  const out = S.generateRange(workers, locations, startISO, days, anchor, counts, locks);
  db.writeSchedule(out.days, startISO, endISO);
  return { warnings: out.warnings, days };
});
ipcMain.handle('schedule:get', (e, startISO, endISO) => ({
  rows: db.getScheduleRange(startISO, endISO),
  counts: db.getCounts(),
}));
ipcMain.handle('schedule:setManual', (e, date, shift, locationId, workerId) => { db.setManual(date, shift, locationId, workerId); return true; });
ipcMain.handle('schedule:remove', (e, date, shift, locationId, workerId) => { db.removeAssignment(date, shift, locationId, workerId); return true; });
ipcMain.handle('schedule:available', (e, date, shift) => {
  const anchor = db.getSetting('anchor') || date;
  return db.getWorkers().filter(w =>
    w.active !== false &&
    S.shiftForGroup(w.group, date, anchor) === shift &&
    !S.isAbsent(w, date));
});

// ---------- work orders ----------
ipcMain.handle('orders:get', (e, date, workerId) => db.getWorkOrder(date, workerId));
ipcMain.handle('orders:set', (e, date, workerId, text) => { db.setWorkOrder(date, workerId, text); return true; });
ipcMain.handle('orders:forDate', (e, date) => db.getWorkOrdersForDate(date));

// ---------- PDF ----------
ipcMain.handle('pdf:export', async (e, htmlString, suggestedName) => {
  const pdfWin = new BrowserWindow({ show: false });
  await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlString));
  const data = await pdfWin.webContents.printToPDF({
    pageSize: 'A4', landscape: true, printBackground: true,
    margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
  });
  pdfWin.close();
  const res = await dialog.showSaveDialog(win, {
    title: 'Sačuvaj PDF raspored',
    defaultPath: suggestedName || 'raspored.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (res.canceled || !res.filePath) return { ok: false };
  fs.writeFileSync(res.filePath, data);
  return { ok: true, path: res.filePath };
});
