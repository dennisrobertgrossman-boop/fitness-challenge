import type { Challenge, DailyMetric, Goals, Member, Workout } from '../../types';
import { supabase } from './client';

export interface Group {
  id: string;
  name: string;
  invite_code: string;
}

// ---------- Auth (email one-time code) ----------

export async function sendLoginCode(email: string) {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyLoginCode(email: string, token: string) {
  const { data, error } = await supabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-in failed.');
  return { userId: data.user.id, email: data.user.email ?? email };
}

export async function signOut() {
  await supabase().auth.signOut();
}

// ---------- Group membership ----------

export async function myGroup(): Promise<Group | null> {
  const { data, error } = await supabase().from('groups').select('id, name, invite_code').maybeSingle();
  if (error) throw error;
  return data;
}

export async function createGroup(groupName: string, displayName: string, color: string): Promise<Group> {
  const { data, error } = await supabase().rpc('create_group', {
    group_name: groupName,
    display_name: displayName,
    member_color: color,
  });
  if (error) throw error;
  return data as Group;
}

export async function joinGroup(code: string, displayName: string, color: string): Promise<Group> {
  const { data, error } = await supabase().rpc('join_group', {
    code: code.trim().toUpperCase(),
    display_name: displayName,
    member_color: color,
  });
  if (error) throw error;
  return data as Group;
}

export async function updateMemberRow(member: Member) {
  const { error } = await supabase()
    .from('members')
    .update({ name: member.name, color: member.color, goals: member.goals })
    .eq('id', member.id);
  if (error) throw error;
}

export async function saveChallenge(groupId: string, c: Challenge) {
  const { error } = await supabase().from('challenges').upsert({
    group_id: groupId,
    name: c.name,
    start_date: c.start,
    end_date: c.end,
    targets: c.targets,
  });
  if (error) throw error;
}

// ---------- Data ----------

const dailyToRow = (d: DailyMetric) => ({
  member_id: d.memberId,
  date: d.date,
  steps: d.steps,
  cardio_load: d.cardioLoad,
  cardio_load_source: d.cardioLoadSource,
  active_minutes: d.activeMinutes,
  active_calories: d.activeCalories,
  distance_km: d.distanceKm,
  resting_hr: d.restingHr ?? null,
  source: d.source,
  updated_at: new Date().toISOString(),
});

const workoutToRow = (w: Workout) => ({
  member_id: w.memberId,
  id: w.id,
  type: w.type,
  title: w.title ?? null,
  start_time: w.start,
  duration_min: w.durationMin,
  distance_km: w.distanceKm ?? null,
  active_calories: w.activeCalories ?? null,
  avg_hr: w.avgHr ?? null,
  max_hr: w.maxHr ?? null,
  cardio_load: w.cardioLoad ?? null,
  zones: w.zones ?? null,
  hr_series: w.hrSeries ?? null,
  source: w.source,
  notes: w.notes ?? null,
  updated_at: new Date().toISOString(),
});

/* eslint-disable @typescript-eslint/no-explicit-any */
const rowToDaily = (r: any): DailyMetric => ({
  memberId: r.member_id,
  date: r.date,
  steps: r.steps,
  cardioLoad: r.cardio_load,
  cardioLoadSource: r.cardio_load_source,
  activeMinutes: r.active_minutes,
  activeCalories: r.active_calories,
  distanceKm: Number(r.distance_km),
  restingHr: r.resting_hr ?? undefined,
  source: r.source,
});

const rowToWorkout = (r: any): Workout => ({
  id: r.id,
  memberId: r.member_id,
  type: r.type,
  title: r.title ?? undefined,
  start: r.start_time,
  durationMin: Number(r.duration_min),
  distanceKm: r.distance_km == null ? undefined : Number(r.distance_km),
  activeCalories: r.active_calories ?? undefined,
  avgHr: r.avg_hr ?? undefined,
  maxHr: r.max_hr ?? undefined,
  cardioLoad: r.cardio_load ?? undefined,
  zones: r.zones ?? undefined,
  hrSeries: r.hr_series ?? undefined,
  source: r.source,
  notes: r.notes ?? undefined,
});

const rowToMember = (r: any): Member => ({
  id: r.id,
  name: r.name,
  color: r.color,
  goals: r.goals as Goals,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export async function pushMyData(daily: DailyMetric[], workouts: Workout[]) {
  const db = supabase();
  for (let i = 0; i < daily.length; i += 500) {
    const { error } = await db.from('daily_metrics').upsert(daily.slice(i, i + 500).map(dailyToRow));
    if (error) throw error;
  }
  for (let i = 0; i < workouts.length; i += 200) {
    const { error } = await db.from('workouts').upsert(workouts.slice(i, i + 200).map(workoutToRow));
    if (error) throw error;
  }
}

export async function deleteWorkoutRow(memberId: string, id: string) {
  const { error } = await supabase().from('workouts').delete().eq('member_id', memberId).eq('id', id);
  if (error) throw error;
}

export async function pullGroupData(sinceDay: string) {
  const db = supabase();
  const [members, daily, workouts, challenge] = await Promise.all([
    db.from('members').select('*').order('created_at'),
    db.from('daily_metrics').select('*').gte('date', sinceDay),
    db.from('workouts').select('*').gte('start_time', sinceDay).order('start_time', { ascending: false }),
    db.from('challenges').select('*').maybeSingle(),
  ]);
  for (const r of [members, daily, workouts, challenge]) if (r.error) throw r.error;
  const c = challenge.data;
  return {
    members: (members.data ?? []).map(rowToMember),
    daily: (daily.data ?? []).map(rowToDaily),
    workouts: (workouts.data ?? []).map(rowToWorkout),
    challenge: c
      ? ({ name: c.name, start: c.start_date, end: c.end_date, targets: c.targets } as Challenge)
      : undefined,
  };
}

// ---------- Google Health (Fitbit) via the google-health Edge Function ----------

export interface GoogleHealthStatus {
  linked: boolean;
  lastSync: string | null;
  lastError: string | null;
}

async function googleHealth<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('google-health', { body });
  if (error) {
    // The function answers errors as { error: "…" }; surface that message.
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.json().catch(() => null) : null;
    throw new Error(detail?.error ?? error.message);
  }
  return data as T;
}

export function linkGoogleHealth(refreshToken: string, today: string) {
  return googleHealth<{ days: number; workouts: number }>({ action: 'link', refreshToken, today });
}

export function syncGoogleHealth(today: string, days = 14) {
  return googleHealth<{ days: number; workouts: number }>({ action: 'sync', today, days });
}

export function googleHealthStatus() {
  return googleHealth<GoogleHealthStatus>({ action: 'status' });
}

export function unlinkGoogleHealth() {
  return googleHealth<{ linked: boolean }>({ action: 'unlink' });
}
