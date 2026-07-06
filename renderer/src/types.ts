export type GroupColor = 'crvena' | 'zelena' | 'plava' | 'ljubicasta';
export type Shift = 'PRVA' | 'DRUGA';
export type WorkerStatus = 'aktivan' | 'bolovanje' | 'odmor';

export interface Skill {
  id: number;
  name: string;
}

export interface Worker {
  id: number;
  name: string;
  group: GroupColor;
  active: boolean;
  status: WorkerStatus;
  statusFrom: string | null;
  statusTo: string | null;
  skills: number[];
}

export interface RequiredSkill {
  skillId: number;
  count: number;
}

export interface Location {
  id: number;
  name: string;
  min: number;
  max: number;
  order: number;
  requiredSkills: RequiredSkill[];
}

export interface ScheduleRow {
  date: string;
  shift: Shift;
  location_id: number;
  worker_id: number;
  locked: number;
}

export type Counts = Record<number, Record<number, number>>;

export interface ScheduleData {
  rows: ScheduleRow[];
  counts: Counts;
}

export interface GenerateResult {
  warnings: string[];
  days: number;
}

export interface Api {
  auth: {
    check: (pin: string) => Promise<{ ok: boolean; firstRun?: boolean; viaRecovery?: boolean }>;
    setPin: (pin: string) => Promise<boolean>;
    hasPin: () => Promise<boolean>;
    generateRecoveryCodes: () => Promise<string[]>;
    recoveryStatus: () => Promise<{ total: number; remaining: number }>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<boolean>;
  };
  skills: {
    list: () => Promise<Skill[]>;
    add: (name: string) => Promise<number>;
    update: (id: number, name: string) => Promise<boolean>;
    remove: (id: number) => Promise<boolean>;
  };
  workers: {
    list: () => Promise<Worker[]>;
    add: (w: Partial<Worker>) => Promise<number>;
    update: (w: Partial<Worker>) => Promise<boolean>;
    remove: (id: number) => Promise<boolean>;
  };
  locations: {
    list: () => Promise<Location[]>;
    add: (l: Partial<Location>) => Promise<number>;
    update: (l: Partial<Location>) => Promise<boolean>;
    remove: (id: number) => Promise<boolean>;
  };
  schedule: {
    generate: (start: string, days: number) => Promise<GenerateResult>;
    get: (start: string, end: string) => Promise<ScheduleData>;
    setManual: (date: string, shift: Shift, loc: number, worker: number) => Promise<boolean>;
    remove: (date: string, shift: Shift, loc: number, worker: number) => Promise<boolean>;
    available: (date: string, shift: Shift) => Promise<Worker[]>;
  };
  orders: {
    get: (date: string, worker: number) => Promise<string>;
    set: (date: string, worker: number, text: string) => Promise<boolean>;
    forDate: (date: string) => Promise<{ date: string; worker_id: number; text: string }[]>;
  };
  pdf: {
    export: (html: string, name: string) => Promise<{ ok: boolean; path?: string }>;
  };
}

declare global {
  interface Window {
    api?: Api;
  }
}
