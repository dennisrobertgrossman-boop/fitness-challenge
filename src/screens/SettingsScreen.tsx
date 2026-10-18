import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import { Card } from '../components/Card';
import { GoogleButton } from '../components/GoogleButton';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button, Field, ListGroup, ListRow, Stepper } from '../components/ui';
import { addDays, daysBetween, formatDay } from '../lib/dates';
import { formatNumber } from '../lib/format';
import { healthProvider } from '../services/health';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, spacing } from '../theme';

function notify(title: string, body?: string) {
  if (Platform.OS === 'web') globalThis.alert?.(body ? `${title}\n\n${body}` : title);
  else Alert.alert(title, body);
}

function since(iso?: string) {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return `${formatDay(d.toISOString().slice(0, 10))} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function SettingsScreen() {
  const nav = useNavigation();
  const s = useAppStore();
  const me = useMe();

  const [signingIn, setSigningIn] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const weeks = Math.round((daysBetween(s.challenge.start, s.challenge.end) + 1) / 7);
  const sourceLabel =
    s.dataSource === 'google'
      ? s.googleHealth?.linked
        ? 'Google Health (Fitbit)'
        : 'Google Health, not connected'
      : healthProvider.id === 'none'
        ? 'Not available here'
        : healthProvider.label;

  return (
    <Screen underHeader>
      {/* ---------- Profile ---------- */}
      <Section title="Your Profile">
        <CommitField label="Name" initial={me.name} onCommit={(n) => s.updateMember(me.id, { name: n })} />
        <ListGroup footer="Personal goals drive your rings. Challenge points use the shared targets below.">
          <ListRow
            label="Steps"
            right={<Stepper value={me.goals.steps} step={500} min={1000} format={(v) => formatNumber(v)} onChange={(v) => s.updateMember(me.id, { goals: { ...me.goals, steps: v } })} />}
          />
          <ListRow
            label="Cardio Load"
            right={<Stepper value={me.goals.cardioLoad} step={5} min={5} onChange={(v) => s.updateMember(me.id, { goals: { ...me.goals, cardioLoad: v } })} />}
          />
          <ListRow
            label="Active min"
            right={<Stepper value={me.goals.activeMinutes} step={5} min={5} onChange={(v) => s.updateMember(me.id, { goals: { ...me.goals, activeMinutes: v } })} />}
          />
          <ListRow
            label="Workouts/wk"
            last
            right={<Stepper value={me.goals.workoutsPerWeek} min={1} onChange={(v) => s.updateMember(me.id, { goals: { ...me.goals, workoutsPerWeek: v } })} />}
          />
        </ListGroup>
      </Section>

      {/* ---------- Account ---------- */}
      <Section title="Account">
        {s.cloud ? (
          <ListGroup>
            <ListRow label="Signed in as" value={s.cloud.email} />
            <ListRow label="Group" value={s.cloud.groupName ?? 'Not joined yet'} />
            {s.cloud.inviteCode ? (
              <ListRow
                label="Invite code"
                value={s.cloud.inviteCode}
                onPress={() => Share.share({ message: `Join our Brothers Challenge! Invite code: ${s.cloud?.inviteCode}` })}
              />
            ) : null}
            <ListRow label="Group and data source" last onPress={() => nav.navigate('Setup')} />
          </ListGroup>
        ) : (
          <Card>
            <Txt variant="subhead" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              Sign in to share your numbers with your brothers and see theirs.
            </Txt>
            <GoogleButton
              loading={signingIn}
              onPress={async () => {
                setNotice(null);
                setSigningIn(true);
                try {
                  if ((await s.signInWithGoogle()) === 'needs-group') nav.navigate('Setup');
                } catch (e) {
                  setNotice(e instanceof Error ? e.message : String(e));
                } finally {
                  setSigningIn(false);
                }
              }}
            />
            {notice ? (
              <Txt variant="footnote" color={colors.textSecondary} style={{ marginTop: spacing.md }}>
                {notice}
              </Txt>
            ) : null}
          </Card>
        )}
      </Section>

      {/* ---------- Data source ---------- */}
      <Section title="Health Data">
        {s.mode === 'demo' ? (
          <Card>
            <Txt variant="subhead" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              You're looking at demo data for three made-up brothers. Sign in above to use your own, or try your own data on
              this phone without an account.
            </Txt>
            <Button kind="secondary" label="Use My Data on This Phone Only" onPress={() => s.goLive(me.name)} />
          </Card>
        ) : (
          <>
            <ListGroup
              footer={
                s.dataSource === 'device' && healthProvider.id === 'none'
                  ? 'Health data can only be read in the iOS and Android app (development build).'
                  : s.dataSource === 'google'
                    ? 'Google Health keeps syncing in the background about once an hour.'
                    : undefined
              }
            >
              <ListRow label="Source" value={sourceLabel} />
              <ListRow label="Last sync" value={since(s.dataSource === 'google' ? s.googleHealth?.lastSync : s.lastHealthSync)} />
              {s.dataSource === 'google' && s.googleHealth?.lastError ? (
                <ListRow label="Problem" value={s.googleHealth.lastError} />
              ) : null}
              {s.dataSource === 'device' ? (
                <ListRow
                  label="Days to import"
                  right={<Stepper value={s.syncDays} step={30} min={30} onChange={(v) => useAppStore.setState({ syncDays: Math.min(365, v) })} />}
                />
              ) : null}
              {s.cloud ? <ListRow label="Change data source" last onPress={() => nav.navigate('Setup')} /> : null}
            </ListGroup>
            <Button
              label="Sync Now"
              loading={s.busy}
              onPress={() =>
                s
                  .syncNow()
                  .then((msg) => notify('Sync complete', msg))
                  .catch((e) => notify('Sync failed', e instanceof Error ? e.message : String(e)))
              }
            />
            {s.dataSource === 'device' && healthProvider.openSettings ? (
              <Button kind="secondary" label="Manage Permissions" onPress={() => healthProvider.openSettings?.()} />
            ) : null}
            {s.dataSource === 'google' && s.googleHealth?.linked ? (
              <Button kind="secondary" label="Disconnect Google Health" onPress={() => s.disconnectGoogleHealth()} />
            ) : null}
          </>
        )}
        <ListGroup footer="Heart-rate zones and the Cardio Load estimate use your age and resting heart rate.">
          <ListRow label="Enter daily numbers by hand" onPress={() => nav.navigate('CardioLoad')} />
          <ListRow label="Age" right={<Stepper value={s.profile.age} min={12} onChange={(v) => s.setProfile({ age: v })} />} />
          <ListRow label="Resting heart rate" last right={<Stepper value={s.profile.restingHr} min={35} onChange={(v) => s.setProfile({ restingHr: v })} />} />
        </ListGroup>
      </Section>

      {/* ---------- Challenge ---------- */}
      <Section title="Challenge">
        <CommitField label="Name" initial={s.challenge.name} onCommit={(name) => s.setChallenge({ name })} />
        <ListGroup footer="Targets apply to everyone, so personal goals don't affect points.">
          <ListRow
            label="Starts"
            right={
              <Stepper
                value={0}
                min={-999}
                format={() => formatDay(s.challenge.start)}
                onChange={(v) => s.setChallenge({ start: addDays(s.challenge.start, v), end: addDays(s.challenge.end, v) })}
              />
            }
          />
          <ListRow
            label="Length"
            right={
              <Stepper
                value={weeks}
                min={1}
                format={(v) => `${v} wk`}
                onChange={(v) => s.setChallenge({ end: addDays(s.challenge.start, v * 7 - 1) })}
              />
            }
          />
          <ListRow
            label="Step target"
            right={<Stepper value={s.challenge.targets.steps} step={500} min={1000} format={(v) => formatNumber(v)} onChange={(v) => s.setChallenge({ targets: { ...s.challenge.targets, steps: v } })} />}
          />
          <ListRow
            label="Cardio target"
            right={<Stepper value={s.challenge.targets.cardioLoad} step={5} min={5} onChange={(v) => s.setChallenge({ targets: { ...s.challenge.targets, cardioLoad: v } })} />}
          />
          <ListRow
            label="Min. workout"
            last
            right={<Stepper value={s.challenge.targets.minWorkoutMin} step={5} min={5} format={(v) => `${v} min`} onChange={(v) => s.setChallenge({ targets: { ...s.challenge.targets, minWorkoutMin: v } })} />}
          />
        </ListGroup>
      </Section>

      {/* ---------- Members (demo / local) ---------- */}
      {!s.cloud?.groupId && s.members.length > 1 ? (
        <Section title="Brothers">
          <ListGroup footer="In demo mode you can rename everyone. Once you share a group, each brother sets their own name.">
            {s.members
              .filter((m) => m.id !== me.id)
              .map((m, i) => (
                <View key={m.id} style={{ padding: spacing.md }}>
                  <CommitField label={`Brother ${i + 1}`} initial={m.name} onCommit={(n) => s.updateMember(m.id, { name: n })} />
                </View>
              ))}
          </ListGroup>
        </Section>
      ) : null}

      {s.cloud || s.mode === 'live' ? (
        <Section>
          <ListGroup>
            <ListRow
              label={s.cloud ? 'Sign Out' : 'Switch Back to Demo Data'}
              destructive
              last
              onPress={() => {
                const run = () => (s.cloud ? s.signOut() : s.enterDemo());
                if (Platform.OS === 'web') run();
                else
                  Alert.alert(
                    s.cloud ? 'Sign out?' : 'Switch to demo data?',
                    s.cloud
                      ? 'Your data stays in the group. Sign in again with the same Google account to get it back.'
                      : 'Your imported data on this phone will be replaced by demo data.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: s.cloud ? 'Sign Out' : 'Switch', style: 'destructive', onPress: run },
                    ],
                  );
              }}
            />
          </ListGroup>
        </Section>
      ) : null}

      <Txt variant="caption" color={colors.textMuted} align="center">
        Brothers Challenge · v1.0.0
      </Txt>
    </Screen>
  );
}

/** Text field that saves on blur / return, so typing doesn't re-render the whole app. */
function CommitField({ label, initial, onCommit }: { label: string; initial: string; onCommit: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  const commit = () => {
    const v = value.trim();
    if (v && v !== initial) onCommit(v);
  };
  return <Field label={label} value={value} onChangeText={setValue} onBlur={commit} onSubmitEditing={commit} returnKeyType="done" />;
}
