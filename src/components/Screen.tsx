import { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';
import { Txt } from './Txt';

interface Props {
  title?: string;
  eyebrow?: string;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Set when the screen sits under a native stack header. */
  underHeader?: boolean;
}

/** Scrollable page with an Apple-style large title. */
export function Screen({ title, eyebrow, right, children, onRefresh, refreshing = false, underHeader }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: underHeader ? spacing.md : insets.top + spacing.sm, paddingBottom: spacing.xxl * 2 },
      ]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} /> : undefined
      }
    >
      {title ? (
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            {eyebrow ? (
              <Txt variant="footnote" color={colors.textMuted} weight="600" style={styles.eyebrow}>
                {eyebrow.toUpperCase()}
              </Txt>
            ) : null}
            <Txt variant="largeTitle" accessibilityRole="header">
              {title}
            </Txt>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? <Txt variant="title3">{title}</Txt> : <View />}
          {action}
        </View>
      ) : null}
      <View style={{ gap: spacing.md }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg },
  eyebrow: { letterSpacing: 0.6, marginBottom: 2 },
  section: { marginBottom: spacing.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
});
