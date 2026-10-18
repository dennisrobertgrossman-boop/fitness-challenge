import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatCompact } from '../lib/format';
import { currentWeekDays, dayValue, DataView, sumRange } from '../lib/stats';
import { colors, metricColors, spacing } from '../theme';
import type { DayKey, Member } from '../types';
import { ActivityRings } from './ActivityRings';
import { Txt } from './Txt';

interface Props {
  view: DataView;
  member: Member;
  day: DayKey;
  isMe?: boolean;
  onPress?: () => void;
  last?: boolean;
}

/** A row in the "Sharing" list: mini rings, name and today's numbers. */
export function MemberRow({ view, member, day, isMe, onPress, last }: Props) {
  const steps = dayValue(view, member.id, day, 'steps');
  const cardio = dayValue(view, member.id, day, 'cardioLoad');
  const active = dayValue(view, member.id, day, 'activeMinutes');
  const weekWorkouts = sumRange(view, member.id, currentWeekDays(), 'workouts');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { opacity: 0.7 }]}
    >
      <ActivityRings
        size={52}
        rings={[
          { progress: steps / member.goals.steps, color: metricColors.steps },
          { progress: cardio / member.goals.cardioLoad, color: metricColors.cardioLoad },
          { progress: active / member.goals.activeMinutes, color: metricColors.activeMinutes },
        ]}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: member.color }} />
          <Txt variant="headline" numberOfLines={1}>
            {member.name}
            {isMe ? (
              <Txt variant="footnote" color={colors.textMuted}>
                {'  '}You
              </Txt>
            ) : null}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
          <Txt variant="footnote" color={metricColors.steps} weight="600" tabular>
            {formatCompact(steps)} steps
          </Txt>
          <Txt variant="footnote" color={metricColors.cardioLoad} weight="600" tabular>
            {cardio} cardio
          </Txt>
          <Txt variant="footnote" color={metricColors.workouts} weight="600" tabular>
            {weekWorkouts} workout{weekWorkouts === 1 ? '' : 's'} this week
          </Txt>
        </View>
      </View>
      <ChevronRight size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
});
