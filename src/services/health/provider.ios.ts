import { addDays, fromDayKey, lastNDays, toDayKey } from '../../lib/dates';
import type { WorkoutType } from '../../types';
import type { HealthProvider, RawHealthData, RawSession } from './types';

type HK = typeof import('@kingstinct/react-native-healthkit');

// Loaded lazily so the JS bundle still runs in Expo Go, where the native module is missing.
function hk(): HK | null {
  try {
    return require('@kingstinct/react-native-healthkit') as HK;
  } catch {
    return null;
  }
}

function mapActivity(code: number, A: HK['WorkoutActivityType']): WorkoutType {
  switch (code) {
    case A.running:
      return 'run';
    case A.walking:
      return 'walk';
    case A.cycling:
      return 'cycle';
    case A.traditionalStrengthTraining:
    case A.functionalStrengthTraining:
    case A.coreTraining:
      return 'strength';
    case A.highIntensityIntervalTraining:
    case A.crossTraining:
      return 'hiit';
    case A.swimming:
      return 'swim';
    case A.hiking:
      return 'hike';
    case A.yoga:
    case A.pilates:
      return 'yoga';
    case A.rowing:
      return 'row';
    case A.elliptical:
      return 'elliptical';
    case A.soccer:
    case A.basketball:
    case A.tennis:
    case A.badminton:
    case A.volleyball:
      return 'sport';
    default:
      return 'other';
  }
}

export const provider: HealthProvider = {
  id: 'healthkit',
  label: 'Apple Health',

  async isAvailable() {
    const lib = hk();
    if (!lib) return false;
    try {
      return lib.isHealthDataAvailable();
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const lib = hk();
    if (!lib) return false;
    // HealthKit never reveals whether read access was denied, so a resolved promise is the best signal.
    await lib.requestAuthorization({
      toRead: [
        'HKQuantityTypeIdentifierStepCount',
        'HKQuantityTypeIdentifierHeartRate',
        'HKQuantityTypeIdentifierRestingHeartRate',
        'HKQuantityTypeIdentifierActiveEnergyBurned',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
        'HKQuantityTypeIdentifierAppleExerciseTime',
        'HKWorkoutTypeIdentifier',
      ],
    });
    return true;
  },

  async read({ days }) {
    const lib = hk();
    if (!lib) throw new Error('HealthKit module is not linked. Use a development build.');

    const dayKeys = lastNDays(days);
    const startDate = fromDayKey(dayKeys[0]);
    const endDate = fromDayKey(addDays(dayKeys[dayKeys.length - 1], 1));
    const filter = { date: { startDate, endDate } };

    const daily = async (
      id:
        | 'HKQuantityTypeIdentifierStepCount'
        | 'HKQuantityTypeIdentifierActiveEnergyBurned'
        | 'HKQuantityTypeIdentifierDistanceWalkingRunning'
        | 'HKQuantityTypeIdentifierAppleExerciseTime',
      unit: string,
    ) => {
      const rows = await lib.queryStatisticsCollectionForQuantity(
        id,
        ['cumulativeSum'],
        startDate,
        { day: 1 },
        { filter, unit: unit as never },
      );
      const out: Record<string, number> = {};
      for (const r of rows) {
        if (r.startDate) out[toDayKey(new Date(r.startDate))] = r.sumQuantity?.quantity ?? 0;
      }
      return out;
    };

    const [steps, activeCalories, distanceKm, activeMinutes] = await Promise.all([
      daily('HKQuantityTypeIdentifierStepCount', 'count'),
      daily('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'),
      daily('HKQuantityTypeIdentifierDistanceWalkingRunning', 'km'),
      daily('HKQuantityTypeIdentifierAppleExerciseTime', 'min'),
    ]);

    const workouts = await lib.queryWorkoutSamples({ limit: -1, filter });
    const sessions: RawSession[] = workouts.map((w) => {
      const km = w.totalDistance ? w.totalDistance.quantity / (w.totalDistance.unit === 'm' ? 1000 : 1) : undefined;
      return {
        id: w.uuid,
        type: mapActivity(w.workoutActivityType, lib.WorkoutActivityType),
        startMs: new Date(w.startDate).getTime(),
        endMs: new Date(w.endDate).getTime(),
        activeCalories: w.totalEnergyBurned ? Math.round(w.totalEnergyBurned.quantity) : undefined,
        distanceKm: km && km > 0.05 ? Math.round(km * 100) / 100 : undefined,
      };
    });

    // Heart rate is dense; limit to the last 30 days to keep sync fast.
    const hrStart = fromDayKey(addDays(dayKeys[dayKeys.length - 1], -29));
    const hrSamples = await lib.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      limit: -1,
      unit: 'count/min',
      filter: { date: { startDate: hrStart > startDate ? hrStart : startDate, endDate } },
    });
    const heartRate = hrSamples.map((s) => ({ t: new Date(s.startDate).getTime(), bpm: s.quantity }));

    const resting = await lib
      .getMostRecentQuantitySample('HKQuantityTypeIdentifierRestingHeartRate', 'count/min')
      .catch(() => undefined);

    const raw: RawHealthData = {
      source: 'healthkit',
      days: dayKeys,
      steps,
      activeCalories,
      distanceKm,
      activeMinutes,
      restingHr: resting ? Math.round(resting.quantity) : undefined,
      sessions,
      heartRate,
    };
    return raw;
  },
};
