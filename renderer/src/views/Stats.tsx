import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useData } from '../components/store';
import type { Counts, GroupColor } from '../types';

const groupDot: Record<GroupColor, string> = {
  crvena: 'bg-crvena', zelena: 'bg-zelena', plava: 'bg-plava', ljubicasta: 'bg-ljubicasta',
};

export default function StatsView() {
  const { workers, locations } = useData();
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    (async () => {
      const res = await api.schedule.get('2000-01-01', '2999-12-31');
      setCounts(res.counts);
    })();
  }, []);

  const totalAssign = Object.values(counts).reduce((a, c) => a + Object.values(c).reduce((x, y) => x + y, 0), 0);

  return (
    <div>
      <div className="mb-5">
        <div className="text-2xl font-bold tracking-tight">Statistika</div>
        <div className="text-mut text-sm mt-1">Koliko je puta svaki radnik bio na kojoj lokaciji</div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 mb-5">
        {[['Radnika', workers.length], ['Lokacija', locations.length], ['Ukupno postavki', totalAssign]].map(([lab, n]) => (
          <div key={lab} className="card px-4 py-3.5">
            <div className="text-2xl font-bold tabular-nums">{n as number}</div>
            <div className="text-xs text-mut mt-0.5">{lab as string}</div>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-mut2">
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Radnik</th>
              <th className="px-3.5 py-3 border-b border-bd font-semibold">Grupa</th>
              {locations.map((l) => <th key={l.id} className="px-3.5 py-3 border-b border-bd font-semibold text-center">{l.name}</th>)}
              <th className="px-3.5 py-3 border-b border-bd font-semibold text-center">Ukupno</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr><td colSpan={locations.length + 3} className="px-3.5 py-12 text-center text-mut">Nema podataka. Generišite raspored.</td></tr>
            )}
            {workers.map((w) => {
              const c = counts[w.id] || {};
              let total = 0;
              return (
                <tr key={w.id} className="hover:bg-panel2">
                  <td className="px-3.5 py-3 border-b border-bd"><b>{w.name}</b></td>
                  <td className="px-3.5 py-3 border-b border-bd">
                    <span className="chip"><span className={`dot ${groupDot[w.group]}`} />{w.group}</span>
                  </td>
                  {locations.map((l) => {
                    const n = c[l.id] || 0; total += n;
                    return <td key={l.id} className="px-3.5 py-3 border-b border-bd text-center tabular-nums">{n || '·'}</td>;
                  })}
                  <td className="px-3.5 py-3 border-b border-bd text-center tabular-nums"><b>{total}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
