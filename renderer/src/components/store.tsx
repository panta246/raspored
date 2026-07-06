import React, { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { isoToday } from '../lib/schedule';
import type { Worker, Location, Skill } from '../types';

interface Store {
  workers: Worker[];
  locations: Location[];
  skills: Skill[];
  anchor: string;
  loading: boolean;
  reload: () => Promise<void>;
  skillName: (id: number) => string;
  workerById: (id: number) => Worker | undefined;
  locById: (id: number) => Location | undefined;
}

const Ctx = createContext<Store | null>(null);

export function useData(): Store {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData mora biti unutar DataProvider');
  return c;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [anchor, setAnchor] = useState<string>(isoToday());
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [sk, w, l, a] = await Promise.all([
      api.skills.list(), api.workers.list(), api.locations.list(), api.settings.get('anchor'),
    ]);
    setSkills(sk); setWorkers(w); setLocations(l); setAnchor(a || isoToday());
  }, []);

  useEffect(() => {
    (async () => { try { await reload(); } finally { setLoading(false); } })();
  }, [reload]);

  const skillName = useCallback((id: number) => skills.find((s) => s.id === id)?.name ?? '?', [skills]);
  const workerById = useCallback((id: number) => workers.find((w) => w.id === id), [workers]);
  const locById = useCallback((id: number) => locations.find((l) => l.id === id), [locations]);

  return (
    <Ctx.Provider value={{ workers, locations, skills, anchor, loading, reload, skillName, workerById, locById }}>
      {children}
    </Ctx.Provider>
  );
}
