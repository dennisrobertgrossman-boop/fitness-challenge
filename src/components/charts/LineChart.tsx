import { useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors } from '../../theme';
import { Txt } from '../Txt';
import type { Series } from './BarChart';
import { Legend } from './Legend';
import { niceMax } from './scale';
import { Tooltip, TOOLTIP_WIDTH } from './Tooltip';

interface Props {
  labels: string[];
  tooltipLabels?: string[];
  series: Series[];
  height?: number;
  format?: (v: number) => string;
  axisFormat?: (v: number) => string;
  /** Total x slots (lets a line stop early, e.g. a challenge still in progress). */
  slots?: number;
  endLabels?: boolean;
  legend?: boolean;
  /** Lower bound of the y axis (defaults to 0). */
  yMin?: number;
}

const AXIS_W = 40;
const END_W = 64;
const TIP_H = 22;

export function LineChart({
  labels,
  tooltipLabels,
  series,
  height = 170,
  format = (v) => String(Math.round(v)),
  axisFormat,
  slots,
  endLabels = series.length <= 4,
  legend = series.length > 1,
  yMin = 0,
}: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = slots ?? labels.length;
  const count = Math.max(...series.map((s) => s.values.length), 0);
  const plotW = Math.max(0, width - AXIS_W - (endLabels ? END_W : 0));
  const max = yMin + niceMax(Math.max(...series.flatMap((s) => s.values), yMin + 2) - yMin);
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => height - 4 - ((v - yMin) / (max - yMin)) * (height - 8);
  const fmtAxis = axisFormat ?? format;

  const pick = (e: GestureResponderEvent) => {
    const lx = e.nativeEvent.locationX;
    const i = Math.round((lx / Math.max(1, plotW)) * (n - 1));
    setSelected(Math.max(0, Math.min(count - 1, i)));
  };

  // Direct end labels, nudged apart so they never overlap.
  const ends = series
    .map((s) => ({ s, v: s.values[s.values.length - 1] ?? 0 }))
    .map((e) => ({ ...e, ty: y(e.v) }))
    .sort((a, b) => a.ty - b.ty);
  for (let i = 1; i < ends.length; i++) {
    if (ends[i].ty - ends[i - 1].ty < 16) ends[i].ty = ends[i - 1].ty + 16;
  }

  const tipLeft =
    selected == null ? 0 : Math.min(Math.max(0, x(selected) - TOOLTIP_WIDTH / 2), Math.max(0, plotW - TOOLTIP_WIDTH));
  const maxLabels = Math.max(2, Math.floor(plotW / 60));
  const every = Math.ceil(n / maxLabels);

  return (
    <View>
      <View onLayout={onLayout} style={{ paddingTop: TIP_H }}>
        {width > 0 && (
          <View
            style={{ height }}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={pick}
            onResponderMove={pick}
            onResponderTerminationRequest={() => true}
          >
            <Svg width={width} height={height} pointerEvents="none">
              {[0, 0.5, 1].map((f) => (
                <Line key={f} x1={0} x2={plotW} y1={y(yMin + (max - yMin) * f)} y2={y(yMin + (max - yMin) * f)} stroke={colors.grid} strokeWidth={1} />
              ))}
              {selected != null && (
                <Line x1={x(selected)} x2={x(selected)} y1={0} y2={height} stroke={colors.textMuted} strokeWidth={1} />
              )}
              {series.map((s) => (
                <Path
                  key={s.key}
                  d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
                  stroke={s.color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {series.map((s) => {
                const i = selected ?? s.values.length - 1;
                const v = s.values[i];
                if (v == null) return null;
                return (
                  <Circle key={s.key} cx={x(i)} cy={y(v)} r={4.5} fill={s.color} stroke={colors.card} strokeWidth={2} />
                );
              })}
            </Svg>
            {[0, 0.5, 1].map((f) => (
              <Txt
                key={f}
                variant="caption"
                color={colors.textMuted}
                tabular
                style={[styles.abs, { top: y(yMin + (max - yMin) * f) - 8, left: plotW + (endLabels ? END_W : 0) + 6 }]}
              >
                {fmtAxis(yMin + (max - yMin) * f)}
              </Txt>
            ))}
            {endLabels &&
              ends.map((e) => (
                <Txt
                  key={e.s.key}
                  variant="caption"
                  weight="600"
                  numberOfLines={1}
                  style={[styles.abs, { top: e.ty - 8, left: x(e.s.values.length - 1) + 8, width: END_W - 4 }]}
                >
                  {e.s.label}
                </Txt>
              ))}
          </View>
        )}
        {width > 0 && selected != null && (
          <View style={{ position: 'absolute', top: -8, left: 0, right: 0 }} pointerEvents="none">
            <Tooltip
              left={tipLeft}
              title={tooltipLabels?.[selected] ?? labels[selected] ?? ''}
              rows={[...series]
                .sort((a, b) => (b.values[selected] ?? 0) - (a.values[selected] ?? 0))
                .map((s) => ({ label: s.label, value: format(s.values[selected] ?? 0), color: s.color }))}
            />
          </View>
        )}
      </View>
      <View style={{ height: 16, width: plotW, marginTop: 6 }}>
        {labels.map((l, i) =>
          i % every === 0 ? (
            <Txt
              key={i}
              variant="caption"
              color={colors.textMuted}
              style={[styles.abs, { left: Math.min(Math.max(0, x(i) - 25), plotW - 50), width: 50 }]}
              align="center"
              numberOfLines={1}
            >
              {l}
            </Txt>
          ) : null,
        )}
      </View>
      {legend ? <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
});
