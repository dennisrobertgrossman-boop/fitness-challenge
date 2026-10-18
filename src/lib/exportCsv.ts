import { Platform, Share } from 'react-native';
import type { DailyMap, Member, Workout } from '../types';
import { formatTime, isoToDayKey } from './dates';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function dailyCsv(daily: DailyMap, members: Member[]): string {
  const rows = [['date', 'member', 'steps', 'cardio_load', 'cardio_load_source', 'active_minutes', 'active_calories', 'distance_km', 'resting_hr']];
  for (const m of members) {
    for (const d of Object.values(daily[m.id] ?? {}).sort((a, b) => (a.date < b.date ? -1 : 1))) {
      rows.push([d.date, m.name, String(d.steps), String(d.cardioLoad), d.cardioLoadSource, String(d.activeMinutes), String(d.activeCalories), String(d.distanceKm), String(d.restingHr ?? '')]);
    }
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function workoutsCsv(workouts: Workout[], members: Member[]): string {
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const rows = [['date', 'time', 'member', 'type', 'duration_min', 'distance_km', 'active_calories', 'avg_hr', 'max_hr', 'cardio_load', 'source']];
  for (const w of workouts) {
    rows.push([isoToDayKey(w.start), formatTime(w.start), name(w.memberId), w.type, String(w.durationMin), String(w.distanceKm ?? ''), String(w.activeCalories ?? ''), String(w.avgHr ?? ''), String(w.maxHr ?? ''), String(w.cardioLoad ?? ''), w.source]);
  }
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export async function shareCsv(filename: string, csv: string) {
  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    } catch {
      // fall through to the share sheet
    }
  }
  await Share.share({ title: filename, message: csv });
}
