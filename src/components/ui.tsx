import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, fontFamily, radius, spacing } from '../theme';
import { Txt } from './Txt';

export function StatTile({
  label,
  value,
  unit,
  color = colors.text,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  sub?: string;
}) {
  return (
    <View style={styles.tile}>
      <Txt variant="footnote" color={colors.textSecondary} numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="title2" color={color} tabular numberOfLines={1}>
        {value}
        {unit ? (
          <Txt variant="subhead" color={color} weight="600">
            {' '}
            {unit}
          </Txt>
        ) : null}
      </Txt>
      {sub ? (
        <Txt variant="caption" color={colors.textMuted} numberOfLines={1}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  loading,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'destructive';
  loading?: boolean;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const bg = kind === 'primary' ? colors.accent : colors.cardRaised;
  const fg = kind === 'primary' ? '#000' : kind === 'destructive' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon}
      <Txt variant="headline" color={fg}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function ListGroup({ children, footer }: { children: ReactNode; footer?: string }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={styles.group}>{children}</View>
      {footer ? (
        <Txt variant="footnote" color={colors.textMuted} style={{ marginTop: 6, marginHorizontal: spacing.lg }}>
          {footer}
        </Txt>
      ) : null}
    </View>
  );
}

export function ListRow({
  label,
  value,
  onPress,
  right,
  left,
  last,
  destructive,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  left?: ReactNode;
  last?: boolean;
  destructive?: boolean;
}) {
  const content = (
    <View style={[styles.listRow, !last && styles.listRowBorder]}>
      {left}
      <Txt variant="body" color={destructive ? colors.danger : colors.text} style={{ flex: 1 }}>
        {label}
      </Txt>
      {value ? (
        <Txt variant="body" color={colors.textMuted} numberOfLines={1} style={{ maxWidth: '55%' }}>
          {value}
        </Txt>
      ) : null}
      {right}
      {onPress && !right ? <ChevronRight size={18} color={colors.textMuted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Txt variant="footnote" color={colors.textSecondary}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={colors.textMuted}
        {...props}
        style={[styles.input, { fontFamily }, props.style]}
      />
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  format = String,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => onChange(Math.max(min, value - step))}
        style={styles.stepBtn}
        accessibilityLabel="Decrease"
      >
        <Txt variant="title3">−</Txt>
      </Pressable>
      <Txt variant="headline" tabular style={{ minWidth: 64 }} align="center">
        {format(value)}
      </Txt>
      <Pressable onPress={() => onChange(value + step)} style={styles.stepBtn} accessibilityLabel="Increase">
        <Txt variant="title3">+</Txt>
      </Pressable>
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Txt variant="headline" align="center">
        {title}
      </Txt>
      {body ? (
        <Txt variant="subhead" color={colors.textMuted} align="center">
          {body}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  button: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  group: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    minHeight: 48,
  },
  listRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  input: {
    backgroundColor: colors.cardRaised,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 17,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { padding: spacing.xxl, gap: spacing.sm, alignItems: 'center' },
});
