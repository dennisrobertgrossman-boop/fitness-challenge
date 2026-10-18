import { View } from 'react-native';
import { colors, spacing } from '../../theme';
import { Txt } from '../Txt';

export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: it.color }} />
          <Txt variant="footnote" color={colors.textSecondary}>
            {it.label}
            {it.value ? (
              <Txt variant="footnote" color={colors.text} weight="600" tabular>
                {'  '}
                {it.value}
              </Txt>
            ) : null}
          </Txt>
        </View>
      ))}
    </View>
  );
}
