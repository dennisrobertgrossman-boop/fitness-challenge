import type { HrProfile } from '../../lib/heartRate';
import type { DailyMetric, DataSource, DayKey, Workout, WorkoutType } from '../../types';

export interface RawSession {
  id: string;
  type: WorkoutType;
  title?: string;
  startMs: number;
  endMs: number;
  activeCalories?: number;
  distanceKm?: number;
}

/** Platform-neutral raw data returned by a provider before normalisation. */
export interface RawHealthData {
  source: DataSource;
  days: DayKey[];
  steps: Record<DayKey, number>;
  activeCalories: Record<DayKey, number>;
  distanceKm: Record<DayKey, number>;
  /** Exercise minutes as reported by the platform (iOS), when available. */
  activeMinutes?: Record<DayKey, number>;
  restingHr?: number;
  sessions: RawSession[];
  heartRate: { t: number; bpm: number }[];
}

export interface HealthSyncResult {
  daily: DailyMetric[];
  workouts: Workout[];
  restingHr?: number;
}

export interface HealthProvider {
  id: 'healthconnect' | 'healthkit' | 'none';
  label: string;
  isAvailable(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;
  read(opts: { days: number }): Promise<RawHealthData>;
  /** Opens the platform's health permissions screen, when supported. */
  openSettings?(): void;
}

export interface SyncOptions {
  memberId: string;
  days: number;
  profile: HrProfile;
}
