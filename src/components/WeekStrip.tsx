import { View } from 'react-native';
import { WEEKDAYS_LETTER, todayKey } from '../lib/dates';
import { dayValue, DataView } from '../lib/stats';
import { metricColors, colors } from '../theme';
import type { DayKey, Member } from '../types';
import { ActivityRings } from './ActivityRings';
import { Txt } from './Txt';

/** Seven small ring sets for a week, Apple Fitness style. */
export function WeekStrip({ view, member, days }: { view: DataView; member: Member; days: DayKey[] }) {
  const today = todayKey();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d, i) => {
        const future = d > today;
        return (
          <View key={d} style={{ alignItems: 'center', gap: 4 }}>
            <Txt variant="caption" weight={d === today ? '700' : '500'} color={d === today ? colors.text : colors.textMuted}>
              {WEEKDAYS_LETTER[i]}
            </Txt>
            <View style={{ opacity: future ? 0.35 : 1 }}>
              <ActivityRings
                size={34}
                animate={false}
                rings={
                  future
                    ? [
                        { progress: 0, color: metricColors.steps },
                        { progress: 0, color: metricColors.cardioLoad },
                        { progress: 0, color: metricColors.activeMinutes },
                      ]
                    : [
                        { progress: dayValue(view, member.id, d, 'steps') / member.goals.steps, color: metricColors.steps },
                        {
                          progress: dayValue(view, member.id, d, 'cardioLoad') / member.goals.cardioLoad,
                          color: metricColors.cardioLoad,
                        },
                        {
                          progress: dayValue(view, member.id, d, 'activeMinutes') / member.goals.activeMinutes,
                          color: metricColors.activeMinutes,
                        },
                      ]
                }
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}
