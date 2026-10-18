// Supabase Edge Function: connects a member's Google account (Fitbit / Google Health)
// and copies their daily totals and workouts into the shared tables.
//
// Actions (POST JSON body):
//   { action: "link", refreshToken, today }  store the Google refresh token, then sync 90 days
//   { action: "sync", today, days? }         sync the signed-in member (default 14 days)
//   { action: "status" }                     whether Google Health is connected, last sync, last error
//   { action: "unlink" }                     forget the stored token
//   { action: "sync-all" }                   scheduled job; needs the x-cron-secret header
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (same OAuth client as Supabase's Google provider), CRON_SECRET.
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  API_BASE,
  addDays,
  applyRestingHr,
  applyRollup,
  dailyRollUpBody,
  DayTotals,
  GOOGLE_HEALTH_SCOPES,
  ROLLUP_TYPES,
  toDailyRows,
  toWorkoutRow,
  windows,
  WorkoutRow,
} from '../_shared/googleHealth.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; scope?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google sign-in expired or was revoked (${body.error ?? res.status}). Connect Google Health again.`);
  return body;
}

async function google(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Google Health API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

async function syncMember(admin: SupabaseClient, memberId: string, today: string, days: number, accessToken?: string) {
  const { data: member } = await admin.from('members').select('id').eq('id', memberId).maybeSingle();
  if (!member) throw new Error('Create or join a group first.');

  if (!accessToken) {
    const { data: tok } = await admin.from('google_health_tokens').select('refresh_token').eq('user_id', memberId).maybeSingle();
    if (!tok) throw new Error('Google Health is not connected.');
    accessToken = (await refreshAccessToken(tok.refresh_token)).access_token;
  }

  const start = addDays(today, -(days - 1));
  const end = addDays(today, 1);
  const totals: Record<string, DayTotals> = {};

  for (const { type, maxDays } of ROLLUP_TYPES) {
    for (const [a, b] of windows(start, end, maxDays)) {
      let pageToken: string | undefined;
      do {
        const body = { ...dailyRollUpBody(a, b), ...(pageToken ? { pageToken } : {}) };
        const res = await google(accessToken, `dataTypes/${type}/dataPoints:dailyRollUp`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        applyRollup(totals, type, res.rollupDataPoints);
        pageToken = res.nextPageToken || undefined;
      } while (pageToken);
    }
  }

  const resting = await google(
    accessToken,
    `dataTypes/daily-resting-heart-rate/dataPoints?pageSize=1000&filter=${encodeURIComponent(`daily_resting_heart_rate.date >= "${start}"`)}`,
  ).catch(() => ({ dataPoints: [] }));
  applyRestingHr(totals, resting.dataPoints);

  const workouts: WorkoutRow[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  do {
    const filter = encodeURIComponent(`exercise.interval.civil_start_time >= "${start}"`);
    const res = await google(
      accessToken,
      `dataTypes/exercise/dataPoints?pageSize=25&filter=${filter}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
    );
    for (const dp of res.dataPoints ?? []) {
      const row = toWorkoutRow(memberId, dp);
      if (row) workouts.push(row);
    }
    pageToken = res.nextPageToken || undefined;
  } while (pageToken && ++pages < 40);

  // Keep Cardio Load values the member typed in from the Google Health app.
  const { data: manual } = await admin
    .from('daily_metrics')
    .select('date, cardio_load')
    .eq('member_id', memberId)
    .eq('cardio_load_source', 'manual')
    .gte('date', start);
  const manualCardio = Object.fromEntries((manual ?? []).map((r) => [r.date, r.cardio_load]));

  const daily = toDailyRows(memberId, totals, manualCardio);
  if (daily.length) {
    const { error } = await admin.from('daily_metrics').upsert(daily);
    if (error) throw error;
  }
  for (let i = 0; i < workouts.length; i += 200) {
    const { error } = await admin.from('workouts').upsert(workouts.slice(i, i + 200));
    if (error) throw error;
  }
  await admin
    .from('google_health_tokens')
    .update({ last_sync: new Date().toISOString(), last_error: null })
    .eq('user_id', memberId);
  return { days: daily.length, workouts: workouts.length };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const body = await req.json().catch(() => ({}));
  const utcToday = new Date().toISOString().slice(0, 10);

  if (body.action === 'sync-all') {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'Forbidden' }, 403);
    const { data: rows } = await admin.from('google_health_tokens').select('user_id');
    const results: Record<string, unknown> = {};
    for (const { user_id } of rows ?? []) {
      try {
        // A day ahead of UTC so members east of Greenwich get their "today" too.
        results[user_id] = await syncMember(admin, user_id, addDays(utcToday, 1), body.days ?? 3);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await admin.from('google_health_tokens').update({ last_error: message }).eq('user_id', user_id);
        results[user_id] = { error: message };
      }
    }
    return json({ results });
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: 'Sign in first.' }, 401);
  const today = typeof body.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : utcToday;

  try {
    switch (body.action) {
      case 'link': {
        if (!body.refreshToken) return json({ error: 'Google did not return offline access. Try connecting again.' }, 400);
        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) return json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set for this function.' }, 500);
        const token = await refreshAccessToken(body.refreshToken);
        const granted = (token.scope ?? '').split(' ');
        if (!granted.includes(GOOGLE_HEALTH_SCOPES[0])) {
          return json({ error: 'Access to your Google Health activity data was not granted.' }, 400);
        }
        const { error } = await admin.from('google_health_tokens').upsert({
          user_id: user.id,
          refresh_token: body.refreshToken,
          scopes: token.scope ?? null,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return json(await syncMember(admin, user.id, today, 90, token.access_token));
      }
      case 'sync':
        return json(await syncMember(admin, user.id, today, Math.min(90, Math.max(1, body.days ?? 14))));
      case 'status': {
        const { data } = await admin
          .from('google_health_tokens')
          .select('last_sync, last_error')
          .eq('user_id', user.id)
          .maybeSingle();
        return json({ linked: Boolean(data), lastSync: data?.last_sync ?? null, lastError: data?.last_error ?? null });
      }
      case 'unlink':
        await admin.from('google_health_tokens').delete().eq('user_id', user.id);
        return json({ linked: false });
      default:
        return json({ error: 'Unknown action' }, 400);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('google_health_tokens').update({ last_error: message }).eq('user_id', user.id);
    return json({ error: message }, 500);
  }
});
