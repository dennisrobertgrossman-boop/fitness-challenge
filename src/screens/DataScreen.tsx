import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card } from '../components/Card';
import { BarChart } from '../components/charts/BarChart';
import { Heatmap } from '../components/charts/Heatmap';
import { Chips } from '../components/Chips';
import { Screen, Section } from '../components/Screen';
import { SegmentedControl } from '../components/SegmentedControl';
import { Txt } from '../components/Txt';
import { Button } from '../components/ui';
import { WORKOUT_TYPES } from '../data/workoutTypes';
import { addDays, formatDay, formatWeek, lastNDays, lastNWeeks, todayKey } from '../lib/dates';
import { dailyCsv, shareCsv, workoutsCsv } from '../lib/exportCsv';
import { formatCompact, formatMetric, formatNumber, metricMeta } from '../lib/format';
import {
  average,
  dailySeries,
  dayValue,
  pctChange,
  personalBests,
  sumRange,
  typeBreakdown,
  weeklySeries,
  workoutsBetween,
} from '../lib/stats';
import { useAppStore, useDataView } from '../store/useAppStore';
import { colors, metricColors, spacing } from '../theme';
import type { MetricKey } from '../types';

const METRICS: MetricKey[] = ['steps', 'cardioLoad', 'workouts', 'activeMinutes', 'distanceKm', 'activeCalories'];
type Range = 'days' | 'weeks';

