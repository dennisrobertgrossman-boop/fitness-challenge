/** Local calendar day, formatted YYYY-MM-DD. */
export type DayKey = string;

export type WorkoutType =
  | 'run'
  | 'walk'
  | 'cycle'
  | 'strength'
  | 'hiit'
  | 'swim'
  | 'hike'
  | 'yoga'
  | 'row'
  | 'elliptical'
  | 'sport'
  | 'other';

export type DataSource = 'demo' | 'healthconnect' | 'healthkit' | 'google' | 'manual';

export interface Goals {
  steps: number;
  cardioLoad: number;
  activeMinutes: number;
  workoutsPerWeek: number;
}

export interface Member {
  id: string;
  name: string;
  color: string;
  goals: Goals;
}

export interface DailyMetric {
  memberId: string;
  date: DayKey;
  steps: number;
  /** Cardio Load points for the day (estimated unless cardioLoadSource says otherwise). */
  cardioLoad: number;
  /** 'estimated' = computed from heart rate here; 'manual' = typed in from the Google Health app. */
  cardioLoadSource: 'estimated' | 'manual' | 'device';
  activeMinutes: number;
  activeCalories: number;
  distanceKm: number;
  restingHr?: number;
  source: DataSource;
}

export interface ZoneMinutes {
  light: number;
  moderate: number;
  vigorous: number;
  peak: number;
}

export interface Workout {
  id: string;
  memberId: string;
  type: WorkoutType;
  title?: string;
  /** ISO timestamp. */
  start: string;
  durationMin: number;
  distanceKm?: number;
  activeCalories?: number;
  avgHr?: number;
  maxHr?: number;
  cardioLoad?: number;
  zones?: ZoneMinutes;
  /** Per-minute average heart rate, used for the detail chart. */
  hrSeries?: number[];
  source: DataSource;
  notes?: string;
}

export interface Challenge {
  name: string;
  start: DayKey;
  end: DayKey;
  /** Shared targets used for points, so a low personal goal doesn't give an edge. */
  targets: { steps: number; cardioLoad: number; minWorkoutMin: number };
}

export type MetricKey =
  | 'steps'
  | 'cardioLoad'
  | 'workouts'
  | 'activeMinutes'
  | 'distanceKm'
  | 'activeCalories';

export type DailyMap = Record<string, Record<DayKey, DailyMetric>>;
