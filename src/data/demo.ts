import { addDays, fromDayKey, lastNDays, todayKey, weekdayIndex } from '../lib/dates';
import { HrProfile, summariseMinutes } from '../lib/heartRate';
import { createRng } from '../lib/random';
import type { DailyMap, DailyMetric, DayKey, Goals, Member, Workout, WorkoutType } from '../types';
import { memberPalette } from '../theme';
import { WORKOUT_TYPES } from './workoutTypes';

export const DEMO_DAYS = 84;

const DEFAULT_GOALS: Goals = { steps: 10000, cardioLoad: 50, activeMinutes: 30, workoutsPerWeek: 4 };

export const DEFAULT_MEMBERS: Member[] = [
  { id: 'm1', name: 'Dennis', color: memberPalette[0], goals: { ...DEFAULT_GOALS } },
  { id: 'm2', name: 'Alex', color: memberPalette[1], goals: { ...DEFAULT_GOALS, workoutsPerWeek: 5 } },
  { id: 'm3', name: 'Sam', color: memberPalette[2], goals: { ...DEFAULT_GOALS, steps: 12000, workoutsPerWeek: 3 } },
];

interface Profile {
  hr: HrProfile;
  steps: number;
  stepsSd: number;
  weekend: number;
  perWeek: number;
  /** Relative likelihood of training on each weekday (Mon..Sun). */
  dow: number[];
  types: Partial<Record<WorkoutType, number>>;
  morning: number;
  /** Optional multiplier per day-offset from today (for storylines). */
  trend?: (daysAgo: number) => number;
}

const PROFILES: Record<string, Profile> = {
  m1: {
    hr: { age: 34, restingHr: 56 },
    steps: 10400,
    stepsSd: 2300,
    weekend: 1.1,
    perWeek: 4.2,
    dow: [1.2, 0.8, 1.2, 0.7, 1, 1.3, 0.8],
    types: { run: 0.45, strength: 0.35, hiit: 0.1, walk: 0.1 },
    morning: 0.7,
  },
  m2: {
    hr: { age: 31, restingHr: 52 },
    steps: 8300,
    stepsSd: 2100,
    weekend: 0.85,
    perWeek: 4.8,
    dow: [1, 1.2, 0.8, 1.2, 0.6, 1.4, 1.1],
    types: { cycle: 0.4, strength: 0.32, row: 0.12, swim: 0.16 },
    morning: 0.3,
    // A cold knocked Alex out for most of a week about five weeks ago.
    trend: (daysAgo) => (daysAgo >= 33 && daysAgo <= 38 ? 0.35 : 1),
  },
  m3: {
    hr: { age: 37, restingHr: 60 },
    steps: 11000,
    stepsSd: 2600,
    weekend: 1.2,
    perWeek: 3.1,
    dow: [0.6, 1.1, 0.8, 1.2, 0.7, 1.5, 1.3],
    types: { sport: 0.33, hike: 0.17, walk: 0.2, run: 0.18, yoga: 0.12 },
    morning: 0.5,
    // Sam has been ramping up over the last month.
    trend: (daysAgo) => (daysAgo < 28 ? 1.15 : 1),
  },
};

const DURATION: Record<WorkoutType, [number, number]> = {
  run: [28, 62],
  walk: [30, 60],
  cycle: [45, 115],
  strength: [40, 70],
  hiit: [20, 35],
  swim: [30, 50],
  hike: [90, 180],
  yoga: [30, 60],
  row: [20, 40],
  elliptical: [30, 45],
  sport: [60, 90],
  other: [30, 60],
};

const TARGET_HRR: Record<WorkoutType, number> = {
  run: 0.72,
  walk: 0.33,
  cycle: 0.64,
  strength: 0.45,
  hiit: 0.78,
  swim: 0.62,
  hike: 0.48,
  yoga: 0.22,
  row: 0.68,
  elliptical: 0.6,
  sport: 0.68,
  other: 0.5,
};

function synthHr(
  rng: ReturnType<typeof createRng>,
  type: WorkoutType,
  minutes: number,
  hr: HrProfile,
): number[] {
  const max = 220 - hr.age;
  const target = TARGET_HRR[type] + rng.range(-0.05, 0.06);
  const series: number[] = [];
  const warm = Math.min(6, Math.floor(minutes / 5));
  const cool = Math.min(5, Math.floor(minutes / 6));
  let drift = 0;
  for (let i = 0; i < minutes; i++) {
    let r = target;
    if (i < warm) r = 0.25 + (target - 0.25) * (i / warm);
    else if (i >= minutes - cool) r = target - (target - 0.3) * ((i - (minutes - cool)) / cool);
    if (type === 'hiit') r += i % 4 < 2 ? 0.12 : -0.1;
    if (type === 'strength') r += Math.sin(i / 1.7) * 0.1;
    if (type === 'sport') r += Math.sin(i / 3.1) * 0.12;
    drift += rng.range(-0.008, 0.01);
    r += drift * 0.5 + rng.range(-0.025, 0.025);
    r = Math.max(0.15, Math.min(0.98, r));
    series.push(Math.round(hr.restingHr + r * (max - hr.restingHr)));
  }
  return series;
}

