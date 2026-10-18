import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTween } from './useTween';

export interface RingSpec {
  progress: number;
  color: string;
  label?: string;
}

interface Props {
  rings: RingSpec[];
  size?: number;
  stroke?: number;
  gap?: number;
  animate?: boolean;
}

function Ring({
  cx,
  r,
  stroke,
  color,
  progress,
}: {
  cx: number;
  r: number;
  stroke: number;
  color: string;
  progress: number;
}) {
  const circ = 2 * Math.PI * r;
  const laps = Math.min(progress, 3);
  const first = Math.min(laps, 1);
  const extra = laps > 1 ? laps - Math.floor(laps) || 1 : 0;
  return (
    <G rotation={-90} origin={`${cx}, ${cx}`}>
      <Circle cx={cx} cy={cx} r={r} stroke={color} strokeOpacity={0.22} strokeWidth={stroke} fill="none" />
      {first > 0.001 && (
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - first)}
        />
      )}
      {extra > 0.001 && (
        // Second lap: a thin dark outline separates it from the first, like Apple's overlapping rings.
        <>
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke="#000"
            strokeOpacity={0.5}
            strokeWidth={stroke + 2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - extra)}
          />
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - extra)}
          />
        </>
      )}
    </G>
  );
}

export function ActivityRings({ rings, size = 150, stroke, gap, animate = true }: Props) {
  const sw = stroke ?? Math.max(4, size * 0.115);
  const g = gap ?? Math.max(1, sw * 0.18);
  const t = useTween(1, animate ? 900 : 1);
  const cx = size / 2;
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel={rings
        .map((r) => `${r.label ?? 'Ring'} ${Math.round(r.progress * 100)} percent`)
        .join(', ')}
    >
      <Svg width={size} height={size}>
        {rings.map((ring, i) => (
          <Ring
            key={i}
            cx={cx}
            r={cx - sw / 2 - i * (sw + g)}
            stroke={sw}
            color={ring.color}
            progress={ring.progress * t}
          />
        ))}
      </Svg>
    </View>
  );
}
