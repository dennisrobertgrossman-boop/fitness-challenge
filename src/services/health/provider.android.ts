import { addDays, lastNDays, fromDayKey, toDayKey } from '../../lib/dates';
import type { WorkoutType } from '../../types';
import type { HealthProvider, RawHealthData, RawSession } from './types';

type HC = typeof import('react-native-health-connect');

// Loaded lazily so the JS bundle still runs in Expo Go, where the native module is missing.
function hc(): HC | null {
  try {
    return require('react-native-health-connect') as HC;
  } catch {
    return null;
  }
}

const READ_TYPES = [
  'Steps',
  'ExerciseSession',
  'HeartRate',
  'ActiveCaloriesBurned',
  'Distance',
  'RestingHeartRate',
] as const;

/** Health Connect ExerciseType constants → app workout types. */
function mapExerciseType(code: number, ET: HC['ExerciseType']): WorkoutType {
  switch (code) {
    case ET.RUNNING:
    case ET.RUNNING_TREADMILL:
      return 'run';
    case ET.WALKING:
      return 'walk';
    case ET.BIKING:
    case ET.BIKING_STATIONARY:
      return 'cycle';
    case ET.STRENGTH_TRAINING:
    case ET.WEIGHTLIFTING:
    case ET.CALISTHENICS:
      return 'strength';
    case ET.HIGH_INTENSITY_INTERVAL_TRAINING:
      return 'hiit';
    case ET.SWIMMING_POOL:
    case ET.SWIMMING_OPEN_WATER:
      return 'swim';
    case ET.HIKING:
      return 'hike';
    case ET.YOGA:
    case ET.PILATES:
      return 'yoga';
    case ET.ROWING:
    case ET.ROWING_MACHINE:
      return 'row';
    case ET.ELLIPTICAL:
      return 'elliptical';
    case ET.SOCCER:
    case ET.BASKETBALL:
    case ET.TENNIS:
    case ET.BADMINTON:
    case ET.VOLLEYBALL:
      return 'sport';
    default:
      return 'other';
  }
}

async function readAll<T>(
  fetchPage: (pageToken?: string) => Promise<{ records: T[]; pageToken?: string }>,
): Promise<T[]> {
  const out: T[] = [];
  let token: string | undefined;
  do {
    const page = await fetchPage(token);
    out.push(...page.records);
    token = page.pageToken || undefined;
  } while (token);
  return out;
}

export const provider: HealthProvider = {
  id: 'healthconnect',
  label: 'Health Connect',

  async isAvailable() {
    const lib = hc();
    if (!lib) return false;
    try {
      const status = await lib.getSdkStatus();
      return status === lib.SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const lib = hc();
    if (!lib) return false;
    await lib.initialize();
    const granted = await lib.requestPermission(
      READ_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })),
    );
    return granted.some((p) => 'recordType' in p && p.recordType === 'Steps');
  },

  openSettings() {
    hc()?.openHealthConnectSettings();
  },

  async read({ days }) {
    const lib = hc();
    if (!lib) throw new Error('Health Connect module is not linked. Use a development build.');
    await lib.initialize();

    const dayKeys = lastNDays(days);
    const start = fromDayKey(dayKeys[0]);
    const end = fromDayKey(addDays(dayKeys[dayKeys.length - 1], 1));
    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    };
    const slicer = { duration: 'DAYS' as const, length: 1 };

    const [stepsAgg, calAgg, distAgg] = await Promise.all([
      lib.aggregateGroupByDuration({ recordType: 'Steps', timeRangeFilter, timeRangeSlicer: slicer }),
      lib.aggregateGroupByDuration({ recordType: 'ActiveCaloriesBurned', timeRangeFilter, timeRangeSlicer: slicer }),
      lib.aggregateGroupByDuration({ recordType: 'Distance', timeRangeFilter, timeRangeSlicer: slicer }),
    ]);

    const steps: Record<string, number> = {};
    const activeCalories: Record<string, number> = {};
    const distanceKm: Record<string, number> = {};
    for (const g of stepsAgg) steps[toDayKey(new Date(g.startTime))] = g.result.COUNT_TOTAL ?? 0;
    for (const g of calAgg) activeCalories[toDayKey(new Date(g.startTime))] = g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0;
    for (const g of distAgg) distanceKm[toDayKey(new Date(g.startTime))] = g.result.DISTANCE?.inKilometers ?? 0;

    const sessionRecords = await readAll((pageToken) =>
      lib.readRecords('ExerciseSession', { timeRangeFilter, pageToken, pageSize: 1000 }),
    );

    // Heart rate is dense; limit to the last 30 days to keep sync fast.
    const hrStart = fromDayKey(addDays(dayKeys[dayKeys.length - 1], -29));
    const hrRecords = await readAll((pageToken) =>
      lib.readRecords('HeartRate', {
        timeRangeFilter: {
          operator: 'between',
          startTime: (hrStart > start ? hrStart : start).toISOString(),
          endTime: end.toISOString(),
        },
        pageToken,
        pageSize: 5000,
      }),
    );
    const heartRate = hrRecords.flatMap((r) =>
      r.samples.map((s) => ({ t: new Date(s.time).getTime(), bpm: s.beatsPerMinute })),
    );

    const sessions: RawSession[] = await Promise.all(
      sessionRecords.map(async (r) => {
        const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
        const [cal, dist] = await Promise.all([
          lib.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range }).catch(() => null),
          lib.aggregateRecord({ recordType: 'Distance', timeRangeFilter: range }).catch(() => null),
        ]);
        const km = dist?.DISTANCE?.inKilometers;
        return {
          id: r.metadata?.id ?? `${r.startTime}`,
          type: mapExerciseType(r.exerciseType, lib.ExerciseType),
          title: r.title || undefined,
          startMs: new Date(r.startTime).getTime(),
          endMs: new Date(r.endTime).getTime(),
          activeCalories: cal?.ACTIVE_CALORIES_TOTAL?.inKilocalories
            ? Math.round(cal.ACTIVE_CALORIES_TOTAL.inKilocalories)
            : undefined,
          distanceKm: km && km > 0.05 ? Math.round(km * 100) / 100 : undefined,
        };
      }),
    );

    const resting = await lib
      .readRecords('RestingHeartRate', { timeRangeFilter, ascendingOrder: false, pageSize: 1 })
      .catch(() => ({ records: [] as { beatsPerMinute: number }[] }));

    const raw: RawHealthData = {
      source: 'healthconnect',
      days: dayKeys,
      steps,
      activeCalories,
      distanceKm,
      restingHr: resting.records[0]?.beatsPerMinute,
      sessions,
      heartRate,
    };
    return raw;
  },
};
