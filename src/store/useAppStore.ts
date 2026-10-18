import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_MEMBERS, defaultChallenge, generateDemoData } from '../data/demo';
import { addDays, todayKey } from '../lib/dates';
import type { HrProfile } from '../lib/heartRate';
import { DataView, indexWorkouts } from '../lib/stats';
import * as cloud from '../services/cloud/api';
import * as auth from '../services/cloud/auth';
import { cloudConfigured } from '../services/cloud/client';
import { healthProvider, syncHealth } from '../services/health';
import { safeStorage } from '../services/storage';
import { memberPalette } from '../theme';
import type { Challenge, DailyMap, DailyMetric, DayKey, Member, Workout } from '../types';

export type Mode = 'demo' | 'live';

export type Entry = 'welcome' | 'app';
export type MySource = 'google' | 'device';

export const SIGN_IN_UNAVAILABLE =
  'Sign-in is not switched on in this build. It works once the cloud backend is set up (README → Cloud sync).';

export interface CloudLink {
  userId: string;
  email: string;
  groupId?: string;
  groupName?: string;
  inviteCode?: string;
}

interface State {
  /** 'welcome' shows the sign-in screen; 'app' shows the tabs. */
  entry: Entry;
  mode: Mode;
  /** Where your own data comes from in live mode. */
  dataSource: MySource;
  /** True after first sign-in until the group and data source are chosen. */
  setupPending: boolean;
  googleHealth?: { linked: boolean; lastSync?: string; lastError?: string };
  meId: string;
  members: Member[];
  challenge: Challenge;
  profile: HrProfile;
  syncDays: number;
  lastHealthSync?: string;
  lastCloudSync?: string;
  cloud?: CloudLink;
  daily: DailyMap;
  workouts: Workout[];
  hydrated: boolean;
  busy: boolean;
  lastError?: string;
}

interface Actions {
  refreshDemo(): void;
  enterDemo(): void;
  goLive(name: string): void;
  updateMember(id: string, patch: Partial<Omit<Member, 'id'>>): void;
  setChallenge(patch: Partial<Challenge>): void;
  setProfile(patch: Partial<HrProfile>): void;
  setCardioOverride(memberId: string, day: DayKey, value: number | null): void;
  setManualSteps(memberId: string, day: DayKey, steps: number): void;
  startDemo(): void;
  signInWithGoogle(): Promise<'ready' | 'needs-group' | 'cancelled'>;
  completeSignIn(user: auth.SignedInUser): Promise<'ready' | 'needs-group'>;
  finishWebRedirect(): Promise<void>;
  setGroup(group: cloud.Group): Promise<void>;
  setDataSource(source: MySource): void;
  connectGoogleHealth(): Promise<string>;
  disconnectGoogleHealth(): Promise<void>;
  syncNow(): Promise<string>;
  signOut(): void;
  finishSetup(): void;
  addWorkout(w: Workout): void;
  deleteWorkout(id: string): void;
  syncHealthNow(): Promise<string>;
  syncCloudNow(): Promise<string>;
  linkCloud(link: CloudLink): void;
  unlinkCloud(): void;
  clearError(): void;
}

const demo = generateDemoData();

const initial: State = {
  entry: 'welcome',
  mode: 'demo',
  dataSource: 'device',
  setupPending: false,
  meId: 'm1',
  members: DEFAULT_MEMBERS,
  challenge: defaultChallenge(),
  profile: { age: 35, restingHr: 60 },
  syncDays: 90,
  daily: demo.daily,
  workouts: demo.workouts,
  hydrated: false,
  busy: false,
};

function upsertDaily(map: DailyMap, rows: DailyMetric[]): DailyMap {
  const next: DailyMap = { ...map };
  for (const r of rows) {
    const byDay = { ...(next[r.memberId] ?? {}) };
    const prev = byDay[r.date];
    // Never overwrite a Cardio Load value typed in from the Google Health app.
    byDay[r.date] =
      prev?.cardioLoadSource === 'manual' && r.cardioLoadSource !== 'manual'
        ? { ...r, cardioLoad: prev.cardioLoad, cardioLoadSource: 'manual' }
        : r;
    next[r.memberId] = byDay;
  }
  return next;
}

