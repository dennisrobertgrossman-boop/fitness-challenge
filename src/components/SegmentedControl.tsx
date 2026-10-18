import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';
import { Txt } from './Txt';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && styles.active]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Txt variant="footnote" weight={active ? '600' : '500'} color={active ? colors.text : colors.textSecondary}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.sm + 1, padding: 2 },
  item: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.sm - 1 },
  active: { backgroundColor: '#636366' },
});
