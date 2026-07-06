import React, { useState } from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import { useUI, ModalHeader, ModalBody, ModalFooter, Field } from '../components/ui';
import { GROUPS } from '../lib/schedule';
import type { Worker, GroupColor, WorkerStatus, Sex } from '../types';

const groupDot: Record<GroupColor, string> = {
  crvena: 'bg-crvena', zelena: 'bg-zelena', plava: 'bg-plava', ljubicasta: 'bg-ljubicasta',
};

const sexLabel: Record<Sex, string> = { M: 'Muški', Z: 'Ženski' };

function statusBadge(w: Worker) {
  if (w.status === 'aktivan') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#16331f] text-[#5fd699] border border-[#245236]">aktivan</span>;
  if (w.status === 'bolovanje') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#3a1c1e] text-[#ff9499] border border-[#5e2a2d]">bolovanje</span>;
  return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#3a2f12] text-[#f0c75a] border border-[#5c4a1e]">odmor</span>;
}

export default function WorkersView() {
  const { workers, skills, reload, skillName } = useData();
  const { toast, showModal, closeModal } = useUI();

  const openForm = (w: Worker | null) => showModal(
    <WorkerForm worker={w} skills={skills} onSaved={async () => { await reload(); toast('Sačuvano.', 'ok'); closeModal(); }} onCancel={closeModal} />
  );

  const remove = async (w: Worker) => {
    if (window.confirm(`Obrisati radnika "${w.name}"? Ovo briše i njegove postavke u rasporedu.`)) {
      await api.workers.remove(w.id); await reload(); toast('Radnik obrisan.', 'ok');
    }
  };

  const counts = GROUPS.map((g) => workers.filter((w) => w.group === g).length);
  const maleCount = workers.filter((w) => w.sex === 'M').length;
  const femaleCount = workers.filter((w) => w.sex === 'Z').length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold tracking-tight">Radnici</div>
          <div className="text-mut text-sm mt-1">
            Ukupno {workers.length} • po grupama: {GROUPS.map((g, i) => `${g} ${counts[i]}`).join(' · ')}
            {' '}• muški {maleCount} · ženski {femaleCount}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ Novi radnik</button>
      </div>

      <div className="card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-mut2">
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Ime</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Pol</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Grupa</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Status</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Vještine</th>
              <th className="px-3.5 py-3 border-b border-bd"></th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr><td colSpan={6} className="px-3.5 py-12 text-center text-mut">Nema radnika. Dodajte prvog.</td></tr>
            )}
            {workers.map((w) => (
              <tr key={w.id} className="hover:bg-panel2">
                <td className="px-3.5 py-3 border-b border-bd"><b>{w.name}</b></td>
                <td className="px-3.5 py-3 border-b border-bd">{sexLabel[w.sex]}</td>
                <td className="px-3.5 py-3 border-b border-bd">
                  <span className="chip"><span className={`dot ${groupDot[w.group]}`} />{w.group}</span>
                </td>
                <td className="px-3.5 py-3 border-b border-bd">
                  {statusBadge(w)}
                  {(w.statusFrom || w.statusTo) && (
                    <span className="text-mut text-[11px] ml-1">{w.statusFrom || ''}→{w.statusTo || ''}</span>
                  )}
                </td>
                <td className="px-3.5 py-3 border-b border-bd">
                  {w.skills.length ? w.skills.map((s) => <span key={s} className="tag tag-skill mr-1">{skillName(s)}</span>) : <span className="text-mut">—</span>}
                </td>
                <td className="px-3.5 py-3 border-b border-bd text-right whitespace-nowrap">
                  <button className="btn btn-sm mr-1.5" onClick={() => openForm(w)}>Uredi</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(w)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkerForm({ worker, skills, onSaved, onCancel }: {
  worker: Worker | null;
  skills: { id: number; name: string }[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isNew = !worker;
  const [name, setName] = useState(worker?.name ?? '');
  const [sex, setSex] = useState<Sex>(worker?.sex ?? 'M');
  const [group, setGroup] = useState<GroupColor>(worker?.group ?? 'crvena');
  const [status, setStatus] = useState<WorkerStatus>(worker?.status ?? 'aktivan');
  const [from, setFrom] = useState(worker?.statusFrom ?? '');
  const [to, setTo] = useState(worker?.statusTo ?? '');
  const [sel, setSel] = useState<number[]>(worker?.skills ?? []);

  const toggleSkill = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    if (!name.trim()) return;
    const data: Partial<Worker> = {
      id: worker?.id, name: name.trim(), sex, group, status,
      statusFrom: from || null, statusTo: to || null, skills: sel, active: true,
    };
    if (isNew) await api.workers.add(data); else await api.workers.update(data);
    onSaved();
  };

  return (
    <>
      <ModalHeader title={isNew ? 'Novi radnik' : 'Uredi radnika'} onClose={onCancel} />
      <ModalBody>
        <Field label="Ime i prezime">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        <Field label="Pol">
          <div className="flex gap-2">
            {(['M', 'Z'] as Sex[]).map((s) => (
              <button key={s} onClick={() => setSex(s)}
                className={`px-3 py-2 rounded-lg border text-sm ${sex === s ? 'border-acc bg-panel3' : 'border-bd2 bg-panel2'}`}>
                {sexLabel[s]}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Grupa (boja rotacije)">
          <div className="flex gap-2 flex-wrap">
            {GROUPS.map((g) => (
              <button key={g} onClick={() => setGroup(g)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm capitalize ${group === g ? 'border-acc bg-panel3' : 'border-bd2 bg-panel2'}`}>
                <span className={`dot ${groupDot[g]}`} />{g}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as WorkerStatus)}>
              <option value="aktivan">Aktivan</option>
              <option value="bolovanje">Bolovanje</option>
              <option value="odmor">Odmor</option>
            </select>
          </Field>
          <Field label="Od (opcionalno)"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Do (opcionalno)"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        </div>
        <Field label="Vještine / osobine">
          {skills.length === 0 ? (
            <span className="text-mut text-sm">Nema definisanih vještina (dodajte ih u kartici Vještine).</span>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {skills.map((s) => (
                <label key={s.id} className="flex items-center gap-2 px-2.5 py-1.5 bg-panel2 border border-bd rounded-md text-sm cursor-pointer">
                  <input type="checkbox" className="accent-acc w-auto" checked={sel.includes(s.id)} onChange={() => toggleSkill(s.id)} />
                  {s.name}
                </label>
              ))}
            </div>
          )}
        </Field>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={onCancel}>Otkaži</button>
        <button className="btn btn-primary" onClick={save}>Sačuvaj</button>
      </ModalFooter>
    </>
  );
}