export function generateDemoData(today: DayKey = todayKey()): { daily: DailyMap; workouts: Workout[] } {
  const daily: DailyMap = {};
  const workouts: Workout[] = [];
  const now = new Date();
  const dayFraction = Math.min(1, Math.max(0.05, (now.getHours() + now.getMinutes() / 60 - 6) / 16));
  const days = lastNDays(DEMO_DAYS, today);

  for (const [memberId, p] of Object.entries(PROFILES)) {
    const rng = createRng(memberId.charCodeAt(1) * 7919 + 17);
    daily[memberId] = {};
    days.forEach((day, i) => {
      const daysAgo = DEMO_DAYS - 1 - i;
      const dow = weekdayIndex(day);
      const trend = p.trend?.(daysAgo) ?? 1;
      const isToday = day === today;
      const isWeekend = dow >= 5;

      // Workouts for the day
      const dayWorkouts: Workout[] = [];
      const chance = (p.perWeek / 7) * p.dow[dow] * (trend < 0.5 ? 0.1 : 1);
      let count = rng.next() < chance ? 1 : 0;
      if (count && rng.next() < 0.1) count = 2;
      for (let n = 0; n < count; n++) {
        const type = rng.weighted(p.types);
        const meta = WORKOUT_TYPES[type];
        const [lo, hi] = DURATION[type];
        const durationMin = Math.round(rng.range(lo, hi));
        const morning = n === 0 ? rng.next() < p.morning : false;
        const startHour = morning ? rng.range(6, 8.5) : rng.range(17, 20);
        const d = fromDayKey(day);
        d.setHours(Math.floor(startHour), Math.floor((startHour % 1) * 60), 0, 0);
        if (isToday && d.getTime() + durationMin * 60000 > now.getTime()) continue;
        const series = synthHr(rng, type, durationMin, p.hr);
        const s = summariseMinutes(series, p.hr);
        const distanceKm = meta.hasDistance && meta.speed
          ? Math.round(meta.speed * (durationMin / 60) * rng.range(0.88, 1.12) * 100) / 100
          : undefined;
        dayWorkouts.push({
          id: `${memberId}-${day}-${n}`,
          memberId,
          type,
          title: type === 'sport' ? 'Football' : undefined,
          start: d.toISOString(),
          durationMin,
          distanceKm,
          activeCalories: Math.round(meta.kcalPerMin * durationMin * rng.range(0.9, 1.1)),
          avgHr: s.avgHr,
          maxHr: s.maxHr,
          cardioLoad: s.cardioLoad,
          zones: s.zones,
          hrSeries: series,
          source: 'demo',
        });
      }

      // Daily totals
      let steps = Math.max(1500, rng.normal(p.steps * (isWeekend ? p.weekend : 1), p.stepsSd)) * trend;
      for (const w of dayWorkouts) {
        if (w.type === 'run') steps += (w.distanceKm ?? 0) * 1050;
        if (w.type === 'walk' || w.type === 'hike') steps += (w.distanceKm ?? 0) * 700;
        if (w.type === 'sport') steps += w.durationMin * 70;
      }
      if (isToday) steps *= dayFraction;
      steps = Math.round(steps);

      const workoutLoad = dayWorkouts.reduce((s, w) => s + (w.cardioLoad ?? 0), 0);
      const backgroundLoad = Math.max(0, (steps - 4000) / 1000) * 1.6;
      const workoutActive = dayWorkouts.reduce(
        (s, w) => s + (w.zones ? w.zones.moderate + w.zones.vigorous + w.zones.peak : 0),
        0,
      );
      const metric: DailyMetric = {
        memberId,
        date: day,
        steps,
        cardioLoad: Math.round(workoutLoad + backgroundLoad),
        cardioLoadSource: 'estimated',
        activeMinutes: Math.round(workoutActive + steps / 1000 * 2.2),
        activeCalories: Math.round(dayWorkouts.reduce((s, w) => s + (w.activeCalories ?? 0), 0) + steps * 0.04),
        distanceKm: Math.round(steps * 0.00078 * 100) / 100 + dayWorkouts
          .filter((w) => w.type === 'cycle' || w.type === 'swim' || w.type === 'row')
          .reduce((s, w) => s + (w.distanceKm ?? 0), 0),
        restingHr: Math.round(p.hr.restingHr + rng.range(-2, 3)),
        source: 'demo',
      };
      daily[memberId][day] = metric;
      workouts.push(...dayWorkouts);
    });
  }

  workouts.sort((a, b) => (a.start < b.start ? 1 : -1));
  return { daily, workouts };
}

export function defaultChallenge(today: DayKey = todayKey()) {
  // A six-week challenge that started on the Monday three weeks ago.
  const monday = addDays(today, -weekdayIndex(today) - 21);
  return {
    name: 'Brothers Challenge',
    start: monday,
    end: addDays(monday, 41),
    targets: { steps: 10000, cardioLoad: 50, minWorkoutMin: 20 },
  };
}
