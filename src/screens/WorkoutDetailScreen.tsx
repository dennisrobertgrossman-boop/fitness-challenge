import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Card } from '../components/Card';
import { LineChart } from '../components/charts/LineChart';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button, Empty, StatTile, TileGrid } from '../components/ui';
import { WorkoutIcon } from '../components/WorkoutIcon';
import { ZoneBars } from '../components/ZoneBar';
import { workoutLabel } from '../data/workoutTypes';
import { formatDay, formatTime, isoToDayKey } from '../lib/dates';
import { formatDurationClock, formatNumber, formatPace } from '../lib/format';
import type { RootProps } from '../navigation/types';
import { useAppStore } from '../store/useAppStore';
import { colors, metricColors, spacing } from '../theme';

export function WorkoutDetailScreen({ route }: RootProps<'Workout'>) {
  const nav = useNavigation();
  const workout = useAppStore((s) => s.workouts.find((w) => w.id === route.params.workoutId));
  const member = useAppStore((s) => s.members.find((m) => m.id === workout?.memberId));
  const meId = useAppStore((s) => s.meId);
  const deleteWorkout = useAppStore((s) => s.deleteWorkout);

  useLayoutEffect(() => {
    if (workout) nav.setOptions({ title: workoutLabel(workout.type, workout.title) });
  }, [nav, workout]);

  if (!workout) return <Empty title="Workout not found" />;
  const w = workout;
  const end = new Date(new Date(w.start).getTime() + w.durationMin * 60000).toISOString();
  const color = member?.color ?? metricColors.workouts;
  const canDelete = w.memberId === meId && w.source === 'manual';

  const confirmDelete = () => {
    const run = () => {
      deleteWorkout(w.id);
      nav.goBack();
    };
    if (Platform.OS === 'web') run();
    else
      Alert.alert('Delete workout?', 'This removes it for everyone in the group.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: run },
      ]);
  };

  return (
    <Screen underHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl }}>
        <WorkoutIcon type={w.type} color={color} size={60} />
        <View style={{ flex: 1 }}>
          <Txt variant="title2">{workoutLabel(w.type, w.title)}</Txt>
          <Txt variant="subhead" color={colors.textSecondary}>
            {member?.name} · {formatDay(isoToDayKey(w.start), 'long')}
          </Txt>
          <Txt variant="footnote" color={colors.textMuted} tabular>
            {formatTime(w.start)}–{formatTime(end)} · {w.source === 'manual' ? 'Logged manually' : w.source === 'demo' ? 'Demo' : w.source === 'healthkit' ? 'Apple Health' : 'Health Connect'}
          </Txt>
        </View>
      </View>

      <Section title="Workout Details">
        <TileGrid>
          <StatTile label="Workout Time" value={formatDurationClock(w.durationMin)} color={metricColors.workouts} />
          {w.distanceKm ? <StatTile label="Distance" value={formatNumber(w.distanceKm, 2)} unit="km" color={metricColors.distanceKm} /> : null}
          {w.cardioLoad != null ? (
            <StatTile label="Cardio Load" value={String(w.cardioLoad)} unit="pts" color={metricColors.cardioLoad} sub="estimated from heart rate" />
          ) : null}
          {w.activeCalories ? <StatTile label="Active Calories" value={formatNumber(w.activeCalories)} unit="kcal" color={metricColors.activeCalories} /> : null}
          {w.avgHr ? <StatTile label="Avg. Heart Rate" value={String(w.avgHr)} unit="bpm" color={metricColors.steps} /> : null}
          {w.maxHr ? <StatTile label="Max Heart Rate" value={String(w.maxHr)} unit="bpm" color={metricColors.steps} /> : null}
          {w.distanceKm && (w.type === 'run' || w.type === 'walk' || w.type === 'hike') ? (
            <StatTile label="Avg. Pace" value={formatPace(w.durationMin, w.distanceKm)} />
          ) : null}
          {w.distanceKm && w.type === 'cycle' ? (
            <StatTile label="Avg. Speed" value={formatNumber(w.distanceKm / (w.durationMin / 60), 1)} unit="km/h" />
          ) : null}
        </TileGrid>
      </Section>

      {w.hrSeries && w.hrSeries.length > 1 ? (
        <Section title="Heart Rate">
          <Card subtitle={`Average ${w.avgHr} bpm · max ${w.maxHr} bpm`}>
            <LineChart
              labels={w.hrSeries.map((_, i) => `${i}'`)}
              tooltipLabels={w.hrSeries.map((_, i) => `Minute ${i + 1}`)}
              series={[{ key: 'hr', label: 'Heart rate', color: metricColors.steps, values: w.hrSeries }]}
              format={(v) => `${Math.round(v)} bpm`}
              axisFormat={(v) => String(Math.round(v))}
              yMin={Math.max(0, Math.floor((Math.min(...w.hrSeries.filter((v) => v > 0)) - 10) / 10) * 10)}
              endLabels={false}
              legend={false}
              height={150}
            />
          </Card>
        </Section>
      ) : null}

      {w.zones ? (
        <Section title="Heart Rate Zones">
          <Card>
            <ZoneBars zones={w.zones} />
          </Card>
        </Section>
      ) : null}

      {w.notes ? (
        <Section title="Notes">
          <Card>
            <Txt variant="body">{w.notes}</Txt>
          </Card>
        </Section>
      ) : null}

      {canDelete ? <Button kind="destructive" label="Delete Workout" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
