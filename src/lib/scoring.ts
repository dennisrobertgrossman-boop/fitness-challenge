import type { Challenge, DayKey, Member } from '../types';
import { addDays, dayRange, startOfWeek, todayKey } from './dates';
import { DataView } from './stats';

/**
 * Challenge points, in the spirit of Apple Fitness competitions:
 *  - Steps:      1 point per 1 % of the shared step target, capped at 200
 *  - Cardio:     1 point per 1 % of the shared Cardio Load target, capped at 200
 *  - Workouts:   100 points per workout of at least `minWorkoutMin`, max 2 per day
 * A perfect day is therefore worth 600 points.
 */
export const MAX_DAY_POINTS = 600;

export interface DayPoints {
  steps: number;
  cardio: number;
  workouts: number;
  total: number;
}

export function dayPoints(view: DataView, challenge: Challenge, memberId: string, day: DayKey): DayPoints {
  const d = view.daily[memberId]?.[day];
  const ws = view.index[memberId]?.[day] ?? [];
  const steps = Math.min(200, Math.floor(((d?.steps ?? 0) / challenge.targets.steps) * 100));
  const cardio = Math.min(200, Math.floor(((d?.cardioLoad ?? 0) / challenge.targets.cardioLoad) * 100));
  const qualifying = ws.filter((w) => w.durationMin >= challenge.targets.minWorkoutMin).length;
  const workouts = Math.min(2, qualifying) * 100;
  return { steps, cardio, workouts, total: steps + cardio + workouts };
}

export function challengeDays(challenge: Challenge): { all: DayKey[]; elapsed: DayKey[] } {
  const all = dayRange(challenge.start, challenge.end);
  const today = todayKey();
  return { all, elapsed: all.filter((d) => d <= today) };
}

export interface Standing {
  member: Member;
  total: number;
  breakdown: DayPoints;
  today: number;
  cumulative: number[];
  rank: number;
}

export function standings(view: DataView, challenge: Challenge, members: Member[]): Standing[] {
  const { elapsed } = challengeDays(challenge);
  const today = todayKey();
  const rows = members.map((member) => {
    const breakdown: DayPoints = { steps: 0, cardio: 0, workouts: 0, total: 0 };
    const cumulative: number[] = [];
    let running = 0;
    let todayPts = 0;
    for (const day of elapsed) {
      const p = dayPoints(view, challenge, member.id, day);
      breakdown.steps += p.steps;
      breakdown.cardio += p.cardio;
      breakdown.workouts += p.workouts;
      breakdown.total += p.total;
      running += p.total;
      cumulative.push(running);
      if (day === today) todayPts = p.total;
    }
    return { member, total: breakdown.total, breakdown, today: todayPts, cumulative, rank: 0 };
  });
  rows.sort((a, b) => b.total - a.total);
  rows.forEach((r, i) => {
    r.rank = i > 0 && r.total === rows[i - 1].total ? rows[i - 1].rank : i + 1;
  });
  return rows;
}

export interface WeeklyResult {
  monday: DayKey;
  points: Record<string, number>;
  winnerId?: string;
  complete: boolean;
}

export function weeklyResults(view: DataView, challenge: Challenge, members: Member[]): WeeklyResult[] {
  const today = todayKey();
  const out: WeeklyResult[] = [];
  let monday = startOfWeek(challenge.start);
  while (monday <= challenge.end && monday <= today) {
    const days = dayRange(monday, addDays(monday, 6)).filter(
      (d) => d >= challenge.start && d <= challenge.end && d <= today,
    );
    const points: Record<string, number> = {};
    for (const m of members) points[m.id] = days.reduce((s, d) => s + dayPoints(view, challenge, m.id, d).total, 0);
    const sunday = addDays(monday, 6);
    const lastDay = sunday < challenge.end ? sunday : challenge.end;
    const complete = lastDay < today;
    const best = Object.entries(points).sort((a, b) => b[1] - a[1]);
    const winnerId = complete && best.length && best[0][1] > (best[1]?.[1] ?? -1) ? best[0][0] : undefined;
    out.push({ monday, points, winnerId, complete });
    monday = addDays(monday, 7);
  }
  return out;
}
