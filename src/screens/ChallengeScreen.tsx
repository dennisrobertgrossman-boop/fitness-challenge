import { useNavigation } from '@react-navigation/native';
import { Crown, Medal } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { Card } from '../components/Card';
import { LineChart } from '../components/charts/LineChart';
import { Legend } from '../components/charts/Legend';
import { Screen, Section } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { Txt } from '../components/Txt';
import { formatDay, formatWeek, startOfWeek, todayKey } from '../lib/dates';
import { formatCompact, formatMetric, formatNumber, metricMeta } from '../lib/format';
import { challengeDays, MAX_DAY_POINTS, standings, weeklyResults } from '../lib/scoring';
import { DataView, sumRange, weekDays } from '../lib/stats';
import { useAppStore, useDataView } from '../store/useAppStore';
import { colors, metricColors, radius, spacing } from '../theme';
import type { DayKey, Member, MetricKey } from '../types';

const MEDALS = [colors.gold, colors.silver, colors.bronze];

function HeadToHead({ view, members, days }: { view: DataView; members: Member[]; days: DayKey[] }) {
  const metrics: MetricKey[] = ['steps', 'cardioLoad', 'workouts', 'activeMinutes', 'distanceKm', 'activeCalories'];
  return (
    <View>
      <View style={[styles.h2hRow, { borderBottomWidth: 0 }]}>
        <View style={{ flex: 1.3 }} />
        {members.map((m) => (
          <View key={m.id} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            <Avatar name={m.name} color={m.color} size={28} />
            <Txt variant="caption" color={colors.textSecondary} numberOfLines={1}>
              {m.name}
            </Txt>
          </View>
        ))}
      </View>
      {metrics.map((metric) => {
        const values = members.map((m) => sumRange(view, m.id, days, metric));
        const best = Math.max(...values);
        return (
          <View key={metric} style={styles.h2hRow}>
            <Txt variant="footnote" color={colors.textSecondary} style={{ flex: 1.3 }}>
              {metricMeta[metric].label}
            </Txt>
            {values.map((v, i) => {
              const lead = v === best && v > 0;
              return (
                <View key={members[i].id} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={[styles.h2hCell, lead && { backgroundColor: members[i].color + '33' }]}>
                    <Txt
                      variant="subhead"
                      weight={lead ? '700' : '400'}
                      color={lead ? colors.text : colors.textSecondary}
                      tabular
                    >
                      {metric === 'distanceKm' ? formatNumber(v, 1) : formatCompact(v)}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export function ChallengeScreen() {
  const nav = useNavigation();
  const view = useDataView();
  const members = useAppStore((s) => s.members);
  const challenge = useAppStore((s) => s.challenge);
  const [range, setRange] = useState<'week' | 'challenge'>('week');
  const today = todayKey();

  const table = standings(view, challenge, members);
  const weeks = weeklyResults(view, challenge, members);
  const { all, elapsed } = challengeDays(challenge);
  const wins: Record<string, number> = {};
  for (const w of weeks) if (w.winnerId) wins[w.winnerId] = (wins[w.winnerId] ?? 0) + 1;
  const maxTotal = Math.max(1, ...table.map((t) => t.total));
  const thisWeek = weekDays(startOfWeek(today)).filter((d) => d <= today);
  const h2hDays = range === 'week' ? thisWeek : elapsed;

  const status =
    today < challenge.start
      ? `Starts ${formatDay(challenge.start, 'long')}`
      : today > challenge.end
        ? `Ended ${formatDay(challenge.end)}`
        : `Day ${elapsed.length} of ${all.length} · ends ${formatDay(challenge.end)}`;

  return (
    <Screen eyebrow={status} title={challenge.name}>
      <Section>
        <Card padded={false}>
          {table.map((s, i) => (
            <Pressable
              key={s.member.id}
              onPress={() => nav.navigate('Member', { memberId: s.member.id })}
              style={[styles.standing, i < table.length - 1 && styles.border]}
              accessibilityRole="button"
            >
              <View style={{ width: 28, alignItems: 'center' }}>
                {s.rank <= 3 && s.total > 0 ? (
                  <Medal size={24} color={MEDALS[s.rank - 1]} />
                ) : (
                  <Txt variant="headline" color={colors.textMuted}>
                    {s.rank}
                  </Txt>
                )}
              </View>
              <Avatar name={s.member.name} color={s.member.color} size={40} />
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Txt variant="headline">{s.member.name}</Txt>
                  {wins[s.member.id] ? (
                    <View style={styles.winBadge}>
                      <Crown size={12} color={colors.gold} />
                      <Txt variant="caption" color={colors.gold} weight="700">
                        {wins[s.member.id]}
                      </Txt>
                    </View>
                  ) : null}
                </View>
                {/* Points split: steps / cardio / workouts, separated by a 2px gap */}
                <View style={{ flexDirection: 'row', height: 8, width: `${(s.total / maxTotal) * 100}%`, gap: 2 }}>
                  <View style={{ flex: s.breakdown.steps || 0.0001, backgroundColor: metricColors.steps, borderRadius: 3 }} />
                  <View style={{ flex: s.breakdown.cardio || 0.0001, backgroundColor: metricColors.cardioLoad, borderRadius: 3 }} />
                  <View style={{ flex: s.breakdown.workouts || 0.0001, backgroundColor: metricColors.workouts, borderRadius: 3 }} />
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt variant="title3" tabular>
                  {formatNumber(s.total)}
                </Txt>
                <Txt variant="caption" color={colors.textMuted} tabular>
                  +{s.today} today
                </Txt>
              </View>
            </Pressable>
          ))}
          <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
            <Legend
              items={[
                { label: 'Steps pts', color: metricColors.steps },
                { label: 'Cardio pts', color: metricColors.cardioLoad },
                { label: 'Workout pts', color: metricColors.workouts },
              ]}
            />
          </View>
        </Card>
      </Section>

      <Section title="Race">
        <Card subtitle="Cumulative points, day by day" title="Points over time">
          <LineChart
            labels={all.map((d) => formatDay(d))}
            tooltipLabels={all.map((d) => formatDay(d, 'long'))}
            slots={all.length}
            series={table.map((s) => ({ key: s.member.id, label: s.member.name, color: s.member.color, values: s.cumulative }))}
            format={(v) => formatNumber(v)}
            axisFormat={formatCompact}
          />
        </Card>
      </Section>

      <Section title="Head to Head">
        <SegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: 'This Week' },
            { value: 'challenge', label: 'Whole Challenge' },
          ]}
        />
        <Card>
          <HeadToHead view={view} members={members} days={h2hDays} />
        </Card>
      </Section>

      <Section title="Weekly Winners">
        <Card padded={false}>
          {[...weeks].reverse().map((w, i) => {
            const ranked = members
              .map((m) => ({ m, p: w.points[m.id] ?? 0 }))
              .sort((a, b) => b.p - a.p);
            return (
              <View key={w.monday} style={[styles.weekRow, i < weeks.length - 1 && styles.border]}>
                <View style={{ width: 96 }}>
                  <Txt variant="subhead" weight="600">
                    {formatWeek(w.monday)}
                  </Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {w.complete ? 'Final' : 'In progress'}
                  </Txt>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  {ranked.map(({ m, p }) => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {w.winnerId === m.id ? (
                        <Crown size={12} color={colors.gold} />
                      ) : (
                        <View style={{ width: 12 }} />
                      )}
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                      <Txt variant="footnote" style={{ flex: 1 }} numberOfLines={1}>
                        {m.name}
                      </Txt>
                      <Txt variant="footnote" tabular color={colors.textSecondary}>
                        {formatNumber(p)}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="How Scoring Works">
        <Card>
          <View style={{ gap: spacing.sm }}>
            <Txt variant="subhead" color={colors.textSecondary}>
              Everyone is scored against the same targets, so the challenge is fair even if your personal goals differ.
            </Txt>
            <Rule color={metricColors.steps} text={`1 point per 1 % of ${formatMetric('steps', challenge.targets.steps)} (max 200 a day)`} />
            <Rule
              color={metricColors.cardioLoad}
              text={`1 point per 1 % of ${challenge.targets.cardioLoad} Cardio Load (max 200 a day)`}
            />
            <Rule
              color={metricColors.workouts}
              text={`100 points per workout of ${challenge.targets.minWorkoutMin}+ min (max 2 a day)`}
            />
            <Txt variant="footnote" color={colors.textMuted}>
              A perfect day is worth {MAX_DAY_POINTS} points. Change targets and dates in Settings.
            </Txt>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

function Rule({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Txt variant="subhead" style={{ flex: 1 }}>
        {text}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  standing: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#3A3000',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  h2hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  h2hCell: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  weekRow: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
});
