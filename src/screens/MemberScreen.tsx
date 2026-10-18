import { useNavigation } from '@react-navigation/native';
import { useLayoutEffect } from 'react';
import { View } from 'react-native';
import { ActivityCard } from '../components/ActivityCard';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { BarChart } from '../components/charts/BarChart';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Empty, StatTile, TileGrid } from '../components/ui';
import { WeekStrip } from '../components/WeekStrip';
import { WorkoutRow } from '../components/WorkoutRow';
import { formatDay, formatWeek, lastNDays, lastNWeeks, startOfWeek, todayKey } from '../lib/dates';
import { formatCompact, formatNumber } from '../lib/format';
import {
  average,
  currentWeekDays,
  dailySeries,
  stepGoalStreak,
  sumRange,
  weekDays,
  weeklySeries,
  workoutWeekStreak,
} from '../lib/stats';
import type { RootProps } from '../navigation/types';
import { useAppStore, useDataView, useMember } from '../store/useAppStore';
import { colors, metricColors, spacing } from '../theme';

export function MemberScreen({ route }: RootProps<'Member'>) {
  const nav = useNavigation();
  const view = useDataView();
  const member = useMember(route.params.memberId);
  const meId = useAppStore((s) => s.meId);
  const workouts = useAppStore((s) => s.workouts);
  const today = todayKey();

  useLayoutEffect(() => {
    nav.setOptions({ title: member?.name ?? '' });
  }, [nav, member?.name]);

  if (!member) return <Empty title="Member not found" />;

  const isMe = member.id === meId;
  const days30 = lastNDays(30);
  const weeks = lastNWeeks(12);
  const week = currentWeekDays();
  const recent = workouts.filter((w) => w.memberId === member.id).slice(0, 5);
  const stepsSeries = dailySeries(view, member.id, days30, 'steps');
  const weeklyCardio = weeklySeries(view, member.id, weeks, 'cardioLoad');
  const weeklyWorkouts = weeklySeries(view, member.id, weeks, 'workouts');

  return (
    <Screen underHeader>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}>
        <Avatar name={member.name} color={member.color} size={56} />
        <View>
          <Txt variant="title">{member.name}</Txt>
          <Txt variant="footnote" color={colors.textMuted}>
            {isMe ? 'You' : 'Brother'} · {formatDay(today, 'long')}
          </Txt>
        </View>
      </View>

      <Section title="Today">
        <ActivityCard view={view} member={member} day={today} onCardioPress={isMe ? () => nav.navigate('CardioLoad') : undefined} />
        <Card title="This Week">
          <WeekStrip view={view} member={member} days={weekDays(startOfWeek(today))} />
        </Card>
        <TileGrid>
          <StatTile label="Steps this week" value={formatCompact(sumRange(view, member.id, week, 'steps'))} color={metricColors.steps} />
          <StatTile label="Cardio Load this week" value={formatNumber(sumRange(view, member.id, week, 'cardioLoad'))} color={metricColors.cardioLoad} />
          <StatTile
            label="Workouts this week"
            value={`${sumRange(view, member.id, week, 'workouts')}`}
            unit={`/ ${member.goals.workoutsPerWeek}`}
            color={metricColors.workouts}
          />
          <StatTile
            label="Distance this week"
            value={formatNumber(sumRange(view, member.id, week, 'distanceKm'), 1)}
            unit="km"
            color={metricColors.distanceKm}
          />
          <StatTile label="Step goal streak" value={String(stepGoalStreak(view, member))} unit="days" sub={`${formatNumber(member.goals.steps)}+ steps a day`} />
          <StatTile
            label="Workout goal streak"
            value={String(workoutWeekStreak(view, member))}
            unit="weeks"
            sub={`${member.goals.workoutsPerWeek}+ workouts a week`}
          />
        </TileGrid>
      </Section>

      <Section title="Steps">
        <Card subtitle={`Last 30 days · average ${formatNumber(average(stepsSeries))} a day`}>
          <BarChart
            labels={days30.map((d) => formatDay(d))}
            tooltipLabels={days30.map((d) => formatDay(d, 'long'))}
            series={[{ key: 'steps', label: 'Steps', color: metricColors.steps, values: stepsSeries }]}
            goal={member.goals.steps}
            format={(v) => formatNumber(v)}
            axisFormat={formatCompact}
            height={140}
          />
        </Card>
      </Section>

      <Section title="Cardio Load">
        <Card subtitle={`Weekly total · goal ${formatNumber(member.goals.cardioLoad * 7)} a week`}>
          <BarChart
            labels={weeks.map((w) => formatDay(w))}
            tooltipLabels={weeks.map((w) => `Week of ${formatWeek(w)}`)}
            series={[{ key: 'c', label: 'Cardio Load', color: metricColors.cardioLoad, values: weeklyCardio }]}
            goal={member.goals.cardioLoad * 7}
            format={(v) => `${formatNumber(v)} pts`}
            axisFormat={formatCompact}
            height={140}
          />
        </Card>
      </Section>

      <Section title="Workouts per Week">
        <Card subtitle={`Last 12 weeks · average ${formatNumber(average(weeklyWorkouts), 1)} a week`}>
          <BarChart
            labels={weeks.map((w) => formatDay(w))}
            tooltipLabels={weeks.map((w) => `Week of ${formatWeek(w)}`)}
            series={[{ key: 'w', label: 'Workouts', color: member.color, values: weeklyWorkouts }]}
            goal={member.goals.workoutsPerWeek}
            height={120}
          />
        </Card>
      </Section>

      <Section title="Recent Workouts">
        {recent.length ? (
          recent.map((w) => (
            <WorkoutRow key={w.id} workout={w} member={member} onPress={() => nav.navigate('Workout', { workoutId: w.id })} />
          ))
        ) : (
          <Empty title="No workouts yet" />
        )}
      </Section>
    </Screen>
  );
}
