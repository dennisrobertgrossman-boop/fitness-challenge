import { ReactNode } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radius, spacing } from '../theme';
import { Txt } from './Txt';

interface Props {
  children: ReactNode;
  title?: string;
  titleColor?: string;
  subtitle?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  right?: ReactNode;
}

export function Card({ children, title, titleColor, subtitle, onPress, style, padded = true, right }: Props) {
  const body = (
    <>
      {(title || right) && (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {title ? (
              <Txt variant="headline" color={titleColor ?? colors.text}>
                {title}
              </Txt>
            ) : null}
            {subtitle ? (
              <Txt variant="footnote" color={colors.textMuted} style={{ marginTop: 2 }}>
                {subtitle}
              </Txt>
            ) : null}
          </View>
          {right}
          {onPress ? <ChevronRight size={18} color={colors.textMuted} /> : null}
        </View>
      )}
      {children}
    </>
  );
  const cardStyle = [styles.card, padded && styles.padded, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [cardStyle, pressed && { opacity: 0.75 }]}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{body}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
  padded: { padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
});
