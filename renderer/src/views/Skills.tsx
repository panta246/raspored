import React from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import { useUI } from '../components/ui';

export default function SkillsView() {
  const { skills, workers, reload } = useData();
  const { toast } = useUI();

  const add = async () => {
    const n = window.prompt('Naziv nove vještine:');
    if (n && n.trim()) { await api.skills.add(n.trim()); await reload(); toast('Dodano.', 'ok'); }
  };
  const rename = async (id: number, current: string) => {
    const n = window.prompt('Novi naziv:', current);
    if (n && n.trim()) { await api.skills.update(id, n.trim()); await reload(); toast('Sačuvano.', 'ok'); }
  };
  const remove = async (id: number, name: string) => {
    if (window.confirm(`Obrisati vještinu "${name}"? Uklanja se sa radnika i lokacija.`)) {
      await api.skills.remove(id); await reload(); toast('Obrisano.', 'ok');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-bold tracking-tight">Vještine i osobine</div>
          <div className="text-mut text-sm mt-1">Npr. šef smjene, strani jezik, vozač, pilot… Koriste se kao uslovi na lokacijama.</div>
        </div>
        <button className="btn btn-primary" onClick={add}>+ Nova vještina</button>
      </div>

      <div className="card">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-mut2">
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Naziv</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Koristi</th>
              <th className="px-3.5 py-3 border-b border-bd"></th>
            </tr>
          </thead>
          <tbody>
            {skills.length === 0 && (
              <tr><td colSpan={3} className="px-3.5 py-12 text-center text-mut">Nema vještina.</td></tr>
            )}
            {skills.map((s) => {
              const used = workers.filter((w) => w.skills.includes(s.id)).length;
              return (
                <tr key={s.id} className="hover:bg-panel2">
                  <td className="px-3.5 py-3 border-b border-bd"><b>{s.name}</b></td>
                  <td className="px-3.5 py-3 border-b border-bd text-mut">{used} radnik(a)</td>
                  <td className="px-3.5 py-3 border-b border-bd text-right">
                    <button className="btn btn-sm mr-1.5" onClick={() => rename(s.id, s.name)}>Preimenuj</button>
                    <button className="btn btn-sm btn-danger" onClick={() => remove(s.id, s.name)}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
