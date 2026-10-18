import { useNavigation } from '@react-navigation/native';
import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import { Card } from '../components/Card';
import { Screen, Section } from '../components/Screen';
import { Txt } from '../components/Txt';
import { Button, Field, ListGroup, ListRow, Stepper } from '../components/ui';
import { addDays, daysBetween, formatDay } from '../lib/dates';
import { formatNumber } from '../lib/format';
import * as cloud from '../services/cloud/api';
import { cloudConfigured } from '../services/cloud/client';
import { healthProvider } from '../services/health';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, memberPalette, spacing } from '../theme';

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

  const weeks = Math.round((daysBetween(s.challenge.start, s.challenge.end) + 1) / 7);

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

      {/* ---------- Data source ---------- */}
      <Section title="Health Data">
        {s.mode === 'demo' ? (
          <Card>
            <Txt variant="subhead" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              You're using demo data for three brothers. Switch to your own data to read steps, workouts and heart rate
              from {Platform.OS === 'ios' ? 'Apple Health' : Platform.OS === 'android' ? 'Health Connect' : 'Health Connect (Android) or Apple Health (iPhone)'}.
            </Txt>
            <Button label="Use My Real Data" onPress={() => s.goLive(me.name)} />
          </Card>
        ) : (
          <>
            <ListGroup footer={healthProvider.id === 'none' ? 'Health data can only be read in the iOS and Android app (development build).' : undefined}>
              <ListRow label="Source" value={healthProvider.id === 'none' ? 'Not available here' : healthProvider.label} />
              <ListRow label="Last sync" value={since(s.lastHealthSync)} />
              <ListRow label="Days to import" last right={<Stepper value={s.syncDays} step={30} min={30} onChange={(v) => useAppStore.setState({ syncDays: Math.min(365, v) })} />} />
            </ListGroup>
            <Button
              label={`Sync ${healthProvider.id === 'none' ? 'Health Data' : healthProvider.label}`}
              loading={s.busy}
              onPress={() =>
                s
                  .syncHealthNow()
                  .then((msg) => notify('Sync complete', msg))
                  .catch((e) => notify('Sync failed', e instanceof Error ? e.message : String(e)))
              }
            />
            {healthProvider.openSettings ? (
              <Button kind="secondary" label="Manage Permissions" onPress={() => healthProvider.openSettings?.()} />
            ) : null}
          </>
        )}
        <ListGroup footer="Heart-rate zones and the Cardio Load estimate use your age and resting heart rate.">
          <ListRow label="Cardio Load from Google Health" onPress={() => nav.navigate('CardioLoad')} />
          <ListRow label="Age" right={<Stepper value={s.profile.age} min={12} onChange={(v) => s.setProfile({ age: v })} />} />
          <ListRow label="Resting heart rate" last right={<Stepper value={s.profile.restingHr} min={35} onChange={(v) => s.setProfile({ restingHr: v })} />} />
        </ListGroup>
      </Section>

      {/* ---------- Group ---------- */}
      <Section title="Group">
        <GroupSettings />
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

      {s.mode === 'live' ? (
        <Section>
          <ListGroup>
            <ListRow
              label="Switch Back to Demo Data"
              destructive
              last
              onPress={() => {
                const run = () => s.enterDemo();
                if (Platform.OS === 'web') run();
                else
                  Alert.alert('Switch to demo data?', 'Your imported data on this phone will be replaced by demo data.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Switch', style: 'destructive', onPress: run },
                  ]);
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

function GroupSettings() {
  const s = useAppStore();
  const me = useMe();
  const [email, setEmail] = useState(s.cloud?.email ?? '');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [groupName, setGroupName] = useState('Brothers');
  const [invite, setInvite] = useState('');
  const [working, setWorking] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setWorking(true);
    try {
      await fn();
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(false);
    }
  };

  if (!cloudConfigured) {
    return (
      <Card>
        <Txt variant="subhead" color={colors.textSecondary}>
          Sharing with your brothers needs a cloud backend (Supabase). Add EXPO_PUBLIC_SUPABASE_URL and
          EXPO_PUBLIC_SUPABASE_ANON_KEY to the build. The README explains the five-minute setup.
        </Txt>
      </Card>
    );
  }

  if (s.mode !== 'live') {
    return (
      <Card>
        <Txt variant="subhead" color={colors.textSecondary}>
          Switch to your real data first, then create a group and send the invite code to your brothers.
        </Txt>
      </Card>
    );
  }

  if (!s.cloud) {
    return (
      <View style={{ gap: spacing.md }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
        {codeSent ? (
          <>
            <Field label="Code from the email" value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="123456" />
            <Button
              label="Sign In"
              loading={working}
              onPress={() =>
                run(async () => {
                  const user = await cloud.verifyLoginCode(email.trim(), code.trim());
                  s.linkCloud({ userId: user.userId, email: user.email });
                  const group = await cloud.myGroup();
                  if (group) {
                    useAppStore.setState((st) => ({ cloud: { ...st.cloud!, groupId: group.id, groupName: group.name, inviteCode: group.invite_code } }));
                    await useAppStore.getState().syncCloudNow();
                  }
                })
              }
            />
          </>
        ) : (
          <Button label="Email Me a Sign-in Code" loading={working} onPress={() => run(async () => { await cloud.sendLoginCode(email.trim()); setCodeSent(true); })} />
        )}
      </View>
    );
  }

  if (!s.cloud.groupId) {
    const color = memberPalette[0];
    const finish = async (group: cloud.Group) => {
      useAppStore.setState((st) => ({ cloud: { ...st.cloud!, groupId: group.id, groupName: group.name, inviteCode: group.invite_code } }));
      await useAppStore.getState().syncCloudNow();
    };
    return (
      <View style={{ gap: spacing.md }}>
        <Card title="Start a group">
          <View style={{ gap: spacing.md }}>
            <Field label="Group name" value={groupName} onChangeText={setGroupName} />
            <Button label="Create Group" loading={working} onPress={() => run(async () => finish(await cloud.createGroup(groupName, me.name, color)))} />
          </View>
        </Card>
        <Card title="Or join your brother's group">
          <View style={{ gap: spacing.md }}>
            <Field label="Invite code" value={invite} onChangeText={setInvite} autoCapitalize="characters" placeholder="ABC123" />
            <Button kind="secondary" label="Join Group" loading={working} onPress={() => run(async () => finish(await cloud.joinGroup(invite, me.name, color)))} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <ListGroup footer="Share the invite code with your brothers. They enter it under Settings → Group → Join.">
        <ListRow label="Group" value={s.cloud.groupName} />
        <ListRow label="Invite code" value={s.cloud.inviteCode} onPress={() => Share.share({ message: `Join our fitness challenge! Invite code: ${s.cloud?.inviteCode}` })} />
        <ListRow label="Signed in as" value={s.cloud.email} />
        <ListRow label="Last sync" value={since(s.lastCloudSync)} last />
      </ListGroup>
      <Button
        label="Sync Group Now"
        loading={s.busy}
        onPress={() => s.syncCloudNow().then((m) => notify('Synced', m)).catch((e) => notify('Sync failed', e instanceof Error ? e.message : String(e)))}
      />
      <Button kind="destructive" label="Sign Out" onPress={() => s.unlinkCloud()} />
    </View>
  );
}
