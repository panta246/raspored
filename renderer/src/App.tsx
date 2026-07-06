import React, { Component, useState, type ReactNode } from 'react';
import { api, apiAvailable } from './api';
import { DataProvider, useData } from './components/store';
import { UIProvider, useUI } from './components/ui';
import { GROUPS } from './lib/schedule';
import ScheduleView from './views/Schedule';
import WorkersView from './views/Workers';
import LocationsView from './views/Locations';
import SkillsView from './views/Skills';
import StatsView from './views/Stats';
import SettingsView from './views/Settings';
import type { GroupColor } from './types';

type View = 'schedule' | 'workers' | 'locations' | 'skills' | 'stats' | 'settings';

const NAV: { id: View; label: string; icon: string }[] = [
  { id: 'schedule', label: 'Raspored', icon: '▦' },
  { id: 'workers', label: 'Radnici', icon: '☻' },
  { id: 'locations', label: 'Lokacije', icon: '⌖' },
  { id: 'skills', label: 'Vještine', icon: '★' },
  { id: 'stats', label: 'Statistika', icon: '∑' },
  { id: 'settings', label: 'Postavke', icon: '⚙' },
];

const groupDot: Record<GroupColor, string> = {
  crvena: 'bg-crvena', zelena: 'bg-zelena', plava: 'bg-plava', ljubicasta: 'bg-ljubicasta',
};

/* -------- Error boundary: nikad prazan ekran -------- */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('UI ERROR:', error); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center p-6">
          <div className="card max-w-lg p-6">
            <div className="text-xl font-bold text-errc mb-2">Greška u aplikaciji</div>
            <div className="text-mut text-sm mb-3">Došlo je do greške pri prikazu. Detalji:</div>
            <pre className="bg-panel2 border border-bd rounded-lg p-3 text-xs overflow-auto whitespace-pre-wrap">{String(this.state.error?.message || this.state.error)}</pre>
            <button className="btn btn-primary mt-4" onClick={() => location.reload()}>Ponovo učitaj</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------- Login -------- */
function Login({ onOk }: { onOk: (viaRecovery: boolean) => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');

  const go = async () => {
    try {
      const r = await api.auth.check(pin);
      if (r.ok) onOk(!!r.viaRecovery);
      else { setErr('Pogrešna šifra.'); setPin(''); }
    } catch (e) {
      setErr('Greška pri provjeri: ' + String((e as Error).message));
    }
  };

  return (
    <div className="fixed inset-0 grid place-items-center" style={{ background: 'radial-gradient(1200px 600px at 50% -10%, #1a2030 0%, #0f1115 60%)' }}>
      <div className="w-[340px] bg-panel border border-bd rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-4xl text-acc mb-1.5">⬣</div>
        <h1 className="text-xl font-bold mb-1">Raspored radnika</h1>
        <p className="text-mut text-sm">Unesite šifru za pristup</p>
        <input type="password" inputMode="numeric" placeholder="Šifra" autoFocus value={pin}
          onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') go(); }}
          className="w-full my-4 px-3.5 py-3 text-center text-lg tracking-[3px]" />
        <button className="btn btn-primary btn-block" onClick={go}>Otvori</button>
        <div className="text-errc text-sm mt-2.5 min-h-[16px]">{err}</div>
      </div>
    </div>
  );
}

/* -------- Sidebar + shell -------- */
function Shell({ recoveryUsed }: { recoveryUsed: boolean }) {
  const [view, setView] = useState<View>('schedule');
  const { loading } = useData();
  const { toast } = useUI();

  React.useEffect(() => {
    if (recoveryUsed) toast('Ulogovani ste rezervnom (admin) šifrom — postavite novu šifru u Postavkama.', 'warn');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Active = {
    schedule: ScheduleView, workers: WorkersView, locations: LocationsView,
    skills: SkillsView, stats: StatsView, settings: SettingsView,
  }[view];

  return (
    <div className="grid h-screen" style={{ gridTemplateColumns: '212px 1fr' }}>
      <aside className="bg-panel border-r border-bd flex flex-col p-3">
        <div className="text-[17px] font-bold tracking-tight px-2.5 pt-1.5 pb-4 flex items-center gap-2">
          <span className="text-acc text-lg">⬣</span> Raspored
        </div>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setView(n.id)}
              className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${view === n.id ? 'bg-panel3 text-tx' : 'text-mut hover:bg-panel2 hover:text-tx'}`}>
              <span className="w-[18px] text-center opacity-85">{n.icon}</span> {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto px-2.5 pt-3 pb-1 text-[11.5px] text-mut leading-loose">
          Grupe (rotacija):<br />
          {GROUPS.map((g) => (
            <span key={g} className="chip mr-1 mt-1"><span className={`dot ${groupDot[g]}`} />{g}</span>
          ))}
        </div>
      </aside>

      <main className="overflow-auto">
        <div className="p-7 max-w-[1400px]">
          {loading ? <div className="text-mut">Učitavam…</div> : <Active />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [recoveryUsed, setRecoveryUsed] = useState(false);

  React.useEffect(() => {
    if (!apiAvailable) { setCheckingAuth(false); return; }
    (async () => {
      try {
        const has = await api.auth.hasPin();
        if (!has) setAuthed(true); // nema šifre u bazi — preskoči ekran za prijavu
      } catch { /* prikazano niže ako most ne radi */ }
      finally { setCheckingAuth(false); }
    })();
  }, []);

  if (!apiAvailable) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="card max-w-lg p-6">
          <div className="text-xl font-bold text-errc mb-2">Veza sa sistemom nije dostupna</div>
          <div className="text-mut text-sm">
            Aplikacija se otvorila, ali interni most (preload) nije učitan, pa nema pristupa bazi.
            Ovo se dešava ako se renderer otvori van Electrona. Pokrenite aplikaciju sa <b>npm start</b>.
          </div>
        </div>
      </div>
    );
  }

  if (checkingAuth) return null;

  return (
    <ErrorBoundary>
      <UIProvider>
        {authed ? (
          <DataProvider><Shell recoveryUsed={recoveryUsed} /></DataProvider>
        ) : (
          <Login onOk={(viaRecovery) => { setAuthed(true); setRecoveryUsed(viaRecovery); }} />
        )}
      </UIProvider>
    </ErrorBoundary>
  );
}
