import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityRings } from '../components/ActivityRings';
import { GoogleButton } from '../components/GoogleButton';
import { Txt } from '../components/Txt';
import { Button, Field } from '../components/ui';
import * as cloud from '../services/cloud/api';
import { cloudConfigured } from '../services/cloud/client';
import { SIGN_IN_UNAVAILABLE, useAppStore } from '../store/useAppStore';
import { colors, metricColors, radius, spacing } from '../theme';

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const signInWithGoogle = useAppStore((s) => s.signInWithGoogle);
  const completeSignIn = useAppStore((s) => s.completeSignIn);
  const startDemo = useAppStore((s) => s.startDemo);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  const afterSignIn = (result: 'ready' | 'needs-group' | 'cancelled') => {
    if (result === 'needs-group') nav.navigate('Setup');
  };

  const run = async (fn: () => Promise<void>) => {
    setNotice(null);
    if (!cloudConfigured) {
      setNotice(SIGN_IN_UNAVAILABLE);
      return;
    }
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <ActivityRings
          size={180}
          rings={[
            { progress: 0.86, color: metricColors.steps, label: 'Steps' },
            { progress: 1.12, color: metricColors.cardioLoad, label: 'Cardio Load' },
            { progress: 0.7, color: metricColors.activeMinutes, label: 'Active minutes' },
          ]}
        />
        <Txt variant="largeTitle" align="center" style={{ marginTop: spacing.xl }}>
          Brothers Challenge
        </Txt>
        <Txt variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320 }}>
          Compare steps, Cardio Load and workouts with your brothers, every day.
        </Txt>
      </View>

      <View style={{ gap: spacing.md }}>
        <GoogleButton loading={busy && !emailOpen} onPress={() => run(async () => afterSignIn(await signInWithGoogle()))} />

        {emailOpen ? (
          <View style={styles.emailBox}>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
            />
            {codeSent ? (
              <>
                <Field label="6-digit code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" />
                <Button
                  label="Sign In"
                  loading={busy}
                  onPress={() =>
                    run(async () => afterSignIn(await completeSignIn(await cloud.verifyLoginCode(email.trim(), code.trim()))))
                  }
                />
              </>
            ) : (
              <Button
                label="Email Me a Code"
                kind="secondary"
                loading={busy}
                onPress={() =>
                  run(async () => {
                    await cloud.sendLoginCode(email.trim());
                    setCodeSent(true);
                  })
                }
              />
            )}
          </View>
        ) : (
          <Pressable onPress={() => setEmailOpen(true)} accessibilityRole="button" style={styles.textButton}>
            <Txt variant="subhead" color={colors.textSecondary}>
              Sign in with email instead
            </Txt>
          </Pressable>
        )}

        {notice ? (
          <View style={styles.notice}>
            <Txt variant="footnote" color={colors.textSecondary}>
              {notice}
            </Txt>
          </View>
        ) : null}

        <View style={styles.divider} />
        <Pressable onPress={startDemo} accessibilityRole="button" style={styles.textButton}>
          <Txt variant="headline" color={colors.accent}>
            Explore with Demo Data
          </Txt>
        </Pressable>
        <Txt variant="caption" color={colors.textMuted} align="center">
          See the app filled with three made-up brothers. Nothing is saved.
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'space-between', paddingHorizontal: spacing.xl, gap: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm },
  emailBox: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  textButton: { alignItems: 'center', paddingVertical: 10 },
  notice: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginVertical: spacing.sm },
});
