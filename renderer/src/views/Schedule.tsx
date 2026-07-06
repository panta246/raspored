import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import { useUI, ModalHeader, ModalBody, ModalFooter, Field } from '../components/ui';
import {
  GROUPS, addDays, dayNum, dowOf, dowShort, fmtLong, fmtShort, isoToday, shiftForGroup,
} from '../lib/schedule';
import type { GroupColor, Location, ScheduleData, Shift, Worker } from '../types';

const groupDot: Record<GroupColor, string> = {
  crvena: 'bg-crvena', zelena: 'bg-zelena', plava: 'bg-plava', ljubicasta: 'bg-ljubicasta',
};
const shiftPill: Record<Shift, string> = {
  PRVA: 'bg-[#3a2f0e] text-prva border border-[#5c4a1e]',
  DRUGA: 'bg-[#23264a] text-[#9aa6ff] border border-[#353c6b]',
};
const rotShift: Record<string, string> = {
  PRVA: 'bg-[#3a2f0e] text-prva border border-[#5c4a1e]',
  DRUGA: 'bg-[#23264a] text-[#9aa6ff] border border-[#353c6b]',
  ODMOR: 'bg-panel3 text-mut2 border border-bd2',
};

type Slot = { id: number; locked: number };
type DayMap = Record<Shift, Record<number, Slot[]>>;

