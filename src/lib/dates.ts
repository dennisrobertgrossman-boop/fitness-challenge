import type { DayKey } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const WEEKDAYS_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDayKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromDayKey(key);
  return toDayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}

/** Monday-based weekday index, 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key: DayKey): number {
  return (fromDayKey(key).getDay() + 6) % 7;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key));
}

export function dayRange(start: DayKey, end: DayKey): DayKey[] {
  const out: DayKey[] = [];
  let k = start;
  while (k <= end) {
    out.push(k);
    k = addDays(k, 1);
  }
  return out;
}

/** The last `n` days ending at (and including) `end`. */
export function lastNDays(n: number, end: DayKey = todayKey()): DayKey[] {
  return dayRange(addDays(end, -(n - 1)), end);
}

/** Monday keys for the last `n` weeks, oldest first, including the current week. */
export function lastNWeeks(n: number, end: DayKey = todayKey()): DayKey[] {
  const current = startOfWeek(end);
  return Array.from({ length: n }, (_, i) => addDays(current, -7 * (n - 1 - i)));
}

export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((fromDayKey(b).getTime() - fromDayKey(a).getTime()) / 86400000);
}

export function formatDay(key: DayKey, style: 'short' | 'long' | 'weekday' = 'short'): string {
  const d = fromDayKey(key);
  if (style === 'weekday') return WEEKDAYS_SHORT[weekdayIndex(key)];
  if (style === 'long') return `${WEEKDAYS_SHORT[weekdayIndex(key)]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatWeek(monday: DayKey): string {
  const sunday = addDays(monday, 6);
  const a = fromDayKey(monday);
  const b = fromDayKey(sunday);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]}`;
  return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}`;
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function relativeDay(key: DayKey, today: DayKey = todayKey()): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return WEEKDAYS_SHORT[weekdayIndex(key)];
  return formatDay(key);
}

export function isoToDayKey(iso: string): DayKey {
  return toDayKey(new Date(iso));
}
