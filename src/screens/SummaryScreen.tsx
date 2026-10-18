import { useNavigation } from '@react-navigation/native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { ActivityCard } from '../components/ActivityCard';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { DemoBanner } from '../components/DemoBanner';
import { MemberRow } from '../components/MemberRow';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { WeekStrip } from '../components/WeekStrip';
import { WorkoutRow } from '../components/WorkoutRow';
import { addDays, formatDay, lastNDays, startOfWeek, todayKey } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { challengeDays, standings } from '../lib/scoring';
import { average, currentWeekDays, dailySeries, pctChange, sumRange, weekDays } from '../lib/stats';
import { useAppStore, useDataView, useMe } from '../store/useAppStore';
import { colors, metricColors, spacing } from '../theme';
import type { MetricKey } from '../types';

export function SummaryScreen() {
  const nav = useNavigation();
  const view = useDataView();
  const me = useMe();
  const members = useAppStore((s) => s.members);
  const challenge = useAppStore((s) => s.challenge);
  const workouts = useAppStore((s) => s.workouts);
  const busy = useAppStore((s) => s.busy);
  const mode = useAppStore((s) => s.mode);
  const refreshDemo = useAppStore((s) => s.refreshDemo);
  const syncHealthNow = useAppStore((s) => s.syncHealthNow);
  const today = todayKey();

  const ordered = [me, ...members.filter((m) => m.id !== me.id)];
  const table = standings(view, challenge, members);
  const myStanding = table.find((s) => s.member.id === me.id);
  const leader = table[0];
  const { all, elapsed } = challengeDays(challenge);
  const challengeLive = today >= challenge.start && today <= challenge.end;

  const weekWorkouts = sumRange(view, me.id, currentWeekDays(), 'workouts');
  const myRecent = workouts.filter((w) => w.memberId === me.id).slice(0, 3);

  const trend = (metric: MetricKey) => {
    const cur = average(dailySeries(view, me.id, lastNDays(7, addDays(today, -1)), metric));
    const prev = average(dailySeries(view, me.id, lastNDays(7, addDays(today, -8)), metric));
    return { cur, change: pctChange(cur, prev) };
  };

  const onRefresh = () => {
    if (mode === 'demo') refreshDemo();
    else syncHealthNow().catch(() => {});
  };

  return (
    <Screen
      eyebrow={formatDay(today, 'long')}
      title="Summary"
      onRefresh={onRefresh}
      refreshing={busy}
      right={
        <Pressable onPress={() => nav.navigate('Settings')} accessibilityLabel="Settings" accessibilityRole="button">
          <Avatar name={me.name} color={me.color} size={38} />
        </Pressable>
      }
    >
      <DemoBanner />

      <Section title="Activity">
        <ActivityCard view={view} member={me} day={today} onCardioPress={() => nav.navigate('CardioLoad')} />
        <Card title="This Week" subtitle={`${weekWorkouts} of ${me.goals.workoutsPerWeek} workouts done`}>
          <WeekStrip view={view} member={me} days={weekDays(startOfWeek(today))} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.lg }}>
            {Array.from({ length: Math.max(me.goals.workoutsPerWeek, weekWorkouts) }, (_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i < weekWorkouts ? metricColors.workouts : colors.cardRaised,
                }}
              />
            ))}
          </View>
        </Card>
      </Section>

      <Section title="Challenge">
        <Card
          title={challenge.name}
          subtitle={
            challengeLive
              ? `Day ${elapsed.length} of ${all.length} · ${all.length - elapsed.length} days left`
              : today < challenge.start
                ? `Starts ${formatDay(challenge.start)}`
                : 'Finished'
          }
          onPress={() => nav.navigate('Tabs', { screen: 'Challenge' })}
        >
          <View style={{ gap: spacing.sm }}>
            {table.map((s) => (
              <View key={s.member.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Txt variant="subhead" weight="700" color={colors.textMuted} style={{ width: 16 }} tabular>
                  {s.rank}
                </Txt>
                <Txt variant="subhead" style={{ width: 72 }} numberOfLines={1}>
                  {s.member.name}
                </Txt>
                <View style={{ flex: 1, height: 8, backgroundColor: colors.cardRaised, borderRadius: 4 }}>
                  <View
                    style={{
                      width: `${leader?.total ? (s.total / leader.total) * 100 : 0}%`,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: s.member.color,
                    }}
                  />
                </View>
                <Txt variant="subhead" weight="600" tabular style={{ width: 64 }} align="right">
                  {formatNumber(s.total)}
                </Txt>
              </View>
            ))}
          </View>
          {myStanding && leader && (
            <Txt variant="footnote" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
              {myStanding.rank === 1
                ? table[1]
                  ? `You lead by ${formatNumber(myStanding.total - table[1].total)} points. +${myStanding.today} today.`
                  : `+${myStanding.today} points today.`
                : `${formatNumber(leader.total - myStanding.total)} points behind ${leader.member.name}. +${myStanding.today} today.`}
            </Txt>
          )}
        </Card>
      </Section>

      <Section title="Brothers">
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {ordered.map((m, i) => (
            <MemberRow
              key={m.id}
              view={view}
              member={m}
              day={today}
              isMe={m.id === me.id}
              last={i === ordered.length - 1}
              onPress={() => nav.navigate('Member', { memberId: m.id })}
            />
          ))}
        </Card>
        {members.length < 2 ? (
          <Txt variant="footnote" color={colors.textMuted}>
            Invite your brothers from Settings → Group to see their data here.
          </Txt>
        ) : null}
      </Section>

      <Section
        title="Workouts"
        action={
          <Pressable onPress={() => nav.navigate('Tabs', { screen: 'Workouts' })} accessibilityRole="button">
            <Txt variant="subhead" color={colors.accent}>
              Show More
            </Txt>
          </Pressable>
        }
      >
        {myRecent.length ? (
          myRecent.map((w) => (
            <WorkoutRow key={w.id} workout={w} member={me} onPress={() => nav.navigate('Workout', { workoutId: w.id })} />
          ))
        ) : (
          <Card>
            <Txt variant="subhead" color={colors.textMuted}>
              No workouts yet. Sync your health data or log one from the Workouts tab.
            </Txt>
          </Card>
        )}
      </Section>

      <Section title="Trends">
        <Txt variant="footnote" color={colors.textMuted} style={{ marginTop: -6 }}>
          Daily average, last 7 days vs. the 7 days before
        </Txt>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {(['steps', 'cardioLoad', 'activeMinutes'] as const).map((m) => {
            const t = trend(m);
            const up = (t.change ?? 0) >= 0;
            const Icon = up ? TrendingUp : TrendingDown;
            const color = metricColors[m];
            return (
              <Card key={m} style={{ flex: 1 }}>
                <Icon size={20} color={color} />
                <Txt variant="caption" color={colors.textSecondary} style={{ marginTop: 6 }} numberOfLines={1}>
                  {m === 'steps' ? 'Steps' : m === 'cardioLoad' ? 'Cardio Load' : 'Active Min'}
                </Txt>
                <Txt variant="headline" color={color} tabular>
                  {formatNumber(t.cur)}
                </Txt>
                <Txt variant="caption" color={colors.textMuted} tabular>
                  {t.change == null ? '–' : `${up ? '+' : ''}${t.change.toFixed(0)} %`}
                </Txt>
              </Card>
            );
          })}
        </View>
      </Section>
    </Screen>
  );
}
