import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_MEMBERS, defaultChallenge, generateDemoData } from '../data/demo';
import { addDays, todayKey } from '../lib/dates';
import type { HrProfile } from '../lib/heartRate';
import { DataView, indexWorkouts } from '../lib/stats';
import * as cloud from '../services/cloud/api';
import { cloudConfigured } from '../services/cloud/client';
import { healthProvider, syncHealth } from '../services/health';
import { safeStorage } from '../services/storage';
import { memberPalette } from '../theme';
import type { Challenge, DailyMap, DailyMetric, DayKey, Member, Workout } from '../types';

export type Mode = 'demo' | 'live';

export interface CloudLink {
  userId: string;
  email: string;
  groupId?: string;
  groupName?: string;
  inviteCode?: string;
}

interface State {
  mode: Mode;
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
  mode: 'demo',
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

      clearError() {
        set({ lastError: undefined });
      },
    }),
    {
      name: 'fitness-challenge',
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        mode: s.mode,
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
