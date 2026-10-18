import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button } from '../components/ui';
import { formatDay, lastNDays, relativeDay } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, fontFamily, metricColors, radius, spacing } from '../theme';

type Drafts = Record<string, { steps?: string; cardio?: string }>;

/**
 * Enter daily numbers by hand: Cardio Load copied from the Google Health app
 * (replaces the estimate everywhere, including challenge points), and steps for
 * watches whose data can't be synced.
 */
export function CardioLoadScreen() {
  const nav = useNavigation();
  const me = useMe();
  const daily = useAppStore((s) => s.daily[me.id] ?? {});
  const setCardioOverride = useAppStore((s) => s.setCardioOverride);
  const setManualSteps = useAppStore((s) => s.setManualSteps);
  const days = lastNDays(14).reverse();
  const [drafts, setDrafts] = useState<Drafts>({});

  const edit = (day: string, field: 'steps' | 'cardio', text: string) =>
    setDrafts({ ...drafts, [day]: { ...drafts[day], [field]: text.replace(/[^0-9]/g, '') } });

  const save = () => {
    for (const [day, d] of Object.entries(drafts)) {
      if (d.steps?.trim()) setManualSteps(me.id, day, Number(d.steps));
      if (d.cardio?.trim()) setCardioOverride(me.id, day, Number(d.cardio));
    }
    nav.goBack();
  };

  return (
    <Screen underHeader>
      <Card style={{ marginBottom: spacing.xl }}>
        <Txt variant="subhead" color={colors.textSecondary}>
          Google's interface for other apps does not include Cardio Load, so this app estimates it from heart rate. For exact
          values, copy the daily Cardio Load from the Google Health app here. Typed values replace the estimate in every
          chart and in challenge points. Steps can be typed in too, for watches that can't sync.
        </Txt>
      </Card>
      <Section title="Last 14 Days">
        <Card padded={false}>
          <View style={[styles.row, styles.border, { paddingVertical: 8 }]}>
            <View style={{ flex: 1 }} />
            <Txt variant="caption" color={colors.textMuted} style={styles.head}>
              STEPS
            </Txt>
            <Txt variant="caption" color={colors.textMuted} style={styles.head}>
              CARDIO
            </Txt>
          </View>
          {days.map((d, i) => {
            const row = daily[d];
            const manual = row?.cardioLoadSource === 'manual';
            return (
              <View key={d} style={[styles.row, i < days.length - 1 && styles.border]}>
                <View style={{ flex: 1 }}>
                  <Txt variant="body">{relativeDay(d)}</Txt>
                  <Txt variant="caption" color={colors.textMuted}>
                    {formatDay(d, 'long')}
                  </Txt>
                  {manual ? (
                    <Pressable onPress={() => setCardioOverride(me.id, d, null)} accessibilityRole="button" hitSlop={8}>
                      <Txt variant="caption" color={metricColors.cardioLoad}>
                        Cardio from Google Health · Reset
                      </Txt>
                    </Pressable>
                  ) : null}
                </View>
                <TextInput
                  value={drafts[d]?.steps ?? ''}
                  onChangeText={(t) => edit(d, 'steps', t)}
                  placeholder={formatNumber(row?.steps ?? 0)}
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  accessibilityLabel={`Steps for ${formatDay(d, 'long')}`}
                  style={[styles.input, { fontFamily, color: colors.text }]}
                />
                <TextInput
                  value={drafts[d]?.cardio ?? ''}
                  onChangeText={(t) => edit(d, 'cardio', t)}
                  placeholder={String(row?.cardioLoad ?? 0)}
                  placeholderTextColor={manual ? metricColors.cardioLoad : colors.textMuted}
                  keyboardType="number-pad"
                  accessibilityLabel={`Cardio Load for ${formatDay(d, 'long')}`}
                  style={[styles.input, styles.inputSmall, { fontFamily, color: metricColors.cardioLoad }]}
                />
              </View>
            );
          })}
        </Card>
        <Txt variant="footnote" color={colors.textMuted}>
          Grey numbers are the current values. Leave a field empty to keep it.
        </Txt>
      </Section>
      <Button label="Save" onPress={save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  head: { width: 84, textAlign: 'right' },
  input: {
    width: 84,
    textAlign: 'right',
    fontSize: 16,
    backgroundColor: colors.cardRaised,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputSmall: {},
});
