import type { ZoneMinutes } from '../types';

export interface HrProfile {
  age: number;
  restingHr: number;
}

export function maxHr(profile: HrProfile): number {
  return 220 - profile.age;
}

/** Heart-rate reserve fraction (Karvonen), clamped to 0–1. */
export function hrReserve(bpm: number, profile: HrProfile): number {
  const max = maxHr(profile);
  return Math.min(1, Math.max(0, (bpm - profile.restingHr) / (max - profile.restingHr)));
}

export type Zone = keyof ZoneMinutes;

export const ZONES: { key: Zone; label: string; from: number; color: string }[] = [
  { key: 'light', label: 'Light', from: 0.3, color: '#64D2FF' },
  { key: 'moderate', label: 'Moderate', from: 0.5, color: '#A6FF00' },
  { key: 'vigorous', label: 'Vigorous', from: 0.7, color: '#FF9F0A' },
  { key: 'peak', label: 'Peak', from: 0.85, color: '#FA114F' },
];

export function zoneFor(bpm: number, profile: HrProfile): Zone | null {
  const r = hrReserve(bpm, profile);
  let zone: Zone | null = null;
  for (const z of ZONES) if (r >= z.from) zone = z.key;
  return zone;
}

/**
 * Cardio Load estimate for one minute at the given heart rate, using
 * Banister's training impulse (TRIMP). Google does not publish its Cardio Load
 * formula, so values computed here are labelled "estimated" in the app; the
 * scale was chosen so a 45-minute steady run lands around 80–100 points,
 * which is the same order of magnitude as the Google Health app.
 */
export function minuteLoad(bpm: number, profile: HrProfile): number {
  const r = hrReserve(bpm, profile);
  if (r < 0.3) return 0;
  return r * 0.64 * Math.exp(1.92 * r);
}

export interface HrSummary {
  avgHr: number;
  maxHr: number;
  cardioLoad: number;
  zones: ZoneMinutes;
  activeMinutes: number;
}

/** Summarise a per-minute heart-rate series (gaps allowed as 0 / NaN). */
export function summariseMinutes(series: number[], profile: HrProfile): HrSummary {
  const zones: ZoneMinutes = { light: 0, moderate: 0, vigorous: 0, peak: 0 };
  let sum = 0;
  let count = 0;
  let max = 0;
  let load = 0;
  let active = 0;
  for (const bpm of series) {
    if (!bpm || Number.isNaN(bpm)) continue;
    sum += bpm;
    count++;
    max = Math.max(max, bpm);
    load += minuteLoad(bpm, profile);
    const z = zoneFor(bpm, profile);
    if (z) zones[z]++;
    if (hrReserve(bpm, profile) >= 0.4) active++;
  }
  return {
    avgHr: count ? Math.round(sum / count) : 0,
    maxHr: Math.round(max),
    cardioLoad: Math.round(load),
    zones,
    activeMinutes: active,
  };
}

/** Bucket raw samples (timestamp ms, bpm) into per-minute averages between start and end. */
export function toMinuteSeries(
  samples: { t: number; bpm: number }[],
  startMs: number,
  endMs: number,
): number[] {
  const minutes = Math.max(1, Math.ceil((endMs - startMs) / 60000));
  const sums = new Array<number>(minutes).fill(0);
  const counts = new Array<number>(minutes).fill(0);
  for (const s of samples) {
    if (s.t < startMs || s.t >= endMs) continue;
    const i = Math.floor((s.t - startMs) / 60000);
    sums[i] += s.bpm;
    counts[i]++;
  }
  return sums.map((v, i) => (counts[i] ? v / counts[i] : 0));
}
