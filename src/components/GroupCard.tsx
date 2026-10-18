import { useState } from 'react';
import { Share, View } from 'react-native';
import * as cloud from '../services/cloud/api';
import { useAppStore, useMe } from '../store/useAppStore';
import { colors, memberPalette, spacing } from '../theme';
import { Card } from './Card';
import { Txt } from './Txt';
import { Button, Field, ListGroup, ListRow } from './ui';

/** Create or join the brothers' group, or show its invite code once joined. */
export function GroupCard({ onError }: { onError: (message: string) => void }) {
  const link = useAppStore((s) => s.cloud);
  const setGroup = useAppStore((s) => s.setGroup);
  const me = useMe();
  const [groupName, setGroupName] = useState('Brothers');
  const [invite, setInvite] = useState('');
  const [working, setWorking] = useState<'create' | 'join' | null>(null);

  const run = async (which: 'create' | 'join', fn: () => Promise<cloud.Group>) => {
    setWorking(which);
    try {
      await setGroup(await fn());
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };

  if (link?.groupId) {
    return (
      <ListGroup footer="Send the invite code to your brothers. They sign in and choose Join.">
        <ListRow label="Group" value={link.groupName} />
        <ListRow
          label="Invite code"
          value={link.inviteCode}
          last
          onPress={() => Share.share({ message: `Join our Brothers Challenge! Invite code: ${link.inviteCode}` })}
        />
      </ListGroup>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <Card title="Start a group" subtitle="For the first brother to sign in">
        <View style={{ gap: spacing.md }}>
          <Field label="Group name" value={groupName} onChangeText={setGroupName} />
          <Button
            label="Create Group"
            loading={working === 'create'}
            onPress={() => run('create', () => cloud.createGroup(groupName, me.name, memberPalette[0]))}
          />
        </View>
      </Card>
      <Card title="Join your brother's group" subtitle="Ask him for the 6-character invite code">
        <View style={{ gap: spacing.md }}>
          <Field label="Invite code" value={invite} onChangeText={setInvite} autoCapitalize="characters" placeholder="ABC123" />
          <Button
            kind="secondary"
            label="Join Group"
            loading={working === 'join'}
            disabled={invite.trim().length < 4}
            onPress={() => run('join', () => cloud.joinGroup(invite, me.name, memberPalette[0]))}
          />
        </View>
      </Card>
      <Txt variant="footnote" color={colors.textMuted}>
        Everyone in the group can see each other's steps, Cardio Load and workouts. Only you can change your own data.
      </Txt>
    </View>
  );
}