export default function ScheduleView() {
  const { workers, locations, anchor, skillName, workerById, locById, reload } = useData();
  const { toast, showModal, closeModal } = useUI();
  const [date, setDate] = useState<string>(isoToday());
  const [data, setData] = useState<ScheduleData>({ rows: [], counts: {} });

  const noData = workers.length === 0 || locations.length === 0;

  const loadSchedule = useCallback(async (center: string) => {
    const res = await api.schedule.get(addDays(center, -1), addDays(center, 28));
    setData(res);
  }, []);

  useEffect(() => { loadSchedule(date); }, [date, loadSchedule]);

  const dayAssignments = (d: string): DayMap => {
    const out: DayMap = { PRVA: {}, DRUGA: {} };
    for (const r of data.rows) {
      if (r.date !== d) continue;
      (out[r.shift][r.location_id] ||= []).push({ id: r.worker_id, locked: r.locked });
    }
    return out;
  };

  const generate28 = async () => {
    if (noData) { toast('Dodajte radnike i lokacije.', 'err'); return; }
    toast('Generišem raspored…');
    const r = await api.schedule.generate(date, 28);
    await loadSchedule(date);
    if (r.warnings.length) {
      const uniq = [...new Set(r.warnings)];
      toast(`Generisano. ${uniq.length} upozorenja.`, 'warn');
      showModal(<WarningsModal list={uniq} onClose={closeModal} />);
    } else toast('Raspored generisan za 28 dana.', 'ok');
  };

  const openWorkerMenu = (wid: number, shift: Shift, locId: number) => {
    const w = workerById(wid); if (!w) return;
    showModal(
      <WorkerMenu w={w} shift={shift} locId={locId} date={date} locations={locations}
        onDone={async () => { await loadSchedule(date); closeModal(); }} onClose={closeModal} toast={toast} />
    );
  };

  const openAdd = (shift: Shift, locId: number) => {
    const a = dayAssignments(date)[shift];
    const used = new Set<number>();
    Object.values(a).forEach((arr) => arr.forEach((o) => used.add(o.id)));
    const loc = locById(locId)!;
    showModal(
      <AddToLocation date={date} shift={shift} loc={loc} used={used} skillName={skillName}
        onDone={async () => { await loadSchedule(date); closeModal(); }} onClose={closeModal} toast={toast} />
    );
  };

  const exportPdf = async () => {
    toast('Pripremam PDF…');
    const days: string[] = [];
    for (let i = 0; i < 28; i++) days.push(addDays(date, i));
    const res = await api.schedule.get(days[0], days[27]);
    const byDay: Record<string, DayMap> = {};
    res.rows.forEach((r) => {
      (byDay[r.date] ||= { PRVA: {}, DRUGA: {} });
      (byDay[r.date][r.shift][r.location_id] ||= []).push({ id: r.worker_id, locked: r.locked });
    });
    const nameOf = (id: number) => workerById(id)?.name ?? '?';
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
    let pages = '';
    for (const d of days) {
      const a = byDay[d] || { PRVA: {}, DRUGA: {} };
      let rows = '';
      for (const shift of ['PRVA', 'DRUGA'] as Shift[]) {
        let cols = '';
        for (const loc of locations) {
          const ids = (a[shift][loc.id] || []).map((o) => o.id);
          cols += `<td class="pl"><div class="pln">${esc(loc.name)} <span class="plc">(${ids.length})</span></div>${ids.map((id) => `<div class="pw">${esc(nameOf(id))}</div>`).join('') || '<div class="pe">—</div>'}</td>`;
        }
        rows += `<tr><td class="psh ${shift}">${shift}</td>${cols}</tr>`;
      }
      pages += `<div class="pday"><div class="pdh">${fmtLong(d)}</div><table class="pt"><thead><tr><th>Smjena</th>${locations.map((l) => `<th>${esc(l.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:14px;font-size:11px}
      h1{font-size:16px;margin:0 0 10px}
      .pday{page-break-inside:avoid;margin-bottom:14px}
      .pdh{font-size:13px;font-weight:bold;background:#1d212c;color:#fff;padding:6px 10px;border-radius:5px}
      .pt{width:100%;border-collapse:collapse;margin-top:5px}
      .pt th{background:#eef1f6;border:1px solid #c8cfdb;padding:5px 6px;text-align:left;font-size:10px}
      .pt td{border:1px solid #d4dae4;padding:5px 6px;vertical-align:top}
      .psh{font-weight:bold;width:64px;text-align:center}
      .psh.PRVA{background:#fbf0d0} .psh.DRUGA{background:#dfe2fb}
      .pln{font-weight:bold;font-size:10px;margin-bottom:3px} .plc{color:#777;font-weight:normal}
      .pw{padding:1px 0;border-bottom:1px dotted #e2e6ee} .pe{color:#aaa}
      .foot{margin-top:6px;color:#888;font-size:9px;text-align:right}
    </style></head><body><h1>Raspored radnika — ${fmtShort(days[0])} do ${fmtShort(days[27])}</h1>${pages}<div class="foot">Generisano aplikacijom Raspored radnika</div></body></html>`;
    const r = await api.pdf.export(html, `raspored_${days[0]}.pdf`);
    if (r.ok) toast('PDF sačuvan.', 'ok'); else toast('Otkazano.');
  };

  const a = dayAssignments(date);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold tracking-tight">Raspored</div>
          <div className="text-mut text-sm mt-1">Smjene 12h • rotacija PRVA → DRUGA → ODMOR → ODMOR</div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn" onClick={generate28}>⟳ Generiši 28 dana</button>
          <button className="btn" onClick={exportPdf}>⬇ PDF</button>
        </div>
      </div>

      {noData && (
        <div className="bg-[#241c0a] border border-[#5c4a1e] rounded-xl px-3.5 py-3 mb-4 text-sm text-[#f0c75a]">
          Dodajte radnike i lokacije prije generisanja rasporeda.
        </div>
      )}

      {/* day strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-2.5 mb-2">
        {Array.from({ length: 28 }, (_, i) => addDays(date, i)).map((di) => {
          const dw = dowOf(di);
          const sel = di === date;
          const weekend = dw === 0 || dw === 6;
          return (
            <button key={di} onClick={() => setDate(di)}
              className={`shrink-0 min-w-[52px] text-center px-2 py-1.5 rounded-lg border ${sel ? 'border-acc bg-panel3' : 'border-bd bg-panel hover:border-bd2'}`}>
              <div className="text-[10.5px] text-mut2 uppercase">{dowShort(di)}</div>
              <div className={`text-base font-bold tabular-nums ${weekend ? 'text-prva' : ''}`}>{dayNum(di)}</div>
            </button>
          );
        })}
      </div>

      {/* day nav */}
      <div className="flex items-center gap-1.5 mb-3.5">
        <button className="btn px-2.5" onClick={() => setDate(addDays(date, -1))}>‹</button>
        <div className="text-lg font-bold min-w-[240px] text-center tracking-tight">{fmtLong(date)}</div>
        <button className="btn px-2.5" onClick={() => setDate(addDays(date, 1))}>›</button>
        <button className="btn btn-sm" onClick={() => setDate(isoToday())}>Danas</button>
      </div>

      {/* rotation strip */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {GROUPS.map((g) => {
          const sh = shiftForGroup(g, date, anchor);
          return (
            <div key={g} className="flex items-center gap-2.5 px-3 py-2 border border-bd rounded-lg bg-panel">
              <span className={`dot ${groupDot[g]}`} />
              <span className="font-semibold text-sm capitalize">{g}</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${rotShift[sh]}`}>{sh}</span>
            </div>
          );
        })}
      </div>

      {/* boards */}
      {(['PRVA', 'DRUGA'] as Shift[]).map((shift) => {
        const grp = GROUPS.find((g) => shiftForGroup(g, date, anchor) === shift);
        return (
          <div key={shift} className="mb-5">
            <div className="flex items-center gap-2.5 mb-2.5">
              <span className="text-[15px] font-bold tracking-tight">{shift === 'PRVA' ? 'Prva smjena' : 'Druga smjena'}</span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded ${shiftPill[shift]}`}>{shift}</span>
              {grp ? <span className="chip"><span className={`dot ${groupDot[grp]}`} />{grp}</span> : <span className="text-mut">(nije generisano)</span>}
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))' }}>
              {locations.map((loc) => (
                <LocationCard key={loc.id} loc={loc} slots={a[shift][loc.id] || []} skillName={skillName} workerById={workerById}
                  onChip={(wid) => openWorkerMenu(wid, shift, loc.id)} onAdd={() => openAdd(shift, loc.id)} />
              ))}
              {locations.length === 0 && <div className="text-mut">Nema lokacija.</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocationCard({ loc, slots, skillName, workerById, onChip, onAdd }: {
  loc: Location; slots: Slot[]; skillName: (id: number) => string;
  workerById: (id: number) => Worker | undefined; onChip: (wid: number) => void; onAdd: () => void;
}) {
  const cnt = slots.length;
  const min = loc.min || 1, max = loc.max || 0;
  let badge = 'bg-[#16331f] text-[#5fd699] border-[#245236]';
  if (cnt < min) badge = 'bg-[#3a1c1e] text-[#ff9499] border-[#5e2a2d]';
  else if (max && cnt > max) badge = 'bg-[#3a2f12] text-[#f0c75a] border-[#5c4a1e]';

  return (
    <div className="bg-panel border border-bd rounded-xl overflow-hidden flex flex-col">
      <div className="px-3 py-2.5 border-b border-bd flex items-center justify-between gap-2">
        <div>
          <div className="font-semibold text-sm">{loc.name}</div>
          <div className="text-mut text-[11px]">
            min {min}{max ? ` • max ${max}` : ''}{' '}
            {loc.requiredSkills.map((r) => <span key={r.skillId} className="tag tag-skill ml-1">{skillName(r.skillId)}{r.count > 1 ? `×${r.count}` : ''}</span>)}
          </div>
        </div>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>{cnt}</span>
      </div>
      <div className="p-2.5 flex flex-col gap-1.5 min-h-[40px]">
        {slots.length === 0 && <div className="text-mut text-xs px-1 py-1.5">— prazno —</div>}
        {slots.map((o) => {
          const w = workerById(o.id);
          if (!w) return null;
          return (
            <button key={o.id} onClick={() => onChip(o.id)}
              className={`flex items-center gap-2 px-2.5 py-1.5 bg-panel2 border border-bd rounded-md text-[13px] text-left hover:border-bd2 hover:bg-panel3 ${o.locked ? 'border-l-[3px] border-l-acc' : ''}`}>
              <span className={`dot ${groupDot[w.group]}`} />
              <span className="flex-1 truncate">{w.name}</span>
              {w.skills.length > 0 && <span className="text-[11px] text-mut">{'★'.repeat(w.skills.length)}</span>}
            </button>
          );
        })}
      </div>
      <button onClick={onAdd} className="mx-2.5 mb-2.5 border border-dashed border-bd2 text-mut rounded-md py-1.5 text-xs hover:border-acc hover:text-tx">
        + Dodaj radnika
      </button>
    </div>
  );
}

function WorkerMenu({ w, shift, locId, date, locations, onDone, onClose, toast }: {
  w: Worker; shift: Shift; locId: number; date: string; locations: Location[];
  onDone: () => void; onClose: () => void; toast: (m: string, t?: 'ok' | 'warn' | 'err' | '') => void;
}) {
  const others = locations.filter((l) => l.id !== locId);
  const [mvLoc, setMvLoc] = useState<number>(others[0]?.id ?? locId);
  const [wo, setWo] = useState('');

  useEffect(() => { (async () => setWo(await api.orders.get(date, w.id)))(); }, [date, w.id]);

  return (
    <>
      <ModalHeader title={w.name} onClose={onClose} />
      <ModalBody>
        <div className="text-mut text-sm flex items-center gap-2">
          {shift} • <span className="chip"><span className={`dot ${groupDot[w.group]}`} />{w.group}</span>
        </div>
        {others.length > 0 && (
          <>
            <Field label="Premjesti na lokaciju">
              <select value={mvLoc} onChange={(e) => setMvLoc(Number(e.target.value))}>
                {others.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
            <button className="btn btn-block" onClick={async () => { await api.schedule.setManual(date, shift, mvLoc, w.id); toast('Premješteno.', 'ok'); onDone(); }}>
              Premjesti ovdje
            </button>
          </>
        )}
        <Field label={`Radni nalog za ovaj dan (${fmtShort(date)})`}>
          <textarea className="min-h-[80px] leading-relaxed" value={wo} onChange={(e) => setWo(e.target.value)} placeholder="Npr. zadatak, zaduženja, napomene…" />
        </Field>
        <button className="btn btn-block" onClick={async () => { await api.orders.set(date, w.id, wo); toast('Radni nalog sačuvan.', 'ok'); onClose(); }}>
          Sačuvaj radni nalog
        </button>
      </ModalBody>
      <ModalFooter>
        <button className="btn btn-danger" onClick={async () => { await api.schedule.remove(date, shift, locId, w.id); toast('Uklonjeno.', 'ok'); onDone(); }}>
          Ukloni iz smjene
        </button>
        <button className="btn" onClick={onClose}>Zatvori</button>
      </ModalFooter>
    </>
  );
}

function AddToLocation({ date, shift, loc, used, skillName, onDone, onClose, toast }: {
  date: string; shift: Shift; loc: Location; used: Set<number>; skillName: (id: number) => string;
  onDone: () => void; onClose: () => void; toast: (m: string, t?: 'ok' | 'warn' | 'err' | '') => void;
}) {
  const [free, setFree] = useState<Worker[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const avail = await api.schedule.available(date, shift);
      setFree(avail.filter((w) => !used.has(w.id)));
    })();
  }, [date, shift, used]);

  const list = free.filter((w) => w.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <ModalHeader title={`Dodaj na ${loc.name} — ${shift}`} onClose={onClose} />
      <ModalBody>
        <div className="text-xs text-mut2">Prikazani su radnici iz grupe koja danas radi {shift} smjenu, a slobodni su.</div>
        <input type="text" placeholder="Traži radnika…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        <div className="flex flex-col gap-1.5 max-h-[46vh] overflow-auto">
          {list.length === 0 && <div className="text-mut text-center py-4">Nema slobodnih radnika za ovu smjenu.</div>}
          {list.map((w) => (
            <button key={w.id} onClick={async () => { await api.schedule.setManual(date, shift, loc.id, w.id); toast('Dodano.', 'ok'); onDone(); }}
              className="flex items-center gap-2 px-2.5 py-1.5 bg-panel2 border border-bd rounded-md text-[13px] text-left hover:border-bd2 hover:bg-panel3">
              <span className={`dot ${groupDot[w.group]}`} />
              <span className="flex-1 truncate">{w.name}</span>
              {w.skills.map((s) => <span key={s} className="tag tag-skill">{skillName(s)}</span>)}
            </button>
          ))}
        </div>
      </ModalBody>
    </>
  );
}

function WarningsModal({ list, onClose }: { list: string[]; onClose: () => void }) {
  return (
    <>
      <ModalHeader title="Upozorenja" onClose={onClose} />
      <ModalBody>
        <div className="bg-[#241c0a] border border-[#5c4a1e] rounded-xl px-3.5 py-3 text-sm text-[#f0c75a]">
          Sistem nije mogao ispuniti sve uslove:
          <ul className="mt-2 pl-4 list-disc">
            {list.slice(0, 40).map((w, i) => <li key={i} className="my-0.5">{w}</li>)}
          </ul>
        </div>
        <div className="text-xs text-mut2 leading-relaxed">
          Najčešći uzrok: premalo radnika u grupi koja danas radi, ili premalo ljudi sa traženom vještinom.
          Riješite dodavanjem radnika, promjenom grupe, ili smanjenjem minimuma.
        </div>
      </ModalBody>
      <ModalFooter>
        <button className="btn btn-primary" onClick={onClose}>U redu</button>
      </ModalFooter>
    </>
  );
}
