import type { DailyMap, DailyMetric, DayKey, Member, MetricKey, Workout, WorkoutType } from '../types';
import { addDays, dayRange, isoToDayKey, startOfWeek, todayKey } from './dates';

/** Workouts grouped by member and day: index[memberId][dayKey] = Workout[] */
export type WorkoutIndex = Record<string, Record<DayKey, Workout[]>>;

export function indexWorkouts(workouts: Workout[]): WorkoutIndex {
  const idx: WorkoutIndex = {};
  for (const w of workouts) {
    const day = isoToDayKey(w.start);
    const byDay = (idx[w.memberId] ??= {});
    (byDay[day] ??= []).push(w);
  }
  return idx;
}

export interface DataView {
  daily: DailyMap;
  index: WorkoutIndex;
}

export function dayValue(view: DataView, memberId: string, day: DayKey, metric: MetricKey): number {
  if (metric === 'workouts') return view.index[memberId]?.[day]?.length ?? 0;
  const d: DailyMetric | undefined = view.daily[memberId]?.[day];
  return d ? d[metric] : 0;
}

export function sumRange(view: DataView, memberId: string, days: DayKey[], metric: MetricKey): number {
  return days.reduce((s, d) => s + dayValue(view, memberId, d, metric), 0);
}

export function dailySeries(view: DataView, memberId: string, days: DayKey[], metric: MetricKey): number[] {
  return days.map((d) => dayValue(view, memberId, d, metric));
}

/** Weekly totals for each Monday in `weeks` (sum of 7 days, clipped to today). */
export function weeklySeries(view: DataView, memberId: string, weeks: DayKey[], metric: MetricKey): number[] {
  const today = todayKey();
  return weeks.map((monday) => {
    const end = addDays(monday, 6);
    return sumRange(view, memberId, dayRange(monday, end < today ? end : today), metric);
  });
}

export function weekDays(monday: DayKey): DayKey[] {
  return dayRange(monday, addDays(monday, 6));
}

export function currentWeekDays(): DayKey[] {
  const today = todayKey();
  return dayRange(startOfWeek(today), today);
}

export function workoutsBetween(view: DataView, memberId: string, days: DayKey[]): Workout[] {
  const out: Workout[] = [];
  for (const d of days) out.push(...(view.index[memberId]?.[d] ?? []));
  return out;
}

/** Consecutive days (ending today, or yesterday if today isn't done yet) meeting a predicate. */
export function streak(view: DataView, memberId: string, meets: (day: DayKey) => boolean): number {
  const today = todayKey();
  let day = meets(today) ? today : addDays(today, -1);
  let n = 0;
  while (meets(day) && n < 3650) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}

export function stepGoalStreak(view: DataView, member: Member): number {
  return streak(view, member.id, (d) => dayValue(view, member.id, d, 'steps') >= member.goals.steps);
}

/** Consecutive full weeks (before the current one) hitting the weekly workout goal, plus this week if already hit. */
export function workoutWeekStreak(view: DataView, member: Member): number {
  const today = todayKey();
  let monday = startOfWeek(today);
  const hit = (m: DayKey) => sumRange(view, member.id, weekDays(m), 'workouts') >= member.goals.workoutsPerWeek;
  let n = hit(monday) ? 1 : 0;
  monday = addDays(monday, -7);
  while (hit(monday) && n < 520) {
    n++;
    monday = addDays(monday, -7);
  }
  return n;
}

export interface PersonalBests {
  maxSteps: { value: number; day?: DayKey };
  maxCardio: { value: number; day?: DayKey };
  longestWorkout?: Workout;
  mostWorkoutsWeek: { value: number; week?: DayKey };
  longestRun?: Workout;
}

export function personalBests(view: DataView, memberId: string, workouts: Workout[]): PersonalBests {
  const days = view.daily[memberId] ?? {};
  const pb: PersonalBests = { maxSteps: { value: 0 }, maxCardio: { value: 0 }, mostWorkoutsWeek: { value: 0 } };
  for (const d of Object.values(days)) {
    if (d.steps > pb.maxSteps.value) pb.maxSteps = { value: d.steps, day: d.date };
    if (d.cardioLoad > pb.maxCardio.value) pb.maxCardio = { value: d.cardioLoad, day: d.date };
  }
  const perWeek: Record<DayKey, number> = {};
  for (const w of workouts) {
    if (w.memberId !== memberId) continue;
    if (!pb.longestWorkout || w.durationMin > pb.longestWorkout.durationMin) pb.longestWorkout = w;
    if (w.type === 'run' && (!pb.longestRun || (w.distanceKm ?? 0) > (pb.longestRun.distanceKm ?? 0))) pb.longestRun = w;
    const wk = startOfWeek(isoToDayKey(w.start));
    perWeek[wk] = (perWeek[wk] ?? 0) + 1;
  }
  for (const [week, value] of Object.entries(perWeek)) {
    if (value > pb.mostWorkoutsWeek.value) pb.mostWorkoutsWeek = { value, week };
  }
  return pb;
}

export function typeBreakdown(workouts: Workout[]): { type: WorkoutType; count: number; minutes: number }[] {
  const map = new Map<WorkoutType, { count: number; minutes: number }>();
  for (const w of workouts) {
    const e = map.get(w.type) ?? { count: 0, minutes: 0 };
    e.count++;
    e.minutes += w.durationMin;
    map.set(w.type, e);
  }
  return [...map.entries()].map(([type, v]) => ({ type, ...v })).sort((a, b) => b.count - a.count);
}

export function average(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

/** Percentage change from previous to current, or null if there is no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}
