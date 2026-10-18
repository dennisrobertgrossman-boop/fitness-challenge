import type { WorkoutType } from '../types';

export interface WorkoutTypeMeta {
  label: string;
  /** Rough share of minutes spent above light intensity, for estimates. */
  intensity: number;
  hasDistance: boolean;
  /** Typical speed in km/h when hasDistance. */
  speed?: number;
  /** kcal per minute, roughly, for a ~80 kg adult. */
  kcalPerMin: number;
}

export const WORKOUT_TYPES: Record<WorkoutType, WorkoutTypeMeta> = {
  run: { label: 'Outdoor Run', intensity: 0.8, hasDistance: true, speed: 10.5, kcalPerMin: 11 },
  walk: { label: 'Outdoor Walk', intensity: 0.35, hasDistance: true, speed: 5.4, kcalPerMin: 4.5 },
  cycle: { label: 'Outdoor Cycle', intensity: 0.7, hasDistance: true, speed: 25, kcalPerMin: 9 },
  strength: { label: 'Strength Training', intensity: 0.45, hasDistance: false, kcalPerMin: 6 },
  hiit: { label: 'High Intensity Interval Training', intensity: 0.9, hasDistance: false, kcalPerMin: 12 },
  swim: { label: 'Pool Swim', intensity: 0.7, hasDistance: true, speed: 2.4, kcalPerMin: 9 },
  hike: { label: 'Hike', intensity: 0.5, hasDistance: true, speed: 4.2, kcalPerMin: 7 },
  yoga: { label: 'Yoga', intensity: 0.2, hasDistance: false, kcalPerMin: 3.5 },
  row: { label: 'Rowing', intensity: 0.75, hasDistance: true, speed: 12, kcalPerMin: 10 },
  elliptical: { label: 'Elliptical', intensity: 0.6, hasDistance: false, kcalPerMin: 8.5 },
  sport: { label: 'Sport', intensity: 0.75, hasDistance: false, kcalPerMin: 10 },
  other: { label: 'Workout', intensity: 0.5, hasDistance: false, kcalPerMin: 7 },
};

export const WORKOUT_TYPE_ORDER: WorkoutType[] = [
  'run',
  'walk',
  'cycle',
  'strength',
  'hiit',
  'swim',
  'hike',
  'yoga',
  'row',
  'elliptical',
  'sport',
  'other',
];

export function workoutLabel(type: WorkoutType, title?: string): string {
  return title || WORKOUT_TYPES[type].label;
}
