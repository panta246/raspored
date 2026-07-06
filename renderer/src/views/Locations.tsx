import React, { useState } from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import { useUI, ModalHeader, ModalBody, ModalFooter, Field } from '../components/ui';
import type { Location, RequiredSkill, Skill } from '../types';

export default function LocationsView() {
  const { locations, skills, reload, skillName } = useData();
  const { toast, showModal, closeModal } = useUI();

  const openForm = (l: Location | null) => showModal(
    <LocationForm location={l} skills={skills} defaultOrder={locations.length + 1}
      onSaved={async () => { await reload(); toast('Sačuvano.', 'ok'); closeModal(); }} onCancel={closeModal} />
  );
  const remove = async (l: Location) => {
    if (window.confirm(`Obrisati lokaciju "${l.name}"?`)) { await api.locations.remove(l.id); await reload(); toast('Obrisano.', 'ok'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold tracking-tight">Lokacije</div>
          <div className="text-mut text-sm mt-1">Minimum/maksimum radnika i tražene vještine po lokaciji</div>
        </div>
        <button className="btn btn-primary" onClick={() => openForm(null)}>+ Nova lokacija</button>
      </div>

      <div className="card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-mut2">
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Naziv</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Min</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Max</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Tražene vještine</th>
              <th className="px-3.5 py-3 border-b border-bd"></th>
            </tr>
          </thead>
          <tbody>
            {locations.length === 0 && (
              <tr><td colSpan={5} className="px-3.5 py-12 text-center text-mut">Nema lokacija.</td></tr>
            )}
            {locations.map((l) => (
              <tr key={l.id} className="hover:bg-panel2">
                <td className="px-3.5 py-3 border-b border-bd"><b>{l.name}</b></td>
                <td className="px-3.5 py-3 border-b border-bd tabular-nums">{l.min}</td>
                <td className="px-3.5 py-3 border-b border-bd tabular-nums">{l.max || '∞'}</td>
                <td className="px-3.5 py-3 border-b border-bd">
                  {l.requiredSkills.length ? l.requiredSkills.map((r) => (
                    <span key={r.skillId} className="tag tag-skill mr-1">{skillName(r.skillId)}{r.count > 1 ? `×${r.count}` : ''}</span>
                  )) : <span className="text-mut">—</span>}
                </td>
                <td className="px-3.5 py-3 border-b border-bd text-right whitespace-nowrap">
                  <button className="btn btn-sm mr-1.5" onClick={() => openForm(l)}>Uredi</button>
                  <button className="btn btn-sm btn-danger" onClick={() => remove(l)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LocationForm({ location, skills, defaultOrder, onSaved, onCancel }: {
  location: Location | null; skills: Skill[]; defaultOrder: number; onSaved: () => void; onCancel: () => void;
}) {
  const isNew = !location;
  const [name, setName] = useState(location?.name ?? '');
  const [min, setMin] = useState(location?.min ?? 1);
  const [max, setMax] = useState(location?.max ?? 0);
  const [order, setOrder] = useState(location?.order ?? defaultOrder);
  const init: Record<number, number> = {};
  (location?.requiredSkills ?? []).forEach((r) => { init[r.skillId] = r.count; });
  const [req, setReq] = useState<Record<number, number>>(init);

  const toggle = (id: number) => setReq((r) => {
    const c = { ...r };
    if (id in c) delete c[id]; else c[id] = 1;
    return c;
  });
  const setCount = (id: number, n: number) => setReq((r) => ({ ...r, [id]: Math.max(1, n || 1) }));

  const save = async () => {
    if (!name.trim()) return;
    const requiredSkills: RequiredSkill[] = Object.entries(req).map(([sid, cnt]) => ({ skillId: Number(sid), count: cnt }));
    const data: Partial<Location> = { id: location?.id, name: name.trim(), min: Number(min), max: Number(max), order: Number(order), requiredSkills };
    if (isNew) await api.locations.add(data); else await api.locations.update(data);
    onSaved();
  };

  return (
    <>
      <ModalHeader title={isNew ? 'Nova lokacija' : 'Uredi lokaciju'} onClose={onCancel} />
      <ModalBody>
        <Field label="Naziv lokacije"><input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Minimum radnika"><input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value))} /></Field>
          <Field label="Maksimum (0 = bez)"><input type="number" min={0} value={max} onChange={(e) => setMax(Number(e.target.value))} /></Field>
          <Field label="Redoslijed"><input type="number" min={0} value={order} onChange={(e) => setOrder(Number(e.target.value))} /></Field>
        </div>
        <Field label="Tražene vještine (i koliko radnika mora imati)">
          {skills.length === 0 ? <span className="text-mut text-sm">Nema vještina.</span> : (
            <div className="flex flex-col gap-2">
              {skills.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5">
                  <label className="flex items-center gap-2 flex-1 px-2.5 py-1.5 bg-panel2 border border-bd rounded-md text-sm cursor-pointer">
                    <input type="checkbox" className="accent-acc w-auto" checked={s.id in req} onChange={() => toggle(s.id)} />
                    {s.name}
                  </label>
                  <input type="number" min={1} value={req[s.id] ?? 1} disabled={!(s.id in req)}
                    onChange={(e) => setCount(s.id, Number(e.target.value))}
                    className="w-16 px-2 py-2 disabled:opacity-40" />
                </div>
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
