-- Brothers Challenge — Supabase schema
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
--
-- Model: one group (you + your brothers). Everyone can read everything in their
-- group; each person can only write their own rows.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null,
  color text not null,
  goals jsonb not null default '{"steps":10000,"cardioLoad":50,"activeMinutes":30,"workoutsPerWeek":4}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.daily_metrics (
  member_id uuid not null references public.members (id) on delete cascade,
  date date not null,
  steps integer not null default 0,
  cardio_load integer not null default 0,
  cardio_load_source text not null default 'estimated',
  active_minutes integer not null default 0,
  active_calories integer not null default 0,
  distance_km numeric(8, 2) not null default 0,
  resting_hr integer,
  source text not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, date)
);

create table if not exists public.workouts (
  member_id uuid not null references public.members (id) on delete cascade,
  id text not null,
  type text not null,
  title text,
  start_time timestamptz not null,
  duration_min numeric(7, 2) not null,
  distance_km numeric(8, 2),
  active_calories integer,
  avg_hr integer,
  max_hr integer,
  cardio_load integer,
  zones jsonb,
  hr_series jsonb,
  source text not null,
  notes text,
  updated_at timestamptz not null default now(),
  primary key (member_id, id)
);
create index if not exists workouts_start_idx on public.workouts (start_time desc);

create table if not exists public.challenges (
  group_id uuid primary key references public.groups (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  targets jsonb not null default '{"steps":10000,"cardioLoad":50,"minWorkoutMin":20}'::jsonb
);

-- ---------- Helpers ----------

create or replace function public.my_group_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select group_id from public.members where id = auth.uid()
$$;

-- ---------- Row level security ----------

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.workouts enable row level security;
alter table public.challenges enable row level security;

drop policy if exists "read own group" on public.groups;
create policy "read own group" on public.groups
  for select using (id = public.my_group_id());

drop policy if exists "read group members" on public.members;
create policy "read group members" on public.members
  for select using (group_id = public.my_group_id());
drop policy if exists "update self" on public.members;
create policy "update self" on public.members
  for update using (id = auth.uid()) with check (id = auth.uid() and group_id = public.my_group_id());

drop policy if exists "read group daily" on public.daily_metrics;
create policy "read group daily" on public.daily_metrics
  for select using (member_id in (select id from public.members where group_id = public.my_group_id()));
drop policy if exists "write own daily" on public.daily_metrics;
create policy "write own daily" on public.daily_metrics
  for all using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "read group workouts" on public.workouts;
create policy "read group workouts" on public.workouts
  for select using (member_id in (select id from public.members where group_id = public.my_group_id()));
drop policy if exists "write own workouts" on public.workouts;
create policy "write own workouts" on public.workouts
  for all using (member_id = auth.uid()) with check (member_id = auth.uid());

drop policy if exists "read group challenge" on public.challenges;
create policy "read group challenge" on public.challenges
  for select using (group_id = public.my_group_id());
drop policy if exists "edit group challenge" on public.challenges;
create policy "edit group challenge" on public.challenges
  for all using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());

-- ---------- Create / join a group ----------

create or replace function public.create_group(group_name text, display_name text, member_color text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  insert into public.groups (name) values (coalesce(nullif(trim(group_name), ''), 'Brothers')) returning * into g;
  insert into public.members (id, group_id, name, color)
    values (auth.uid(), g.id, display_name, member_color)
    on conflict (id) do update set group_id = excluded.group_id, name = excluded.name;
  insert into public.challenges (group_id, name, start_date, end_date)
    values (g.id, 'Brothers Challenge', date_trunc('week', now())::date, (date_trunc('week', now()) + interval '6 weeks' - interval '1 day')::date);
  return g;
end;
$$;

create or replace function public.join_group(code text, display_name text, member_color text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
  palette text[] := array['#3987E5', '#D95926', '#199E70'];
  taken integer;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select * into g from public.groups where invite_code = upper(trim(code));
  if g.id is null then
    raise exception 'Invite code not found';
  end if;
  select count(*) into taken from public.members where group_id = g.id and id <> auth.uid();
  if taken >= 8 then
    raise exception 'This group is full';
  end if;
  insert into public.members (id, group_id, name, color)
    values (auth.uid(), g.id, display_name, coalesce(palette[taken + 1], member_color))
    on conflict (id) do update set group_id = excluded.group_id, name = excluded.name, color = excluded.color;
  return g;
end;
$$;

grant execute on function public.create_group(text, text, text) to authenticated;
grant execute on function public.join_group(text, text, text) to authenticated;

-- ---------- Google Health (Fitbit) connection ----------
-- Refresh tokens for the google-health Edge Function. Row level security is on and
-- there are no policies, so only the service role (used by the function) can read them.

create table if not exists public.google_health_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  scopes text,
  updated_at timestamptz not null default now(),
  last_sync timestamptz,
  last_error text
);
alter table public.google_health_tokens enable row level security;
revoke all on public.google_health_tokens from anon, authenticated;
