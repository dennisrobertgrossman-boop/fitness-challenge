import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { Chips } from '../components/Chips';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button, Field, Stepper } from '../components/ui';
import { WorkoutIcon } from '../components/WorkoutIcon';
import { WORKOUT_TYPES, WORKOUT_TYPE_ORDER } from '../data/workoutTypes';
import { fromDayKey, lastNDays, relativeDay } from '../lib/dates';
import { formatDuration } from '../lib/format';
import { maxHr, minuteLoad } from '../lib/heartRate';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, radius, spacing } from '../theme';
import type { WorkoutType } from '../types';

export function AddWorkoutScreen() {
  const nav = useNavigation();
  const me = useMe();
  const profile = useAppStore((s) => s.profile);
  const addWorkout = useAppStore((s) => s.addWorkout);
  const days = lastNDays(7).reverse();

  const [type, setType] = useState<WorkoutType>('run');
  const [day, setDay] = useState(days[0]);
  const [time, setTime] = useState(() => {
    const d = new Date(Date.now() - 45 * 60000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [duration, setDuration] = useState(45);
  const [distance, setDistance] = useState('');
  const [calories, setCalories] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const meta = WORKOUT_TYPES[type];

  const save = () => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      setError('Enter the start time as HH:MM, e.g. 07:30.');
      return;
    }
    const start = fromDayKey(day);
    start.setHours(Number(m[1]), Number(m[2]), 0, 0);
    const hr = Number(avgHr) || undefined;
    // Without heart rate, assume a typical effort for this workout type.
    const assumedBpm = profile.restingHr + (0.3 + meta.intensity * 0.5) * (maxHr(profile) - profile.restingHr);
    const bpm = hr ?? assumedBpm;
    const km = Number(distance.replace(',', '.')) || undefined;
    addWorkout({
      id: `manual-${Date.now()}`,
      memberId: me.id,
      type,
      start: start.toISOString(),
      durationMin: duration,
      distanceKm: meta.hasDistance ? km : undefined,
      activeCalories: Number(calories) || Math.round(meta.kcalPerMin * duration),
      avgHr: hr,
      cardioLoad: Math.round(minuteLoad(bpm, profile) * duration),
      source: 'manual',
      notes: notes.trim() || undefined,
    });
    nav.goBack();
  };

  return (
    <Screen underHeader>
      <Section title="Type">
        <View style={styles.grid}>
          {WORKOUT_TYPE_ORDER.map((t) => {
            const active = t === type;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.typeTile, active && { borderColor: me.color, backgroundColor: colors.cardRaised }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <WorkoutIcon type={t} color={active ? me.color : colors.textMuted} size={36} />
                <Txt variant="caption" align="center" numberOfLines={1} color={active ? colors.text : colors.textSecondary}>
                  {WORKOUT_TYPES[t].label}
                </Txt>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="When">
        <Chips value={day} onChange={setDay} options={days.map((d) => ({ value: d, label: relativeDay(d) }))} />
        <Field label="Start time" value={time} onChangeText={setTime} placeholder="07:30" keyboardType="numbers-and-punctuation" />
      </Section>

      <Section title="Details">
        <Card>
          <View style={styles.row}>
            <Txt variant="body">Duration</Txt>
            <Stepper value={duration} onChange={setDuration} step={5} min={5} format={formatDuration} />
          </View>
        </Card>
        {meta.hasDistance ? (
          <Field label="Distance (km)" value={distance} onChangeText={setDistance} placeholder="5.0" keyboardType="decimal-pad" />
        ) : null}
        <Field
          label="Active calories (optional)"
          value={calories}
          onChangeText={setCalories}
          placeholder={`≈ ${Math.round(meta.kcalPerMin * duration)}`}
          keyboardType="number-pad"
        />
        <Field
          label="Average heart rate (optional, improves the Cardio Load estimate)"
          value={avgHr}
          onChangeText={setAvgHr}
          placeholder="bpm"
          keyboardType="number-pad"
        />
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="How did it feel?" multiline />
      </Section>

      {error ? (
        <Txt variant="footnote" color={colors.danger} style={{ marginBottom: spacing.md }}>
          {error}
        </Txt>
      ) : null}
      <Button label="Save Workout" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeTile: {
    width: '31.5%',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
