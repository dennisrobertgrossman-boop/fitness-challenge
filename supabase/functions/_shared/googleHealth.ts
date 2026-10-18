/**
 * Pure helpers for the Google Health API v4 (https://health.googleapis.com/v4).
 * Field names follow Google's published discovery document (revision 20261014).
 * No Deno- or npm-specific imports, so this file can be type-checked and tested with Node.
 */

export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
];

export const API_BASE = 'https://health.googleapis.com/v4/users/me';

export type DayKey = string;

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface Zones {
  light: number;
  moderate: number;
  vigorous: number;
  peak: number;
}

export interface DayTotals {
  steps: number;
  distanceKm: number;
  activeCalories: number;
  activeMinutes: number;
  zones: Zones;
  restingHr?: number;
}

export interface DailyRow {
  member_id: string;
  date: DayKey;
  steps: number;
  cardio_load: number;
  cardio_load_source: 'estimated' | 'manual';
  active_minutes: number;
  active_calories: number;
  distance_km: number;
  resting_hr: number | null;
  source: 'google';
  updated_at: string;
}

export interface WorkoutRow {
  member_id: string;
  id: string;
  type: string;
  title: string | null;
  start_time: string;
  duration_min: number;
  distance_km: number | null;
  active_calories: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  cardio_load: number | null;
  zones: Zones | null;
  hr_series: null;
  source: 'google';
  notes: string | null;
  updated_at: string;
}

// ---------- Dates ----------

const pad = (n: number) => String(n).padStart(2, '0');

export function toCivil(day: DayKey): CivilDate {
  const [year, month, d] = day.split('-').map(Number);
  return { year, month, day: d };
}

