import { View } from 'react-native';
import { ZONES } from '../lib/heartRate';
import { colors, spacing } from '../theme';
import type { ZoneMinutes } from '../types';
import { Txt } from './Txt';

/** Horizontal bars of minutes in each heart-rate zone. */
export function ZoneBars({ zones }: { zones: ZoneMinutes }) {
  const max = Math.max(1, ...ZONES.map((z) => zones[z.key]));
  return (
    <View style={{ gap: spacing.sm }}>
      {ZONES.map((z) => (
        <View key={z.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Txt variant="footnote" color={colors.textSecondary} style={{ width: 72 }}>
            {z.label}
          </Txt>
          <View style={{ flex: 1, height: 10, backgroundColor: colors.cardRaised, borderRadius: 5 }}>
            <View
              style={{
                width: `${(zones[z.key] / max) * 100}%`,
                height: 10,
                borderRadius: 5,
                backgroundColor: z.color,
              }}
            />
          </View>
          <Txt variant="footnote" tabular style={{ width: 52 }} align="right">
            {zones[z.key]} min
          </Txt>
        </View>
      ))}
    </View>
  );
}
