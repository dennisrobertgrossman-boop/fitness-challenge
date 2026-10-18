import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button } from '../components/ui';
import { formatDay, lastNDays, relativeDay } from '../lib/dates';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, fontFamily, metricColors, radius, spacing } from '../theme';

/**
 * Lets you copy the daily Cardio Load from the Google Health app. Typed values
 * replace the heart-rate estimate everywhere, including challenge points.
 */
export function CardioLoadScreen() {
  const nav = useNavigation();
  const me = useMe();
  const daily = useAppStore((s) => s.daily[me.id] ?? {});
  const setCardioOverride = useAppStore((s) => s.setCardioOverride);
  const days = lastNDays(14).reverse();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const save = () => {
    for (const [day, raw] of Object.entries(drafts)) {
      const trimmed = raw.trim();
      if (trimmed === '') continue;
      const n = Number(trimmed);
      if (!Number.isNaN(n) && n >= 0) setCardioOverride(me.id, day, n);
    }
    nav.goBack();
  };

  return (
    <Screen underHeader>
      <Card style={{ marginBottom: spacing.xl }}>
        <Txt variant="subhead" color={colors.textSecondary}>
          This app can't read Google's own Cardio Load number directly, so it estimates it from your heart rate. For exact
          values, copy the daily Cardio Load from the Google Health app here. Typed values replace the estimate in all
          charts and in challenge points.
        </Txt>
      </Card>
      <Section title="Last 14 Days">
        <Card padded={false}>
          {days.map((d, i) => {
            const row = daily[d];
            const manual = row?.cardioLoadSource === 'manual';
            return (
              <View key={d} style={[styles.row, i < days.length - 1 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{relativeDay(d)}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {formatDay(d, 'long')} · {manual ? 'from Google Health' : `estimate ${row?.cardioLoad ?? 0}`}
                  </Txt>
                </View>
                {manual ? (
                  <Pressable onPress={() => setCardioOverride(me.id, d, null)} accessibilityRole="button" hitSlop={8}>
                    <Txt variant="footnote" color={colors.textMuted}>
                      Reset
                    </Txt>
                  </Pressable>
                ) : null}
                <TextInput
                  value={drafts[d] ?? (manual ? String(row.cardioLoad) : '')}
                  onChangeText={(t) => setDrafts({ ...drafts, [d]: t.replace(/[^0-9]/g, '') })}
                  placeholder={String(row?.cardioLoad ?? 0)}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  accessibilityLabel={`Cardio Load for ${formatDay(d, 'long')}`}
                  style={[styles.input, { fontFamily, color: manual ? metricColors.cardioLoad : colors.text }]}
                />
              </View>
            );
          })}
        </Card>
      </Section>
      <Button label="Save" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  input: {
    width: 76,
    textAlign: 'right',
    fontSize: 17,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});
