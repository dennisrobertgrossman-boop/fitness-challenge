import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { colors } from '../../theme';
import { Txt } from '../Txt';
import { Legend } from './Legend';
import { barPath, niceMax } from './scale';
import { Tooltip, TOOLTIP_WIDTH } from './Tooltip';

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface Props {
  labels: string[];
  /** Longer labels for the tooltip (defaults to `labels`). */
  tooltipLabels?: string[];
  series: Series[];
  height?: number;
  format?: (v: number) => string;
  axisFormat?: (v: number) => string;
  goal?: number;
  legend?: boolean;
}

const AXIS_W = 40;
const TIP_H = 22;
const LABEL_W = 44;

export function BarChart({
  labels,
  tooltipLabels,
  series,
  height = 160,
  format = (v) => String(Math.round(v)),
  axisFormat,
  goal,
  legend = series.length > 1,
}: Props) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const n = labels.length;
  const plotW = Math.max(0, width - AXIS_W);
  const max = niceMax(Math.max(2, goal ?? 0, ...series.flatMap((s) => s.values)));
  const groupW = n ? plotW / n : 0;
  const s = series.length;
  const groupPad = Math.max(2, groupW * (s > 1 ? 0.22 : 0.3));
  const barW = Math.max(1.5, Math.min(26, (groupW - groupPad - (s - 1) * 2) / s));
  const usedW = barW * s + (s - 1) * 2;
  const y = (v: number) => height - (v / max) * height;
  const maxLabels = Math.max(2, Math.floor(plotW / (LABEL_W + 6)));
  const every = Math.ceil(n / maxLabels);
  const fmtAxis = axisFormat ?? format;

  const tipLeft =
    selected == null ? 0 : Math.min(Math.max(0, selected * groupW + groupW / 2 - TOOLTIP_WIDTH / 2), plotW - TOOLTIP_WIDTH);

  return (
    <View>
      <View onLayout={onLayout} style={{ paddingTop: TIP_H }}>
        {width > 0 && (
          <View style={{ height }}>
            <Svg width={width} height={height}>
              {[0, 0.5, 1].map((f) => (
                <Line
                  key={f}
                  x1={0}
                  x2={plotW}
                  y1={y(max * f)}
                  y2={y(max * f)}
                  stroke={colors.grid}
                  strokeWidth={1}
                />
              ))}
              {goal ? (
                <Line
                  x1={0}
                  x2={plotW}
                  y1={y(goal)}
                  y2={y(goal)}
                  stroke={colors.textMuted}
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              ) : null}
              {labels.map((_, i) =>
                series.map((se, j) => {
                  const v = se.values[i] ?? 0;
                  const x = i * groupW + (groupW - usedW) / 2 + j * (barW + 2);
                  return (
                    <Path
                      key={`${i}-${se.key}`}
                      d={barPath(x, y(v), barW, height - y(v), 4)}
                      fill={se.color}
                      opacity={selected == null || selected === i ? 1 : 0.4}
                    />
                  );
                }),
              )}
            </Svg>
            {[0, 0.5, 1]
              .filter((f) => !goal || Math.abs(y(max * f) - y(goal)) > 14)
              .map((f) => (
                <Txt
                  key={f}
                  variant="caption"
                  color={colors.textMuted}
                  tabular
                  style={[styles.yLabel, { top: y(max * f) - 8, left: plotW + 6 }]}
                >
                  {fmtAxis(max * f)}
                </Txt>
              ))}
            {goal ? (
              <Txt
                variant="caption"
                color={colors.textSecondary}
                weight="600"
                style={[styles.yLabel, { top: y(goal) - 8, left: plotW + 6 }]}
              >
                Goal
              </Txt>
            ) : null}
            {/* Hit targets larger than the bars */}
            <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: plotW }]}>
              {labels.map((l, i) => (
                <Pressable
                  key={i}
                  style={{ flex: 1 }}
                  onPress={() => setSelected(selected === i ? null : i)}
                  accessibilityRole="button"
                  accessibilityLabel={`${tooltipLabels?.[i] ?? l}: ${series.map((se) => `${se.label} ${format(se.values[i] ?? 0)}`).join(', ')}`}
                />
              ))}
            </View>
          </View>
        )}
        {width > 0 && selected != null && (
          <View style={{ position: 'absolute', top: -8, left: 0, right: 0 }}>
            <Tooltip
              left={tipLeft}
              title={tooltipLabels?.[selected] ?? labels[selected]}
              rows={series.map((se) => ({
                label: se.label,
                value: format(se.values[selected] ?? 0),
                color: s > 1 ? se.color : undefined,
              }))}
            />
          </View>
        )}
      </View>
      <View style={{ height: 16, width: plotW, marginTop: 6 }}>
        {labels.map((l, i) => {
          if (i % every !== 0 && selected !== i) return null;
          if (selected != null && selected !== i && Math.abs(selected - i) < every) return null;
          const w = Math.max(groupW, LABEL_W);
          return (
            <Txt
              key={i}
              variant="caption"
              color={selected === i ? colors.text : colors.textMuted}
              align="center"
              numberOfLines={1}
              style={[styles.yLabel, { width: w, left: Math.min(Math.max(0, i * groupW + groupW / 2 - w / 2), plotW - w) }]}
            >
              {l}
            </Txt>
          );
        })}
      </View>
      {legend ? <Legend items={series.map((se) => ({ label: se.label, color: se.color }))} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  yLabel: { position: 'absolute' },
});
