import { useNavigation } from '@react-navigation/native';
import { CircleCheck, Pencil, Watch } from 'lucide-react-native';
import { ReactNode, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { GoogleLogo } from '../components/GoogleButton';
import { GroupCard } from '../components/GroupCard';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button } from '../components/ui';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, radius, spacing } from '../theme';

const phoneStore =
  Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Health Connect or Apple Health';

/** First-run setup after signing in: join the group, then choose where your data comes from. */
export function SetupScreen() {
  const nav = useNavigation();
  const me = useMe();
  const link = useAppStore((s) => s.cloud);
  const dataSource = useAppStore((s) => s.dataSource);
  const googleHealth = useAppStore((s) => s.googleHealth);
  const busy = useAppStore((s) => s.busy);
  const connectGoogleHealth = useAppStore((s) => s.connectGoogleHealth);
  const setDataSource = useAppStore((s) => s.setDataSource);
  const syncHealthNow = useAppStore((s) => s.syncHealthNow);
  const finishSetup = useAppStore((s) => s.finishSetup);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const hasGroup = Boolean(link?.groupId);
  const say = (text: string, error = false) => setMessage(text ? { text, error } : null);

  const done = () => {
    finishSetup();
    if (nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  };

  return (
    <Screen underHeader>
      <Txt variant="title2" style={{ marginBottom: spacing.xs }}>
        Hi {me.name}
      </Txt>
      <Txt variant="subhead" color={colors.textSecondary} style={{ marginBottom: spacing.xl }}>
        Two quick steps and your numbers show up next to your brothers'.
      </Txt>

      <Section title="1. Your Group">
        <GroupCard onError={(m) => say(m, true)} />
      </Section>

      <Section title="2. Your Data">
        <Option
          icon={<GoogleLogo size={22} />}
          title="Fitbit Air or other Fitbit (Google Health)"
          body="Reads steps, workouts, distance, calories and heart-rate zones from your Google account. Keeps syncing in the background, even when the app is closed."
          selected={dataSource === 'google' && Boolean(googleHealth?.linked)}
          disabled={!hasGroup}
          actionLabel={googleHealth?.linked ? 'Reconnect Google Health' : 'Connect Google Health'}
          loading={busy && dataSource !== 'device'}
          onAction={() =>
            connectGoogleHealth()
              .then((m) => m && say(m))
              .catch((e) => say(e instanceof Error ? e.message : String(e), true))
          }
        />
        <Option
          icon={<Watch size={22} color={colors.text} />}
          title="Huawei, Garmin, Samsung or another watch"
          body={`Reads ${phoneStore} on this phone. Huawei: on an iPhone, allow Huawei Health to write to Apple Health. On Android, Huawei Health does not write to Health Connect itself, so a bridge app (for example Health Sync) has to copy the data across.`}
          selected={dataSource === 'device'}
          disabled={!hasGroup}
          actionLabel={`Use ${Platform.OS === 'web' ? "This Phone's Health App" : phoneStore}`}
          onAction={() => {
            setDataSource('device');
            syncHealthNow()
              .then(say)
              .catch((e) => say(e instanceof Error ? e.message : String(e), true));
          }}
        />
        <Pressable onPress={() => nav.navigate('CardioLoad')} accessibilityRole="button" style={styles.manual}>
          <Pencil size={16} color={colors.textSecondary} />
          <Txt variant="subhead" color={colors.textSecondary}>
            No sync possible? Enter steps and Cardio Load by hand
          </Txt>
        </Pressable>
        {!hasGroup ? (
          <Txt variant="footnote" color={colors.textMuted}>
            Create or join the group first.
          </Txt>
        ) : null}
      </Section>

      {message ? (
        <View style={[styles.message, message.error && { borderColor: colors.danger }]}>
          <Txt variant="footnote" color={message.error ? colors.danger : colors.textSecondary}>
            {message.text}
          </Txt>
        </View>
      ) : null}

      <Button label={hasGroup ? 'Done' : 'Skip for Now'} kind={hasGroup ? 'primary' : 'secondary'} onPress={done} />
    </Screen>
  );
}

function Option({
  icon,
  title,
  body,
  selected,
  disabled,
  actionLabel,
  onAction,
  loading,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  selected: boolean;
  disabled?: boolean;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <View style={[styles.option, selected && { borderColor: colors.accent }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={styles.iconWrap}>{icon}</View>
        <Txt variant="headline" style={{ flex: 1 }}>
          {title}
        </Txt>
        {selected ? <CircleCheck size={22} color={colors.accent} /> : null}
      </View>
      <Txt variant="footnote" color={colors.textSecondary}>
        {body}
      </Txt>
      <Button kind={selected ? 'secondary' : 'primary'} label={actionLabel} onPress={onAction} disabled={disabled} loading={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  option: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manual: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  message: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'transparent' },
});

