/*
 * scheduler.js — motor rasporeda (čista logika, bez UI i bez baze)
 *
 * Pravilo rotacije smjena (po radniku): PRVA -> DRUGA -> ODMOR -> ODMOR -> ...
 * Ciklus traje 4 dana. Radnik je podijeljen u jednu od 4 grupe (boje).
 * Svaka grupa je fazno pomjerena za 1 dan, pa svaki dan:
 *   - tačno jedna grupa radi PRVU smjenu
 *   - tačno jedna grupa radi DRUGU smjenu
 *   - dvije grupe odmaraju
 *
 * Fazni obrazac po danu d za grupu g:  PATTERN[(d - g) mod 4]
 * PATTERN = [PRVA, DRUGA, ODMOR, ODMOR]
 */

const PATTERN = ['PRVA', 'DRUGA', 'ODMOR', 'ODMOR'];

// Redoslijed grupa određuje fazu. Indeks 0..3.
const GROUP_ORDER = ['crvena', 'zelena', 'plava', 'ljubicasta'];

function mod(n, m) {
  return ((n % m) + m) % m;
}

// Broj dana između dva datuma (YYYY-MM-DD) — koristi se za fazu ciklusa.
function daysBetween(fromISO, toISO) {
  const a = Date.parse(fromISO + 'T00:00:00Z');
  const b = Date.parse(toISO + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Koju smjenu radi data grupa na dati dan (u odnosu na anchor/početni datum)
function shiftForGroup(groupColor, dateISO, anchorISO) {
  const g = GROUP_ORDER.indexOf(groupColor);
  if (g < 0) return 'ODMOR';
  const d = daysBetween(anchorISO, dateISO);
  return PATTERN[mod(d - g, 4)];
}

// Da li je radnik odsutan (bolovanje/odmor) na dati datum.
function isAbsent(worker, dateISO) {
  if (!worker.status || worker.status === 'aktivan') return false;
  const from = worker.statusFrom || null;
  const to = worker.statusTo || null;
  if (from && dateISO < from) return false;
  if (to && dateISO > to) return false;
  // status bolovanje/odmor i datum unutar (ili bez) opsega -> odsutan
  return worker.status === 'bolovanje' || worker.status === 'odmor';
}

function workerHasSkill(worker, skillId) {
  return Array.isArray(worker.skills) && worker.skills.includes(skillId);
}

/*
 * Glavna funkcija: generiše raspored za jedan dan i jednu smjenu.
 *
 * Ulaz:
 *   workers      - svi radnici [{id,name,group,status,statusFrom,statusTo,skills:[skillId]}]
 *   locations    - [{id,name,min,max,order,requiredSkills:[{skillId,count}]}]
 *   dateISO      - datum
 *   shift        - 'PRVA' | 'DRUGA'
 *   anchorISO    - referentni datum za fazu ciklusa
 *   counts       - {workerId: {locationId: brojDosadasnjihPostavki}} za fer rotaciju
 *   locks        - {locationId: [workerId,...]} ručno zaključani radnici za ovaj dan/smjenu
 *
 * Izlaz:
 *   { assignments: {locationId: [workerId,...]}, reserve: [workerId,...], warnings: [str] }
 */
function generateShift(workers, locations, dateISO, shift, anchorISO, counts, locks) {
  counts = counts || {};
  locks = locks || {};
  const warnings = [];

  // 1) Ko je danas u ovoj smjeni: pripadnici grupe čija je smjena == shift, i nisu odsutni.
  const pool = workers.filter(w =>
    w.active !== false &&
    shiftForGroup(w.group, dateISO, anchorISO) === shift &&
    !isAbsent(w, dateISO)
  );

  const assignments = {};
  const usedIds = new Set();

  // Pomoćno: prebroj koliko je radnik bio na lokaciji (za rotaciju)
  const timesAt = (wid, lid) => (counts[wid] && counts[wid][lid]) || 0;

  // Sortiraj lokacije po redoslijedu
  const locs = [...locations].sort((a, b) => (a.order || 0) - (b.order || 0));

  // 2) Prvo ispoštuj ručne zaključane (locks)
  for (const loc of locs) {
    assignments[loc.id] = [];
    const locked = locks[loc.id] || [];
    for (const wid of locked) {
      const w = pool.find(x => x.id === wid);
      if (w && !usedIds.has(wid)) {
        assignments[loc.id].push(wid);
        usedIds.add(wid);
      }
    }
  }

  // 3) Lokacije sa traženim vještinama prve (teže ih je popuniti)
  const needsSkill = locs.filter(l => (l.requiredSkills || []).length > 0);
  const others = locs.filter(l => (l.requiredSkills || []).length === 0);

  function pickBest(candidates, locId) {
    // najmanje puta bio na lokaciji -> fer rotacija; uz lagani tie-break po ukupnom radu
    let best = null, bestScore = Infinity;
    for (const w of candidates) {
      if (usedIds.has(w.id)) continue;
      const total = Object.values(counts[w.id] || {}).reduce((a, b) => a + b, 0);
      const score = timesAt(w.id, locId) * 1000 + total;
      if (score < bestScore) { bestScore = score; best = w; }
    }
    return best;
  }

  // 3a) Zadovolji tražene vještine po lokaciji
  for (const loc of needsSkill) {
    for (const req of (loc.requiredSkills || [])) {
      const have = assignments[loc.id].filter(wid => {
        const w = pool.find(x => x.id === wid);
        return w && workerHasSkill(w, req.skillId);
      }).length;
      let need = (req.count || 1) - have;
      while (need > 0) {
        const cand = pool.filter(w => !usedIds.has(w.id) && workerHasSkill(w, req.skillId));
        const pick = pickBest(cand, loc.id);
        if (!pick) {
          warnings.push(`Nema dovoljno radnika sa traženom vještinom za "${loc.name}" (${shift}, ${dateISO}).`);
          break;
        }
        assignments[loc.id].push(pick.id);
        usedIds.add(pick.id);
        need--;
      }
    }
  }

  // 4) Popuni MINIMUM na svim lokacijama
  for (const loc of locs) {
    while (assignments[loc.id].length < (loc.min || 1)) {
      const cand = pool.filter(w => !usedIds.has(w.id));
      const pick = pickBest(cand, loc.id);
      if (!pick) {
        warnings.push(`Nedovoljno radnika za minimum na "${loc.name}" (${shift}, ${dateISO}). Fali ${(loc.min||1) - assignments[loc.id].length}.`);
        break;
      }
      assignments[loc.id].push(pick.id);
      usedIds.add(pick.id);
    }
  }

  // 5) Raspodijeli preostale radnike do MAKSIMUMA (ravnomjerno), ostalo ide u rezervu
  let remaining = pool.filter(w => !usedIds.has(w.id));
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    // lokacija sa najviše slobodnog prostora prva
    const open = locs
      .filter(l => {
        const max = (l.max && l.max > 0) ? l.max : Infinity;
        return assignments[l.id].length < max;
      })
      .sort((a, b) => assignments[a.id].length - assignments[b.id].length);
    for (const loc of open) {
      const max = (loc.max && loc.max > 0) ? loc.max : Infinity;
      if (assignments[loc.id].length >= max) continue;
      const pick = pickBest(remaining, loc.id);
      if (!pick) break;
      assignments[loc.id].push(pick.id);
      usedIds.add(pick.id);
      remaining = remaining.filter(w => w.id !== pick.id);
      progress = true;
    }
  }

  const reserve = remaining.map(w => w.id);
  return { assignments, reserve, warnings };
}

/*
 * Generiše raspored za N dana unaprijed.
 * Vraća listu dana: [{date, shifts:{PRVA:{...}, DRUGA:{...}}}]
 * counts se ažurira kroz dane radi fer rotacije.
 * existingLocks: {"date|shift|locationId": [workerId]} ručni override-ovi koji se poštuju.
 */
function generateRange(workers, locations, startISO, days, anchorISO, startCounts, existingLocks) {
  const counts = JSON.parse(JSON.stringify(startCounts || {}));
  existingLocks = existingLocks || {};
  const result = [];
  const allWarnings = [];

  for (let i = 0; i < days; i++) {
    const date = addDaysISO(startISO, i);
    const dayObj = { date, shifts: {} };

    for (const shift of ['PRVA', 'DRUGA']) {
      const locks = {};
      for (const loc of locations) {
        const key = `${date}|${shift}|${loc.id}`;
        if (existingLocks[key]) locks[loc.id] = existingLocks[key];
      }
      const res = generateShift(workers, locations, date, shift, anchorISO, counts, locks);
      dayObj.shifts[shift] = res.assignments;
      res.warnings.forEach(w => allWarnings.push(w));

      // ažuriraj counts
      for (const lid of Object.keys(res.assignments)) {
        for (const wid of res.assignments[lid]) {
          counts[wid] = counts[wid] || {};
          counts[wid][lid] = (counts[wid][lid] || 0) + 1;
        }
      }
    }
    result.push(dayObj);
  }
  return { days: result, counts, warnings: allWarnings };
}

module.exports = {
  PATTERN, GROUP_ORDER,
  shiftForGroup, isAbsent, daysBetween, addDaysISO,
  generateShift, generateRange,
};