export function DataScreen() {
  const view = useDataView();
  const members = useAppStore((s) => s.members);
  const workouts = useAppStore((s) => s.workouts);
  const daily = useAppStore((s) => s.daily);
  const meId = useAppStore((s) => s.meId);
  const [metric, setMetric] = useState<MetricKey>('steps');
  const [range, setRange] = useState<Range>('days');
  const [heatMember, setHeatMember] = useState<string>(meId);
  const today = todayKey();
  const meta = metricMeta[metric];
  const fmt = (v: number) => formatMetric(metric, v);
  const fmtShort = (v: number) => (meta.digits ? formatNumber(v, 1) : formatCompact(v));

  // Period comparison: last 14 days vs the 14 before, or last 12 weeks vs the 12 before.
  const periodDays = range === 'days' ? lastNDays(14) : lastNDays(84);
  const prevDays = range === 'days' ? lastNDays(14, addDays(today, -14)) : lastNDays(84, addDays(today, -84));
  const weeks = lastNWeeks(12);

  const chartLabels = range === 'days' ? periodDays.map((d) => formatDay(d, 'weekday')[0]) : weeks.map((w) => formatDay(w));
  const tooltipLabels = range === 'days' ? periodDays.map((d) => formatDay(d, 'long')) : weeks.map((w) => `Week of ${formatWeek(w)}`);
  const series = members.map((m) => ({
    key: m.id,
    label: m.name,
    color: m.color,
    values: range === 'days' ? dailySeries(view, m.id, periodDays, metric) : weeklySeries(view, m.id, weeks, metric),
  }));
  const heat = members.find((m) => m.id === heatMember) ?? members[0];
  const heatMax = Math.max(1, ...Object.values(view.daily[heat.id] ?? {}).map((d) => dayValue(view, heat.id, d.date, metric)));

  return (
    <Screen title="Data">
      <Chips
        value={metric}
        onChange={setMetric}
        options={METRICS.map((m) => ({ value: m, label: metricMeta[m].label }))}
      />
      <View style={{ height: spacing.md }} />
      <SegmentedControl
        value={range}
        onChange={setRange}
        options={[
          { value: 'days', label: 'Last 14 Days' },
          { value: 'weeks', label: 'Last 12 Weeks' },
        ]}
      />
      <View style={{ height: spacing.lg }} />

      <Section>
        <Card title={`${meta.label} ${range === 'days' ? 'per Day' : 'per Week'}`} titleColor={metricColors[metric]}>
          <BarChart labels={chartLabels} tooltipLabels={tooltipLabels} series={series} format={fmt} axisFormat={fmtShort} height={170} />
        </Card>
      </Section>

      <Section title="Totals">
        <Card padded={false}>
          <View style={[styles.tr, styles.th]}>
            <Txt variant="caption" color={colors.textMuted} style={{ flex: 1.2 }}>
              {range === 'days' ? '14 DAYS' : '12 WEEKS'}
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={styles.td} align="right">
              TOTAL
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={styles.td} align="right">
              {range === 'days' ? 'PER DAY' : 'PER WEEK'}
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={styles.td} align="right">
              VS PREV
            </Txt>
          </View>
          {members.map((m, i) => {
            const total = sumRange(view, m.id, periodDays, metric);
            const prev = sumRange(view, m.id, prevDays, metric);
            const per = range === 'days' ? total / 14 : total / 12;
            const change = pctChange(total, prev);
            return (
              <View key={m.id} style={[styles.tr, i < members.length - 1 && styles.border]}>
                <View style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
                  <Txt variant="subhead" numberOfLines={1}>
                    {m.name}
                  </Txt>
                </View>
                <Txt variant="subhead" weight="600" tabular style={styles.td} align="right">
                  {fmtShort(total)}
                </Txt>
                <Txt variant="subhead" tabular style={styles.td} align="right">
                  {metric === 'workouts' || meta.digits ? formatNumber(per, 1) : formatCompact(per)}
                </Txt>
                <Txt
                  variant="subhead"
                  tabular
                  style={styles.td}
                  align="right"
                  color={change == null ? colors.textMuted : change >= 0 ? colors.success : colors.danger}
                >
                  {change == null ? '–' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}%`}
                </Txt>
              </View>
            );
          })}
        </Card>
      </Section>

      <Section title="Calendar">
        <Chips
          value={heat.id}
          onChange={setHeatMember}
          options={members.map((m) => ({ value: m.id, label: m.name, color: m.color }))}
        />
        <Card subtitle={`${meta.label} · last 12 weeks`}>
          <Heatmap
            weeks={weeks}
            value={(d) => dayValue(view, heat.id, d, metric)}
            max={metric === 'workouts' ? 2 : heatMax * 0.85}
            color={metricColors[metric]}
            format={fmt}
          />
        </Card>
      </Section>

      <Section title="Personal Bests">
        {members.map((m) => {
          const pb = personalBests(view, m.id, workouts);
          return (
            <Card key={m.id} title={m.name} titleColor={m.color}>
              <View style={styles.pbGrid}>
                <Pb label="Most steps" value={formatNumber(pb.maxSteps.value)} when={pb.maxSteps.day ? formatDay(pb.maxSteps.day) : ''} />
                <Pb label="Top Cardio Load" value={String(pb.maxCardio.value)} when={pb.maxCardio.day ? formatDay(pb.maxCardio.day) : ''} />
                <Pb
                  label="Most workouts / week"
                  value={String(pb.mostWorkoutsWeek.value)}
                  when={pb.mostWorkoutsWeek.week ? formatWeek(pb.mostWorkoutsWeek.week) : ''}
                />
                <Pb
                  label="Longest workout"
                  value={pb.longestWorkout ? `${pb.longestWorkout.durationMin} min` : '–'}
                  when={pb.longestWorkout ? WORKOUT_TYPES[pb.longestWorkout.type].label : ''}
                />
              </View>
            </Card>
          );
        })}
      </Section>

      <Section title="Workout Mix">
        <Card subtitle="Last 12 weeks, by number of sessions">
          <View style={{ gap: spacing.lg }}>
            {members.map((m) => {
              const mix = typeBreakdown(workoutsBetween(view, m.id, lastNDays(84)));
              const total = mix.reduce((s, t) => s + t.count, 0);
              return (
                <View key={m.id} style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Txt variant="subhead" weight="600">
                      {m.name}
                    </Txt>
                    <Txt variant="footnote" color={colors.textMuted} tabular>
                      {total} workouts · {formatNumber(average(weeklySeries(view, m.id, weeks, 'workouts')), 1)}/week
                    </Txt>
                  </View>
                  {mix.slice(0, 4).map((t) => (
                    <View key={t.type} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Txt variant="footnote" color={colors.textSecondary} style={{ width: 120 }} numberOfLines={1}>
                        {WORKOUT_TYPES[t.type].label}
                      </Txt>
                      <View style={{ flex: 1, height: 8, backgroundColor: colors.cardRaised, borderRadius: 4 }}>
                        <View style={{ width: `${(t.count / Math.max(1, total)) * 100}%`, height: 8, backgroundColor: m.color, borderRadius: 4 }} />
                      </View>
                      <Txt variant="footnote" tabular style={{ width: 28 }} align="right">
                        {t.count}
                      </Txt>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </Card>
      </Section>

      <Section title="Export">
        <Button
          kind="secondary"
          label="Export Daily Data (Spreadsheet)"
          icon={<Download size={18} color={colors.text} />}
          onPress={() => shareCsv('daily-metrics.csv', dailyCsv(daily, members))}
        />
        <Button
          kind="secondary"
          label="Export Workouts (Spreadsheet)"
          icon={<Download size={18} color={colors.text} />}
          onPress={() => shareCsv('workouts.csv', workoutsCsv(workouts, members))}
        />
      </Section>
    </Screen>
  );
}

function Pb({ label, value, when }: { label: string; value: string; when: string }) {
  return (
    <View style={styles.pb}>
      <Txt variant="caption" color={colors.textMuted}>
        {label}
      </Txt>
      <Txt variant="title3" tabular>
        {value}
      </Txt>
      <Txt variant="caption" color={colors.textSecondary} numberOfLines={1}>
        {when}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 12 },
  th: { paddingBottom: 4 },
  td: { flex: 1 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  pbGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  pb: { width: '50%', gap: 1 },
});
