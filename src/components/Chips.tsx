import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Txt } from './Txt';

interface Props<T extends string> {
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** Horizontally scrolling filter chips. */
export function Chips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && { backgroundColor: colors.text }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {o.color ? <View style={[styles.dot, { backgroundColor: o.color }]} /> : null}
            <Txt variant="footnote" weight="600" color={active ? colors.bg : colors.text}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
