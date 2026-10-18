import type { MetricKey } from '../types';

export function formatNumber(n: number, digits = 0): string {
  const fixed = n.toFixed(digits);
  const [int, frac] = fixed.split('.');
  const withSep = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${withSep}.${frac}` : withSep;
}

export function formatCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function formatDurationClock(min: number): string {
  const totalSec = Math.round(min * 60);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function formatPace(durationMin: number, distanceKm: number): string {
  if (!distanceKm) return '–';
  const pace = durationMin / distanceKm;
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}'${String(s).padStart(2, '0')}" /km`;
}

export const metricMeta: Record<
  MetricKey,
  { label: string; short: string; unit: string; digits: number }
> = {
  steps: { label: 'Steps', short: 'Steps', unit: 'steps', digits: 0 },
  cardioLoad: { label: 'Cardio Load', short: 'Cardio', unit: 'pts', digits: 0 },
  workouts: { label: 'Workouts', short: 'Workouts', unit: '', digits: 0 },
  activeMinutes: { label: 'Active Minutes', short: 'Active', unit: 'min', digits: 0 },
  distanceKm: { label: 'Distance', short: 'Distance', unit: 'km', digits: 1 },
  activeCalories: { label: 'Active Calories', short: 'Calories', unit: 'kcal', digits: 0 },
};

export function formatMetric(metric: MetricKey, value: number, withUnit = true): string {
  const meta = metricMeta[metric];
  const v = formatNumber(value, meta.digits);
  return withUnit && meta.unit ? `${v} ${meta.unit}` : v;
}
