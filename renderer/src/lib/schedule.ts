import type { GroupColor, Shift } from '../types';

export const GROUPS: GroupColor[] = ['crvena', 'zelena', 'plava', 'ljubicasta'];
export const PATTERN: (Shift | 'ODMOR')[] = ['PRVA', 'DRUGA', 'ODMOR', 'ODMOR'];

const DOW = ['Nedjelja', 'Ponedjeljak', 'Utorak', 'Srijeda', 'Četvrtak', 'Petak', 'Subota'];
const DOW_S = ['Ned', 'Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub'];
const MON = ['januar', 'februar', 'mart', 'april', 'maj', 'juni', 'juli', 'august', 'septembar', 'oktobar', 'novembar', 'decembar'];

export function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function shiftForGroup(g: GroupColor, dateISO: string, anchorISO: string): Shift | 'ODMOR' {
  const i = GROUPS.indexOf(g);
  if (i < 0) return 'ODMOR';
  return PATTERN[mod(daysBetween(anchorISO, dateISO) - i, 4)];
}
export function dowOf(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();
}
export function dayNum(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDate();
}
export function dowShort(iso: string): string {
  return DOW_S[dowOf(iso)];
}
export function fmtLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${DOW[d.getUTCDay()]}, ${d.getUTCDate()}. ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}.`;
}
export function fmtShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
}
