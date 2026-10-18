import { useNavigation } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card } from '../components/Card';
import { BarChart } from '../components/charts/BarChart';
import { Chips } from '../components/Chips';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Empty } from '../components/ui';
import { WorkoutRow } from '../components/WorkoutRow';
import { WORKOUT_TYPES, WORKOUT_TYPE_ORDER } from '../data/workoutTypes';
import { formatDay, formatWeek, isoToDayKey, lastNWeeks, startOfWeek, todayKey } from '../lib/dates';
import { formatDuration } from '../lib/format';
import { currentWeekDays, weeklySeries, workoutsBetween } from '../lib/stats';
import { useAppStore, useDataView } from '../store/useAppStore';
import { colors, spacing } from '../theme';
import type { Workout, WorkoutType } from '../types';

export function WorkoutsScreen() {
  const nav = useNavigation();
  const view = useDataView();
  const members = useAppStore((s) => s.members);
  const workouts = useAppStore((s) => s.workouts);
  const [who, setWho] = useState<string>('all');
  const [type, setType] = useState<WorkoutType | 'all'>('all');
  const today = todayKey();
  const weeks = lastNWeeks(8);
  const thisWeek = currentWeekDays();

  const presentTypes = useMemo(() => {
    const set = new Set(workouts.map((w) => w.type));
    return WORKOUT_TYPE_ORDER.filter((t) => set.has(t));
  }, [workouts]);

  const filtered = workouts.filter((w) => (who === 'all' || w.memberId === who) && (type === 'all' || w.type === type));

  const grouped = useMemo(() => {
    const groups: { monday: string; items: Workout[] }[] = [];
    for (const w of filtered.slice(0, 150)) {
      const monday = startOfWeek(isoToDayKey(w.start));
      const last = groups[groups.length - 1];
      if (last && last.monday === monday) last.items.push(w);
      else groups.push({ monday, items: [w] });
    }
    return groups;
  }, [filtered]);

  const thisMonday = startOfWeek(today);
  const weekTitle = (monday: string) =>
    monday === thisMonday ? 'This Week' : monday === lastNWeeks(2)[0] ? 'Last Week' : formatWeek(monday);

  return (
    <Screen
      title="Workouts"
      right={
        <Pressable
          onPress={() => nav.navigate('AddWorkout')}
          accessibilityLabel="Log a workout"
          accessibilityRole="button"
          style={{ backgroundColor: colors.card, borderRadius: 20, padding: 8 }}
        >
          <Plus size={22} color={colors.accent} />
        </Pressable>
      }
    >
      <Section title="This Week">
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {members.map((m) => {
            const ws = workoutsBetween(view, m.id, thisWeek);
            const minutes = ws.reduce((s, w) => s + w.durationMin, 0);
            return (
              <Card key={m.id} style={{ flex: 1 }} padded>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                  <Txt variant="footnote" color={colors.textSecondary} numberOfLines={1}>
                    {m.name}
                  </Txt>
                </View>
                <Txt variant="title" tabular>
                  {ws.length}
                  <Txt variant="subhead" color={colors.textMuted}>
                    /{m.goals.workoutsPerWeek}
                  </Txt>
                </Txt>
                <Txt variant="caption" color={colors.textMuted}>
                  {formatDuration(minutes)}
                </Txt>
              </Card>
            );
          })}
        </View>
      </Section>

      <Section title="Workouts per Week">
        <Card subtitle="Last 8 weeks · tap a week for details">
          <BarChart
            labels={weeks.map((w) => formatDay(w))}
            tooltipLabels={weeks.map((w) => formatWeek(w))}
            series={members.map((m) => ({
              key: m.id,
              label: m.name,
              color: m.color,
              values: weeklySeries(view, m.id, weeks, 'workouts'),
            }))}
            height={140}
          />
          <Txt variant="footnote" color={colors.textMuted} style={{ marginTop: spacing.md }}>
            8-week total:{' '}
            {members
              .map((m) => `${m.name} ${weeklySeries(view, m.id, weeks, 'workouts').reduce((a, b) => a + b, 0)}`)
              .join(' · ')}
          </Txt>
        </Card>
      </Section>

      <Section title="All Workouts">
        <Chips
          value={who}
          onChange={setWho}
          options={[
            { value: 'all', label: 'Everyone' },
            ...members.map((m) => ({ value: m.id, label: m.name, color: m.color })),
          ]}
        />
        <Chips
          value={type}
          onChange={setType}
          options={[
            { value: 'all' as const, label: 'All types' },
            ...presentTypes.map((t) => ({ value: t, label: WORKOUT_TYPES[t].label })),
          ]}
        />
        {grouped.length === 0 ? (
          <Empty title="No workouts" body="Nothing matches these filters yet." />
        ) : (
          grouped.map((g) => (
            <View key={g.monday} style={{ gap: spacing.sm }}>
              <Txt variant="footnote" weight="600" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                {weekTitle(g.monday).toUpperCase()} · {g.items.length} WORKOUT{g.items.length === 1 ? '' : 'S'}
              </Txt>
              {g.items.map((w) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  member={members.find((m) => m.id === w.memberId)}
                  showMember
                  onPress={() => nav.navigate('Workout', { workoutId: w.id })}
                />
              ))}
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}
