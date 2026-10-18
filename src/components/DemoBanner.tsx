import { useNavigation } from '@react-navigation/native';
import { RefreshCw, Sparkles } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { colors, radius, spacing } from '../theme';
import { Txt } from './Txt';

/** Top-of-summary banner: demo mode, or a Google Health connection that needs renewing. */
export function DemoBanner() {
  const mode = useAppStore((s) => s.mode);
  const googleProblem = useAppStore((s) => (s.dataSource === 'google' ? s.googleHealth?.lastError : undefined));
  const nav = useNavigation();

  if (mode === 'demo') {
    return (
      <Banner
        icon={<Sparkles size={20} color={colors.accent} />}
        title="You're looking at demo data"
        body="Tap to sign in with Google, connect your watch and invite your brothers."
        onPress={() => nav.navigate('Settings')}
      />
    );
  }
  if (googleProblem) {
    return (
      <Banner
        icon={<RefreshCw size={20} color={colors.accent} />}
        title="Reconnect Google Health"
        body={googleProblem}
        onPress={() => nav.navigate('Setup')}
      />
    );
  }
  return null;
}

function Banner({ icon, title, body, onPress }: { icon: React.ReactNode; title: string; body: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
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
      {icon}
      <View style={{ flex: 1 }}>
        <Txt variant="footnote" weight="600" color={colors.accent}>
          {title}
        </Txt>
        <Txt variant="caption" color={colors.textSecondary} numberOfLines={2}>
          {body}
        </Txt>
      </View>
    </Pressable>
  );
}
