import { Pressable, StyleSheet, View } from 'react-native';
import { formatNumber } from '../lib/format';
import { dayValue, DataView } from '../lib/stats';
import { colors, metricColors, radius, spacing } from '../theme';
import type { DayKey, Member } from '../types';
import { ActivityRings } from './ActivityRings';
import { Txt } from './Txt';

interface Props {
  view: DataView;
  member: Member;
  day: DayKey;
  onCardioPress?: () => void;
}

/** Big rings with the three daily metrics next to them, like the Apple Fitness activity card. */
export function ActivityCard({ view, member, day, onCardioPress }: Props) {
  const steps = dayValue(view, member.id, day, 'steps');
  const cardio = dayValue(view, member.id, day, 'cardioLoad');
  const active = dayValue(view, member.id, day, 'activeMinutes');
  const cardioSource = view.daily[member.id]?.[day]?.cardioLoadSource ?? 'estimated';
  const g = member.goals;

  const rows = [
    { label: 'Steps', value: steps, goal: g.steps, unit: '', color: metricColors.steps },
    { label: 'Cardio Load', value: cardio, goal: g.cardioLoad, unit: ' PTS', color: metricColors.cardioLoad, cardio: true },
    { label: 'Active', value: active, goal: g.activeMinutes, unit: ' MIN', color: metricColors.activeMinutes },
  ];

  return (
    <View style={styles.card}>
      <ActivityRings
        size={148}
        rings={rows.map((r) => ({ progress: r.goal ? r.value / r.goal : 0, color: r.color, label: r.label }))}
      />
      <View style={{ flex: 1, gap: spacing.md }}>
        {rows.map((r) => {
          const content = (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Txt variant="subhead" weight="600">
                  {r.label}
                </Txt>
                {r.cardio ? (
                  <Txt variant="caption" color={colors.textMuted}>
                    {cardioSource === 'manual' ? 'from Google Health' : 'estimated'}
                  </Txt>
                ) : null}
              </View>
              <Txt variant="title3" color={r.color} tabular numberOfLines={1}>
                {formatNumber(r.value)}/{formatNumber(r.goal)}
                <Txt variant="footnote" color={r.color} weight="700">
                  {r.unit}
                </Txt>
              </Txt>
            </View>
          );
          return r.cardio && onCardioPress ? (
            <Pressable key={r.label} onPress={onCardioPress} accessibilityRole="button" accessibilityHint="Enter Cardio Load from the Google Health app">
              {content}
            </Pressable>
          ) : (
            <View key={r.label}>{content}</View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
