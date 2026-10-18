import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme';
import { Txt } from '../Txt';

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
}

export const TOOLTIP_WIDTH = 150;

export function Tooltip({ title, rows, left }: { title: string; rows: TooltipRow[]; left: number }) {
  return (
    <View style={[styles.box, { left }]} pointerEvents="none">
      <Txt variant="caption" color={colors.textMuted} weight="600">
        {title}
      </Txt>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          {r.color ? <View style={[styles.swatch, { backgroundColor: r.color }]} /> : null}
          <Txt variant="caption" color={colors.textSecondary} style={{ flex: 1 }} numberOfLines={1}>
            {r.label}
          </Txt>
          <Txt variant="caption" weight="600" tabular>
            {r.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    top: 0,
    width: TOOLTIP_WIDTH,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
});
