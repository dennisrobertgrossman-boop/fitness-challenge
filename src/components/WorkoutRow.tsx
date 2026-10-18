import { Pressable, StyleSheet, View } from 'react-native';
import { workoutLabel } from '../data/workoutTypes';
import { formatTime, isoToDayKey, relativeDay } from '../lib/dates';
import { formatDuration, formatNumber } from '../lib/format';
import { colors, metricColors, radius, spacing } from '../theme';
import type { Member, Workout } from '../types';
import { Txt } from './Txt';
import { WorkoutIcon } from './WorkoutIcon';

interface Props {
  workout: Workout;
  member?: Member;
  showMember?: boolean;
  onPress?: () => void;
}

export function WorkoutRow({ workout: w, member, showMember, onPress }: Props) {
  const color = member?.color ?? metricColors.workouts;
  const headline = w.distanceKm
    ? `${formatNumber(w.distanceKm, 2)} km`
    : formatDuration(w.durationMin);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
    >
      <WorkoutIcon type={w.type} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="subhead" weight="600" numberOfLines={1}>
          {workoutLabel(w.type, w.title)}
        </Txt>
        <Txt variant="title3" color={color} tabular>
          {headline}
        </Txt>
        <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>
          {showMember && member ? `${member.name} · ` : ''}
          {w.distanceKm ? `${formatDuration(w.durationMin)} · ` : ''}
          {w.cardioLoad != null ? `${w.cardioLoad} Cardio Load` : w.activeCalories ? `${w.activeCalories} kcal` : ''}
        </Txt>
      </View>
      <View style={{ alignItems: 'flex-end', alignSelf: 'flex-start', gap: 2 }}>
        <Txt variant="caption" color={colors.textMuted}>
          {relativeDay(isoToDayKey(w.start))}
        </Txt>
        <Txt variant="caption" color={colors.textMuted} tabular>
          {formatTime(w.start)}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
});