export function civilToDay(c?: { date?: Partial<CivilDate> } | null): DayKey | null {
  const d = c?.date;
  if (!d?.year || !d.month || !d.day) return null;
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

export function addDays(day: DayKey, n: number): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Splits [start, endExclusive) into windows of at most `maxDays`. */
export function windows(start: DayKey, endExclusive: DayKey, maxDays: number): [DayKey, DayKey][] {
  const out: [DayKey, DayKey][] = [];
  let a = start;
  while (a < endExclusive) {
    let b = addDays(a, maxDays);
    if (b > endExclusive) b = endExclusive;
    out.push([a, b]);
    a = b;
  }
  return out;
}

/** google-duration strings look like "3600s" or "12.5s". */
export function durationToMinutes(d?: string | null): number {
  if (!d) return 0;
  const s = parseFloat(d.replace(/s$/, ''));
  return Number.isFinite(s) ? s / 60 : 0;
}

export function dailyRollUpBody(start: DayKey, endExclusive: DayKey) {
  return {
    range: { start: { date: toCivil(start) }, end: { date: toCivil(endExclusive) } },
    windowSizeDays: 1,
    pageSize: 1000,
  };
}

/** The API caps the range per request: 14 days for some types, 90 for the rest. */
export const ROLLUP_TYPES: { type: string; maxDays: number }[] = [
  { type: 'steps', maxDays: 90 },
  { type: 'distance', maxDays: 90 },
  { type: 'active-energy-burned', maxDays: 90 },
  { type: 'time-in-heart-rate-zone', maxDays: 90 },
  { type: 'active-minutes', maxDays: 14 },
];

// ---------- Cardio Load estimate ----------

/**
 * Google's Cardio Load is not part of the Google Health API, so it is estimated
 * from time in heart-rate zones with Banister's training impulse at each zone's
 * midpoint of heart-rate reserve. This matches the per-minute formula the app uses
 * for raw heart-rate data (src/lib/heartRate.ts).
 */
const trimp = (r: number) => r * 0.64 * Math.exp(1.92 * r);
export const ZONE_LOAD_PER_MIN: Zones = {
  light: trimp(0.4),
  moderate: trimp(0.6),
  vigorous: trimp(0.775),
  peak: trimp(0.925),
};

export function loadFromZones(z: Zones): number {
  return Math.round(
    z.light * ZONE_LOAD_PER_MIN.light +
      z.moderate * ZONE_LOAD_PER_MIN.moderate +
      z.vigorous * ZONE_LOAD_PER_MIN.vigorous +
      z.peak * ZONE_LOAD_PER_MIN.peak,
  );
}

const emptyZones = (): Zones => ({ light: 0, moderate: 0, vigorous: 0, peak: 0 });
const emptyDay = (): DayTotals => ({ steps: 0, distanceKm: 0, activeCalories: 0, activeMinutes: 0, zones: emptyZones() });

const ZONE_KEY: Record<string, keyof Zones> = {
  LIGHT: 'light',
  MODERATE: 'moderate',
  VIGOROUS: 'vigorous',
  PEAK: 'peak',
};

// ---------- Parsing ----------

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Adds one dailyRollUp response (rollupDataPoints) for `type` into `days`. */
export function applyRollup(days: Record<DayKey, DayTotals>, type: string, points: any[] | undefined) {
  for (const p of points ?? []) {
    const day = civilToDay(p.civilStartTime);
    if (!day) continue;
    const t = (days[day] ??= emptyDay());
    switch (type) {
      case 'steps':
        t.steps += Number(p.steps?.countSum ?? 0);
        break;
      case 'distance':
        t.distanceKm += Number(p.distance?.millimetersSum ?? 0) / 1_000_000;
        break;
      case 'active-energy-burned':
        t.activeCalories += Number(p.activeEnergyBurned?.kcalSum ?? 0);
        break;
      case 'time-in-heart-rate-zone':
        for (const z of p.timeInHeartRateZone?.timeInHeartRateZones ?? []) {
          const key = ZONE_KEY[z.heartRateZone];
          if (key) t.zones[key] += durationToMinutes(z.duration);
        }
        break;
      case 'active-minutes':
        for (const a of p.activeMinutes?.activeMinutesRollupByActivityLevel ?? []) {
          if (a.activityLevel === 'MODERATE' || a.activityLevel === 'VIGOROUS') t.activeMinutes += Number(a.activeMinutesSum ?? 0);
        }
        break;
    }
  }
}

/** Adds daily-resting-heart-rate data points into `days`. */
export function applyRestingHr(days: Record<DayKey, DayTotals>, dataPoints: any[] | undefined) {
  for (const dp of dataPoints ?? []) {
    const r = dp.dailyRestingHeartRate;
    const d = r?.date;
    if (!d?.year) continue;
    const day = `${d.year}-${pad(d.month)}-${pad(d.day)}`;
    (days[day] ??= emptyDay()).restingHr = Number(r.beatsPerMinute);
  }
}

export function toDailyRows(
  memberId: string,
  days: Record<DayKey, DayTotals>,
  manualCardio: Record<DayKey, number>,
  now = new Date().toISOString(),
): DailyRow[] {
  return Object.entries(days)
    .filter(([, t]) => t.steps > 0 || t.activeCalories > 0 || t.distanceKm > 0 || loadFromZones(t.zones) > 0)
    .map(([date, t]) => ({
      member_id: memberId,
      date,
      steps: Math.round(t.steps),
      cardio_load: manualCardio[date] ?? loadFromZones(t.zones),
      cardio_load_source: manualCardio[date] != null ? 'manual' : 'estimated',
      active_minutes: Math.round(t.activeMinutes),
      active_calories: Math.round(t.activeCalories),
      distance_km: Math.round(t.distanceKm * 100) / 100,
      resting_hr: t.restingHr ?? null,
      source: 'google',
      updated_at: now,
    }));
}

const EXERCISE_MAP: Record<string, string> = {
  RUNNING: 'run',
  TRAIL_RUN: 'run',
  TREADMILL: 'run',
  INCLINE_RUN: 'run',
  TRACK_AND_FIELD: 'run',
  WALKING: 'walk',
  POWER_WALKING: 'walk',
  NORDIC_WALKING: 'walk',
  TREADMILL_WALK: 'walk',
  INCLINE_WALK: 'walk',
  STROLLER_WALK: 'walk',
  WALK_WITH_WEIGHTS: 'walk',
  RUCKING: 'walk',
  BIKING: 'cycle',
  OUTDOOR_BIKE: 'cycle',
  MOUNTAIN_BIKE: 'cycle',
  STATIONARY_BIKE: 'cycle',
  SPINNING: 'cycle',
  ASSAULT_BIKE: 'cycle',
  ELECTRIC_BIKE: 'cycle',
  STRENGTH_TRAINING: 'strength',
  FUNCTIONAL_STRENGTH_TRAINING: 'strength',
  WEIGHTLIFTING: 'strength',
  WEIGHTS: 'strength',
  WEIGHT_MACHINES: 'strength',
  FREE_WEIGHTS: 'strength',
  POWERLIFTING: 'strength',
  BODY_WEIGHT: 'strength',
  CALISTHENICS: 'strength',
  CORE_TRAINING: 'strength',
  RESISTANCE_BANDS: 'strength',
  TRX: 'strength',
  HIIT: 'hiit',
  INTERVAL_WORKOUT: 'hiit',
  TABATA_WORKOUT: 'hiit',
  CIRCUIT_TRAINING: 'hiit',
  CROSSFIT: 'hiit',
  BOOTCAMP: 'hiit',
  CROSS_TRAINING: 'hiit',
  SWIMMING: 'swim',
  SWIMMING_POOL: 'swim',
  SWIMMING_OPEN_WATER: 'swim',
  HIKING: 'hike',
  BACKPACKING: 'hike',
  YOGA: 'yoga',
  YOGA_BIKRAM: 'yoga',
  YOGA_HATHA: 'yoga',
  YOGA_POWER: 'yoga',
  YOGA_VINYASA: 'yoga',
  PILATES: 'yoga',
  STRETCHING: 'yoga',
  ROWING: 'row',
  ROWING_MACHINE: 'row',
  ELLIPTICAL: 'elliptical',
  STAIRCLIMBER: 'elliptical',
  SOCCER: 'sport',
  BASKETBALL: 'sport',
  TENNIS: 'sport',
  PADEL: 'sport',
  SQUASH: 'sport',
  BADMINTON: 'sport',
  VOLLEYBALL: 'sport',
  HANDBALL: 'sport',
  HOCKEY: 'sport',
  RUGBY: 'sport',
  TABLE_TENNIS: 'sport',
  RACKET_SPORTS: 'sport',
  SPORT: 'sport',
};

export function mapExerciseType(t?: string): string {
  return (t && EXERCISE_MAP[t]) || 'other';
}

/** Converts one `exercise` data point into a workouts row, or null if it is incomplete. */
export function toWorkoutRow(memberId: string, dp: any, now = new Date().toISOString()): WorkoutRow | null {
  const e = dp?.exercise;
  const start = e?.interval?.startTime;
  const end = e?.interval?.endTime;
  if (!e || !start || !end) return null;
  const m = e.metricsSummary ?? {};
  const hz = m.heartRateZoneDurations;
  const zones: Zones | null = hz
    ? {
        light: Math.round(durationToMinutes(hz.lightTime)),
        moderate: Math.round(durationToMinutes(hz.moderateTime)),
        vigorous: Math.round(durationToMinutes(hz.vigorousTime)),
        peak: Math.round(durationToMinutes(hz.peakTime)),
      }
    : null;
  const active = durationToMinutes(e.activeDuration);
  const durationMin = active > 0 ? active : (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  const km = m.distanceMillimeters ? Number(m.distanceMillimeters) / 1_000_000 : 0;
  const type = mapExerciseType(e.exerciseType);
  return {
    member_id: memberId,
    id: `google-${dp.name ? String(dp.name).split('/').pop() : start}`,
    type,
    // Keep Google's name for types the app groups together (e.g. "Padel" under Sport).
    title: type === 'other' || type === 'sport' ? (e.displayName ?? null) : null,
    start_time: start,
    duration_min: Math.round(durationMin * 100) / 100,
    distance_km: km > 0.05 ? Math.round(km * 100) / 100 : null,
    active_calories: m.caloriesKcal != null ? Math.round(Number(m.caloriesKcal)) : null,
    avg_hr: m.averageHeartRateBeatsPerMinute != null ? Math.round(Number(m.averageHeartRateBeatsPerMinute)) : null,
    max_hr: null,
    cardio_load: zones ? loadFromZones(zones) : null,
    zones,
    hr_series: null,
    source: 'google',
    notes: e.notes ?? null,
    updated_at: now,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
