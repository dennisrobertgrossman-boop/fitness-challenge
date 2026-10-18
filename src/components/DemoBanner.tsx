import { useNavigation } from '@react-navigation/native';
import { Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, spacing } from '../theme';
import { Txt } from './Txt';

export function DemoBanner() {
  const mode = useAppStore((s) => s.mode);
  const nav = useNavigation();
  if (mode !== 'demo') return null;
  return (
    <Pressable
      onPress={() => nav.navigate('Settings')}
      accessibilityRole="button"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: '#1F2A0A',
        borderRadius: radius.md,
        padding: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
      <Sparkles size={20} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Txt variant="footnote" weight="600" color={colors.accent}>
          You're looking at demo data
        </Txt>
        <Txt variant="caption" color={colors.textSecondary}>
          Tap to connect Health Connect / Apple Health and invite your brothers.
        </Txt>
      </View>
    </Pressable>
  );
}
