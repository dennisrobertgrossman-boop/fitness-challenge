import { addDays, fromDayKey, isoToDayKey } from '../../lib/dates';
import { HrProfile, summariseMinutes, toMinuteSeries } from '../../lib/heartRate';
import type { DailyMetric, Workout } from '../../types';
import type { HealthSyncResult, RawHealthData } from './types';

/** Turn raw platform data into the app's daily metrics and workouts. */
export function normalize(raw: RawHealthData, memberId: string, baseProfile: HrProfile): HealthSyncResult {
  const profile: HrProfile = { ...baseProfile, restingHr: raw.restingHr ?? baseProfile.restingHr };
  const hr = [...raw.heartRate].sort((a, b) => a.t - b.t);

  const workouts: Workout[] = raw.sessions.map((s) => {
    const series = toMinuteSeries(hr, s.startMs, s.endMs);
    const hasHr = series.some((v) => v > 0);
    const summary = hasHr ? summariseMinutes(series, profile) : undefined;
    return {
      id: `${raw.source}-${s.id}`,
      memberId,
      type: s.type,
      title: s.title,
      start: new Date(s.startMs).toISOString(),
      durationMin: Math.max(1, Math.round((s.endMs - s.startMs) / 60000)),
      distanceKm: s.distanceKm,
      activeCalories: s.activeCalories,
      avgHr: summary?.avgHr,
      maxHr: summary?.maxHr,
      cardioLoad: summary?.cardioLoad,
      zones: summary?.zones,
      hrSeries: hasHr ? series.map((v) => Math.round(v)) : undefined,
      source: raw.source,
    };
  });

  const daily: DailyMetric[] = raw.days.map((day) => {
    const startMs = fromDayKey(day).getTime();
    const endMs = fromDayKey(addDays(day, 1)).getTime();
    const daySamples = hr.filter((s) => s.t >= startMs && s.t < endMs);
    const dayWorkouts = workouts.filter((w) => isoToDayKey(w.start) === day);
    let cardioLoad = 0;
    let activeMinutes = raw.activeMinutes?.[day] ?? 0;
    if (daySamples.length) {
      const summary = summariseMinutes(toMinuteSeries(daySamples, startMs, endMs), profile);
      cardioLoad = summary.cardioLoad;
      if (raw.activeMinutes?.[day] === undefined) activeMinutes = summary.activeMinutes;
    } else {
      cardioLoad = dayWorkouts.reduce((s, w) => s + (w.cardioLoad ?? 0), 0);
      if (raw.activeMinutes?.[day] === undefined) {
        activeMinutes = dayWorkouts.reduce((s, w) => s + w.durationMin, 0);
      }
    }
    return {
      memberId,
      date: day,
      steps: Math.round(raw.steps[day] ?? 0),
      cardioLoad,
      cardioLoadSource: 'estimated',
      activeMinutes: Math.round(activeMinutes),
      activeCalories: Math.round(raw.activeCalories[day] ?? 0),
      distanceKm: Math.round((raw.distanceKm[day] ?? 0) * 100) / 100,
      restingHr: raw.restingHr,
      source: raw.source,
    };
  });

  return { daily, workouts, restingHr: raw.restingHr };
}
