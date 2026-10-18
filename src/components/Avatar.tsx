import { View } from 'react-native';
import { colors } from '../theme';
import { Txt } from './Txt';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, color, size = 36 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: colors.bg,
      }}
    >
      <Txt style={{ fontSize: size * 0.4, fontWeight: '700' }} color="#fff">
        {initials(name)}
      </Txt>
    </View>
  );
}
