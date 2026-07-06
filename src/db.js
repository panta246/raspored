/*
 * db.js — sloj baze (SQLite preko sql.js). Radi u glavnom (main) procesu.
 * Perzistencija: cijela baza se snima kao .sqlite fajl na disk poslije svake izmjene.
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let SQL = null;
let db = null;
let dbPath = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS skills (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grp TEXT NOT NULL DEFAULT 'crvena',
  sex TEXT NOT NULL DEFAULT 'M',
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'aktivan',
  status_from TEXT,
  status_to TEXT
);
CREATE TABLE IF NOT EXISTS worker_skills (worker_id INTEGER, skill_id INTEGER);
CREATE TABLE IF NOT EXISTS locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  minp INTEGER DEFAULT 1,
  maxp INTEGER DEFAULT 0,
  ord INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS location_skills (location_id INTEGER, skill_id INTEGER, cnt INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS schedule (
  date TEXT, shift TEXT, location_id INTEGER, worker_id INTEGER, locked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS work_orders (date TEXT, worker_id INTEGER, text TEXT, PRIMARY KEY(date, worker_id));
CREATE TABLE IF NOT EXISTS recovery_codes (code_hash TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0, created_at TEXT);
`;

async function init(filePath) {
  dbPath = filePath;
  SQL = await initSqlJs({
    locateFile: f => path.join(require.resolve('sql.js'), '..', f)
  });
  if (dbPath && fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(new Uint8Array(buf));
  } else {
    db = new SQL.Database();
  }
  db.run(SCHEMA);
  migrate();
  // Podrazumijevani PIN i anchor ako ne postoje
  if (!getSetting('anchor')) setSetting('anchor', isoToday());
  seedDefaultsIfEmpty();
  save();
  return true;
}

// Doda kolone koje ne postoje u starijim bazama (napravljenim prije nego što su dodane)
function migrate() {
  const cols = all("PRAGMA table_info(workers)").map(c => c.name);
  if (!cols.includes('sex')) db.run("ALTER TABLE workers ADD COLUMN sex TEXT NOT NULL DEFAULT 'M'");
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function save() {
  if (!db || !dbPath) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// --- niski nivo ---
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}
function run(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  save();
}
function lastId() {
  return all('SELECT last_insert_rowid() AS id')[0].id;
}

// --- settings ---
function getSetting(key) {
  const r = all('SELECT value FROM settings WHERE key=?', [key]);
  return r.length ? r[0].value : null;
}
function setSetting(key, value) {
  run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, String(value)]);
}

// --- rezervne (admin) šifre za oporavak: svaka radi samo jednom ---
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bez 0/O/1/I da se ne pobrka
function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
}
function randomRecoveryCode() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += RECOVERY_ALPHABET[crypto.randomInt(RECOVERY_ALPHABET.length)];
    groups.push(s);
  }
  return groups.join('-');
}
function generateRecoveryCodes(count = 5) {
  run('DELETE FROM recovery_codes');
  const now = new Date().toISOString();
  const codes = [];
  for (let i = 0; i < count; i++) {
    const code = randomRecoveryCode();
    codes.push(code);
    db.run('INSERT INTO recovery_codes(code_hash, used, created_at) VALUES(?,0,?)', [hashRecoveryCode(code), now]);
  }
  save();
  return codes;
}
function getRecoveryStatus() {
  const total = all('SELECT COUNT(*) c FROM recovery_codes')[0].c;
  const remaining = all('SELECT COUNT(*) c FROM recovery_codes WHERE used=0')[0].c;
  return { total, remaining };
}
function checkRecoveryCode(code) {
  if (!code) return false;
  const h = hashRecoveryCode(code);
  const rows = all('SELECT code_hash FROM recovery_codes WHERE code_hash=? AND used=0', [h]);
  if (!rows.length) return false;
  run('UPDATE recovery_codes SET used=1 WHERE code_hash=?', [h]);
  return true;
}

// --- seed (jednom, ako je prazno) ---
function seedDefaultsIfEmpty() {
  const sc = all('SELECT COUNT(*) c FROM skills')[0].c;
  if (sc === 0) {
    ['Šef smjene', 'Strani jezik', 'Vozač', 'Pilot/avion', 'Prva pomoć'].forEach(n =>
      db.run('INSERT INTO skills(name) VALUES(?)', [n]));
  }
  const lc = all('SELECT COUNT(*) c FROM locations')[0].c;
  if (lc === 0) {
    const defs = [['Lokacija 1', 3, 8, 1], ['Lokacija 2', 2, 6, 2], ['Lokacija 3', 1, 4, 3], ['Lokacija 4', 1, 4, 4], ['Lokacija 5', 1, 4, 5]];
    defs.forEach(d => db.run('INSERT INTO locations(name,minp,maxp,ord) VALUES(?,?,?,?)', d));
  }
  const wc = all('SELECT COUNT(*) c FROM workers')[0].c;
  if (wc === 0) seedWorkers(70);
}

// Ubaci N placeholder radnika, ravnomjerno raspoređenih po 4 grupe i po polu (M/Z),
// da bi aplikacija imala radnu postavu od prvog pokretanja (imena/pol se poslije uređuju).
function seedWorkers(count) {
  const groups = ['crvena', 'zelena', 'plava', 'ljubicasta'];
  for (let i = 1; i <= count; i++) {
    const name = `Radnik ${String(i).padStart(2, '0')}`;
    const grp = groups[(i - 1) % groups.length];
    const sex = i % 2 === 0 ? 'Z' : 'M';
    db.run('INSERT INTO workers(name,grp,sex,active,status) VALUES(?,?,?,1,\'aktivan\')', [name, grp, sex]);
  }
}

// --- skills ---
function getSkills() { return all('SELECT * FROM skills ORDER BY name'); }
function addSkill(name) { run('INSERT INTO skills(name) VALUES(?)', [name]); return lastId(); }
function updateSkill(id, name) { run('UPDATE skills SET name=? WHERE id=?', [name, id]); }
function deleteSkill(id) {
  run('DELETE FROM skills WHERE id=?', [id]);
  run('DELETE FROM worker_skills WHERE skill_id=?', [id]);
  run('DELETE FROM location_skills WHERE skill_id=?', [id]);
}

// --- workers ---
function getWorkers() {
  const ws = all('SELECT * FROM workers ORDER BY name');
  const links = all('SELECT * FROM worker_skills');
  return ws.map(w => ({
    id: w.id, name: w.name, group: w.grp, sex: w.sex || 'M', active: w.active === 1,
    status: w.status, statusFrom: w.status_from, statusTo: w.status_to,
    skills: links.filter(l => l.worker_id === w.id).map(l => l.skill_id)
  }));
}
function addWorker(w) {
  run('INSERT INTO workers(name,grp,sex,active,status,status_from,status_to) VALUES(?,?,?,?,?,?,?)',
    [w.name, w.group || 'crvena', w.sex || 'M', w.active === false ? 0 : 1, w.status || 'aktivan', w.statusFrom || null, w.statusTo || null]);
  const id = lastId();
  (w.skills || []).forEach(sid => db.run('INSERT INTO worker_skills(worker_id,skill_id) VALUES(?,?)', [id, sid]));
  save();
  return id;
}
function updateWorker(w) {
  run('UPDATE workers SET name=?,grp=?,sex=?,active=?,status=?,status_from=?,status_to=? WHERE id=?',
    [w.name, w.group, w.sex || 'M', w.active === false ? 0 : 1, w.status || 'aktivan', w.statusFrom || null, w.statusTo || null, w.id]);
  run('DELETE FROM worker_skills WHERE worker_id=?', [w.id]);
  (w.skills || []).forEach(sid => db.run('INSERT INTO worker_skills(worker_id,skill_id) VALUES(?,?)', [w.id, sid]));
  save();
}
function deleteWorker(id) {
  run('DELETE FROM workers WHERE id=?', [id]);
  run('DELETE FROM worker_skills WHERE worker_id=?', [id]);
  run('DELETE FROM schedule WHERE worker_id=?', [id]);
}

// --- locations ---
function getLocations() {
  const ls = all('SELECT * FROM locations ORDER BY ord, id');
  const ls2 = all('SELECT * FROM location_skills');
  return ls.map(l => ({
    id: l.id, name: l.name, min: l.minp, max: l.maxp, order: l.ord,
    requiredSkills: ls2.filter(x => x.location_id === l.id).map(x => ({ skillId: x.skill_id, count: x.cnt }))
  }));
}
function addLocation(l) {
  run('INSERT INTO locations(name,minp,maxp,ord) VALUES(?,?,?,?)', [l.name, l.min || 1, l.max || 0, l.order || 0]);
  const id = lastId();
  (l.requiredSkills || []).forEach(r => db.run('INSERT INTO location_skills(location_id,skill_id,cnt) VALUES(?,?,?)', [id, r.skillId, r.count || 1]));
  save();
  return id;
}
function updateLocation(l) {
  run('UPDATE locations SET name=?,minp=?,maxp=?,ord=? WHERE id=?', [l.name, l.min || 1, l.max || 0, l.order || 0, l.id]);
  run('DELETE FROM location_skills WHERE location_id=?', [l.id]);
  (l.requiredSkills || []).forEach(r => db.run('INSERT INTO location_skills(location_id,skill_id,cnt) VALUES(?,?,?)', [l.id, r.skillId, r.count || 1]));
  save();
}
function deleteLocation(id) {
  run('DELETE FROM locations WHERE id=?', [id]);
  run('DELETE FROM location_skills WHERE location_id=?', [id]);
  run('DELETE FROM schedule WHERE location_id=?', [id]);
}

// --- schedule ---
function getScheduleRange(fromISO, toISO) {
  return all('SELECT * FROM schedule WHERE date>=? AND date<=? ORDER BY date', [fromISO, toISO]);
}
function getLocks(fromISO, toISO) {
  const rows = all('SELECT * FROM schedule WHERE locked=1 AND date>=? AND date<=?', [fromISO, toISO]);
  const locks = {};
  rows.forEach(r => {
    const key = `${r.date}|${r.shift}|${r.location_id}`;
    (locks[key] = locks[key] || []).push(r.worker_id);
  });
  return locks;
}
// Upiši izgenerisan raspored za opseg, čuvajući zaključane (locked) zapise
function writeSchedule(days, fromISO, toISO) {
  // obriši nezaključane u opsegu
  run('DELETE FROM schedule WHERE locked=0 AND date>=? AND date<=?', [fromISO, toISO]);
  const lockedKeys = new Set(
    all('SELECT date,shift,location_id,worker_id FROM schedule WHERE locked=1 AND date>=? AND date<=?', [fromISO, toISO])
      .map(r => `${r.date}|${r.shift}|${r.location_id}|${r.worker_id}`)
  );
  for (const day of days) {
    for (const shift of ['PRVA', 'DRUGA']) {
      const a = day.shifts[shift] || {};
      for (const lid of Object.keys(a)) {
        for (const wid of a[lid]) {
          const k = `${day.date}|${shift}|${lid}|${wid}`;
          if (lockedKeys.has(k)) continue; // već postoji kao locked
          db.run('INSERT INTO schedule(date,shift,location_id,worker_id,locked) VALUES(?,?,?,?,0)', [day.date, shift, Number(lid), wid]);
        }
      }
    }
  }
  save();
}
// Ručna izmjena: postavi radnika na lokaciju/smjenu za dan i zaključaj
function setManual(date, shift, locationId, workerId) {
  // ukloni tog radnika sa tog dana/smjene (gdje god bio) da ne bude duplo
  run('DELETE FROM schedule WHERE date=? AND shift=? AND worker_id=?', [date, shift, workerId]);
  run('INSERT INTO schedule(date,shift,location_id,worker_id,locked) VALUES(?,?,?,?,1)', [date, shift, locationId, workerId]);
}
function removeAssignment(date, shift, locationId, workerId) {
  run('DELETE FROM schedule WHERE date=? AND shift=? AND location_id=? AND worker_id=?', [date, shift, locationId, workerId]);
}
function getCounts() {
  const rows = all('SELECT worker_id, location_id, COUNT(*) c FROM schedule GROUP BY worker_id, location_id');
  const counts = {};
  rows.forEach(r => { (counts[r.worker_id] = counts[r.worker_id] || {})[r.location_id] = r.c; });
  return counts;
}

// --- work orders ---
function getWorkOrder(date, workerId) {
  const r = all('SELECT text FROM work_orders WHERE date=? AND worker_id=?', [date, workerId]);
  return r.length ? r[0].text : '';
}
function setWorkOrder(date, workerId, text) {
  run('INSERT INTO work_orders(date,worker_id,text) VALUES(?,?,?) ON CONFLICT(date,worker_id) DO UPDATE SET text=excluded.text', [date, workerId, text]);
}
function getWorkOrdersForDate(date) {
  return all('SELECT * FROM work_orders WHERE date=?', [date]);
}

module.exports = {
  init, save, getSetting, setSetting,
  generateRecoveryCodes, getRecoveryStatus, checkRecoveryCode,
  getSkills, addSkill, updateSkill, deleteSkill,
  getWorkers, addWorker, updateWorker, deleteWorker,
  getLocations, addLocation, updateLocation, deleteLocation,
  getScheduleRange, getLocks, writeSchedule, setManual, removeAssignment, getCounts,
  getWorkOrder, setWorkOrder, getWorkOrdersForDate,
};
