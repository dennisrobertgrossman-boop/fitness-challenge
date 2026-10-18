import { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import { addDays, formatDay, todayKey } from '../../lib/dates';
import { colors } from '../../theme';
import type { DayKey } from '../../types';
import { Txt } from '../Txt';

interface Props {
  weeks: DayKey[];
  value: (day: DayKey) => number;
  /** Value that maps to full intensity. */
  max: number;
  color: string;
  format: (v: number) => string;
}

const LABEL_W = 16;
const GAP = 3;
const STEPS = [0.18, 0.38, 0.6, 0.8, 1];

/** Calendar heatmap: one column per week, one row per weekday, single hue light→bright. */
export function Heatmap({ weeks, value, max, color, format }: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<DayKey | null>(null);
  const today = todayKey();
  const cell = width ? Math.min(28, (width - LABEL_W - GAP * weeks.length) / weeks.length) : 0;

  const opacityFor = (v: number) => {
    if (v <= 0) return 0;
    const r = Math.min(1, v / max);
    return STEPS[Math.min(STEPS.length - 1, Math.floor(r * STEPS.length))];
  };

  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      {cell > 0 && (
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: LABEL_W, gap: GAP }}>
            {['M', '', 'W', '', 'F', '', 'S'].map((l, i) => (
              <Txt key={i} variant="caption" color={colors.textMuted} style={{ height: cell, lineHeight: cell, fontSize: 10 }}>
                {l}
              </Txt>
            ))}
          </View>
          {weeks.map((monday) => (
            <View key={monday} style={{ gap: GAP, marginLeft: GAP }}>
              {Array.from({ length: 7 }, (_, d) => {
                const day = addDays(monday, d);
                const future = day > today;
                const v = future ? 0 : value(day);
                return (
                  <Pressable
                    key={day}
                    disabled={future}
                    onPress={() => setSelected(selected === day ? null : day)}
                    accessibilityLabel={`${formatDay(day, 'long')}: ${format(v)}`}
                    style={{
                      width: cell,
                      height: cell,
                      borderRadius: 4,
                      backgroundColor: future ? 'transparent' : colors.cardRaised,
                      borderWidth: selected === day ? 2 : 0,
                      borderColor: colors.text,
                      overflow: 'hidden',
                    }}
                  >
                    <View style={{ flex: 1, backgroundColor: color, opacity: opacityFor(v) }} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
        <Txt variant="footnote" color={selected ? colors.text : colors.textMuted} tabular>
          {selected ? `${formatDay(selected, 'long')} · ${format(value(selected))}` : 'Tap a day for details'}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
          <Txt variant="caption" color={colors.textMuted}>
            Less
          </Txt>
          {STEPS.map((o) => (
            <View key={o} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.cardRaised, overflow: 'hidden' }}>
              <View style={{ flex: 1, backgroundColor: color, opacity: o }} />
            </View>
          ))}
          <Txt variant="caption" color={colors.textMuted}>
            More
          </Txt>
        </View>
      </View>
    </View>
  );
}