function upsertWorkouts(list: Workout[], rows: Workout[]): Workout[] {
  const byId = new Map(list.map((w) => [`${w.memberId}|${w.id}`, w]));
  for (const w of rows) byId.set(`${w.memberId}|${w.id}`, w);
  return [...byId.values()].sort((a, b) => (a.start < b.start ? 1 : -1));
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export const useAppStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      refreshDemo() {
        const d = generateDemoData();
        set({ daily: d.daily, workouts: d.workouts });
      },

      enterDemo() {
        const d = generateDemoData();
        set({
          mode: 'demo',
          meId: 'm1',
          members: DEFAULT_MEMBERS,
          challenge: defaultChallenge(),
          daily: d.daily,
          workouts: d.workouts,
          cloud: undefined,
          lastHealthSync: undefined,
          lastCloudSync: undefined,
        });
      },

      goLive(name) {
        const me: Member = {
          id: 'local',
          name: name || 'Me',
          color: memberPalette[0],
          goals: { steps: 10000, cardioLoad: 50, activeMinutes: 30, workoutsPerWeek: 4 },
        };
        set({ mode: 'live', meId: me.id, members: [me], daily: {}, workouts: [], challenge: defaultChallenge() });
      },

      updateMember(id, patch) {
        const members = get().members.map((m) => (m.id === id ? { ...m, ...patch, goals: { ...m.goals, ...patch.goals } } : m));
        set({ members });
        const updated = members.find((m) => m.id === id);
        if (updated && get().cloud?.groupId && id === get().meId) cloud.updateMemberRow(updated).catch(() => {});
      },

      setChallenge(patch) {
        const challenge = { ...get().challenge, ...patch, targets: { ...get().challenge.targets, ...patch.targets } };
        set({ challenge });
        const groupId = get().cloud?.groupId;
        if (groupId) cloud.saveChallenge(groupId, challenge).catch(() => {});
      },

      setProfile(patch) {
        set({ profile: { ...get().profile, ...patch } });
      },

      setCardioOverride(memberId, day, value) {
        const existing = get().daily[memberId]?.[day];
        const base: DailyMetric = existing ?? {
          memberId,
          date: day,
          steps: 0,
          cardioLoad: 0,
          cardioLoadSource: 'estimated',
          activeMinutes: 0,
          activeCalories: 0,
          distanceKm: 0,
          source: 'manual',
        };
        const row: DailyMetric =
          value == null
            ? { ...base, cardioLoadSource: 'estimated' }
            : { ...base, cardioLoad: Math.round(value), cardioLoadSource: 'manual' };
        const daily = { ...get().daily, [memberId]: { ...(get().daily[memberId] ?? {}), [day]: row } };
        set({ daily });
        if (get().cloud?.groupId && memberId === get().meId) cloud.pushMyData([row], []).catch(() => {});
      },

      addWorkout(w) {
        set({ workouts: upsertWorkouts(get().workouts, [w]) });
        if (get().cloud?.groupId && w.memberId === get().meId) cloud.pushMyData([], [w]).catch(() => {});
      },

      deleteWorkout(id) {
        const w = get().workouts.find((x) => x.id === id);
        set({ workouts: get().workouts.filter((x) => x.id !== id) });
        if (w && get().cloud?.groupId && w.memberId === get().meId) cloud.deleteWorkoutRow(w.memberId, id).catch(() => {});
      },

      async syncHealthNow() {
        const { meId, syncDays, profile, mode } = get();
        if (mode !== 'live') throw new Error('Switch to your real data first (Settings → Data source).');
        set({ busy: true, lastError: undefined });
        try {
          if (!(await healthProvider.isAvailable())) {
            throw new Error(`${healthProvider.label} isn't available. Install a development build of the app on your phone.`);
          }
          const ok = await healthProvider.requestPermissions();
          if (!ok) throw new Error('Permission to read health data was not granted.');
          const result = await syncHealth({ memberId: meId, days: syncDays, profile });
          set({
            daily: upsertDaily(get().daily, result.daily),
            workouts: upsertWorkouts(get().workouts, result.workouts),
            profile: result.restingHr ? { ...profile, restingHr: result.restingHr } : profile,
            lastHealthSync: new Date().toISOString(),
          });
          if (get().cloud?.groupId) await get().syncCloudNow();
          return `Imported ${result.daily.length} days and ${result.workouts.length} workouts.`;
        } catch (e) {
          set({ lastError: errorMessage(e) });
          throw e;
        } finally {
          set({ busy: false });
        }
      },

      async syncCloudNow() {
        const { cloud: link, meId } = get();
        if (!cloudConfigured || !link?.groupId) throw new Error('Join or create a group first.');
        set({ busy: true, lastError: undefined });
        try {
          const mine = Object.values(get().daily[meId] ?? {});
          const myWorkouts = get().workouts.filter((w) => w.memberId === meId);
          await cloud.pushMyData(mine, myWorkouts);
          const since = addDays(todayKey(), -get().syncDays);
          const data = await cloud.pullGroupData(since);
          set({
            members: data.members.length ? data.members : get().members,
            daily: upsertDaily({}, data.daily),
            workouts: upsertWorkouts([], data.workouts),
            challenge: data.challenge ?? get().challenge,
            lastCloudSync: new Date().toISOString(),
          });
          return `Synced ${data.members.length} members.`;
        } catch (e) {
          set({ lastError: errorMessage(e) });
          throw e;
        } finally {
          set({ busy: false });
        }
      },

      linkCloud(link) {
        const { meId, daily, workouts, members } = get();
        // Re-key local data to the cloud user id.
        const rekey = <T extends { memberId: string }>(x: T): T => (x.memberId === meId ? { ...x, memberId: link.userId } : x);
        const myDays = Object.values(daily[meId] ?? {}).map(rekey);
        const nextDaily: DailyMap = { ...daily };
        delete nextDaily[meId];
        set({
          cloud: link,
          meId: link.userId,
          members: members.map((m) => (m.id === meId ? { ...m, id: link.userId } : m)),
          daily: upsertDaily(nextDaily, myDays),
          workouts: workouts.map(rekey),
        });
      },

      unlinkCloud() {
        cloud.signOut().catch(() => {});
        const { meId, members } = get();
        set({
          cloud: undefined,
          members: members.filter((m) => m.id === meId),
          lastCloudSync: undefined,
        });
      },

      setManualSteps(memberId, day, steps) {
        const existing = get().daily[memberId]?.[day];
        const row: DailyMetric = {
          ...(existing ?? {
            memberId,
            date: day,
            cardioLoad: 0,
            cardioLoadSource: 'estimated' as const,
            activeMinutes: 0,
            activeCalories: 0,
            distanceKm: 0,
          }),
          steps: Math.round(steps),
          source: 'manual',
        };
        set({ daily: { ...get().daily, [memberId]: { ...(get().daily[memberId] ?? {}), [day]: row } } });
        if (get().cloud?.groupId && memberId === get().meId) cloud.pushMyData([row], []).catch(() => {});
      },

      startDemo() {
        get().enterDemo();
        set({ entry: 'app' });
      },

      async signInWithGoogle() {
        if (!cloudConfigured) throw new Error(SIGN_IN_UNAVAILABLE);
        const user = await auth.signInWithGoogle();
        if (!user) return 'cancelled';
        return get().completeSignIn(user);
      },

      async completeSignIn(user) {
        if (get().mode !== 'live') get().goLive(user.name ?? 'Me');
        if (get().cloud?.userId !== user.userId) get().linkCloud({ userId: user.userId, email: user.email });
        const group = await cloud.myGroup();
        set({ entry: 'app', setupPending: !group });
        if (!group) return 'needs-group';
        await get().setGroup(group);
        return 'ready';
      },

      async finishWebRedirect() {
        if (!cloudConfigured) return;
        const res = await auth.completeWebSignIn().catch(() => null);
        if (!res) return;
        if (get().cloud?.userId !== res.user.userId) await get().completeSignIn(res.user);
        if (res.healthRequested && res.user.providerRefreshToken && get().cloud?.groupId) {
          await cloud.linkGoogleHealth(res.user.providerRefreshToken, todayKey());
          set({ dataSource: 'google', googleHealth: { linked: true, lastSync: new Date().toISOString() } });
          await get().syncCloudNow().catch(() => {});
        }
      },

      async setGroup(group) {
        set((st) => ({
          cloud: st.cloud && { ...st.cloud, groupId: group.id, groupName: group.name, inviteCode: group.invite_code },
        }));
        await get().syncCloudNow().catch(() => {});
        if (get().cloud?.groupId) {
          const status = await cloud.googleHealthStatus().catch(() => null);
          if (status?.linked) {
            set({
              dataSource: 'google',
              googleHealth: { linked: true, lastSync: status.lastSync ?? undefined, lastError: status.lastError ?? undefined },
            });
          }
        }
      },

      setDataSource(source) {
        set({ dataSource: source });
      },

      async connectGoogleHealth() {
        if (!cloudConfigured) throw new Error(SIGN_IN_UNAVAILABLE);
        set({ busy: true, lastError: undefined });
        try {
          const user = await auth.signInWithGoogle({ health: true });
          if (!user) return ''; // cancelled, or the web page is redirecting to Google
          if (get().cloud?.userId !== user.userId) await get().completeSignIn(user);
          if (!get().cloud?.groupId) throw new Error('Create or join a group first, then connect Google Health.');
          if (!user.providerRefreshToken) throw new Error('Google did not grant ongoing access. Try again and allow all requested access.');
          const r = await cloud.linkGoogleHealth(user.providerRefreshToken, todayKey());
          set({ dataSource: 'google', googleHealth: { linked: true, lastSync: new Date().toISOString() } });
          await get().syncCloudNow();
          return `Imported ${r.days} days and ${r.workouts} workouts from Google Health.`;
        } catch (e) {
          set({ lastError: errorMessage(e) });
          throw e;
        } finally {
          set({ busy: false });
        }
      },

      async disconnectGoogleHealth() {
        await cloud.unlinkGoogleHealth().catch(() => {});
        set({ googleHealth: undefined, dataSource: 'device' });
      },

      async syncNow() {
        const { mode, dataSource, cloud: link } = get();
        if (mode === 'demo') {
          get().refreshDemo();
          return 'Demo data refreshed.';
        }
        if (dataSource === 'google' && link?.groupId) {
          set({ busy: true, lastError: undefined });
          try {
            const r = await cloud.syncGoogleHealth(todayKey(), 14);
            set({ googleHealth: { linked: true, lastSync: new Date().toISOString() } });
            await get().syncCloudNow();
            return `Updated ${r.days} days and ${r.workouts} workouts from Google Health.`;
          } catch (e) {
            set({ lastError: errorMessage(e), googleHealth: { ...get().googleHealth, linked: true, lastError: errorMessage(e) } });
            throw e;
          } finally {
            set({ busy: false });
          }
        }
        return get().syncHealthNow();
      },

      signOut() {
        if (cloudConfigured) cloud.signOut().catch(() => {});
        get().enterDemo();
        set({ entry: 'welcome', dataSource: 'device', googleHealth: undefined, setupPending: false });
      },

      finishSetup() {
        set({ setupPending: false });
      },

      clearError() {
        set({ lastError: undefined });
      },
    }),
    {
      name: 'fitness-challenge',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        entry: s.entry,
        mode: s.mode,
        dataSource: s.dataSource,
        setupPending: s.setupPending,
        googleHealth: s.googleHealth,
        meId: s.meId,
        members: s.members,
        challenge: s.challenge,
        profile: s.profile,
        syncDays: s.syncDays,
        lastHealthSync: s.lastHealthSync,
        lastCloudSync: s.lastCloudSync,
        cloud: s.cloud,
        // Demo data is regenerated on launch; only real data is stored.
        ...(s.mode === 'live' ? { daily: s.daily, workouts: s.workouts } : {}),
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.mode === 'demo') state.refreshDemo();
        useAppStore.setState({ hydrated: true });
      },
    },
  ),
);

export function useDataView(): DataView {
  const daily = useAppStore((s) => s.daily);
  const workouts = useAppStore((s) => s.workouts);
  return useMemo(() => ({ daily, index: indexWorkouts(workouts) }), [daily, workouts]);
}

export function useMember(id: string): Member | undefined {
  return useAppStore((s) => s.members.find((m) => m.id === id));
}

export function useMe(): Member {
  return useAppStore((s) => s.members.find((m) => m.id === s.meId) ?? s.members[0]);
}
