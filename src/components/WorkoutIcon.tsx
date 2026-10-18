import {
  Activity,
  Bike,
  Dumbbell,
  Flame,
  Flower2,
  Footprints,
  HeartPulse,
  LucideIcon,
  Mountain,
  PersonStanding,
  Sailboat,
  Volleyball,
  Waves,
} from 'lucide-react-native';
import { View } from 'react-native';
import type { WorkoutType } from '../types';

const ICONS: Record<WorkoutType, LucideIcon> = {
  run: Footprints,
  walk: PersonStanding,
  cycle: Bike,
  strength: Dumbbell,
  hiit: Flame,
  swim: Waves,
  hike: Mountain,
  yoga: Flower2,
  row: Sailboat,
  elliptical: Activity,
  sport: Volleyball,
  other: HeartPulse,
};

export function WorkoutIcon({ type, color, size = 44 }: { type: WorkoutType; color: string; size?: number }) {
  const Icon = ICONS[type];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color + '33',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.5} color={color} strokeWidth={2.2} />
    </View>
  );
}
