# Brothers Challenge

A fitness challenge app for iOS and Android, built for three brothers. It compares steps, Cardio Load,
workouts and more, with a design modelled on Apple Fitness.

Built with Expo (React Native) and TypeScript. It runs on iPhone, Android and in a web browser. The browser
version is only a preview with demo data.

## What's in the app

| Screen | What you see |
| --- | --- |
| **Welcome** | Sign in with Google (or email code), or explore the demo. After the first sign-in, **Get Started** sets up the group and each brother's data source. |
| **Summary** | Your three rings for today (steps, Cardio Load, active minutes), the week as mini rings, the challenge standings, each brother's numbers for today, your latest workouts and your 7-day trends. |
| **Challenge** | Ranking with medals and weekly-win crowns, a points race chart, a head-to-head table (this week or the whole challenge) and weekly winners. |
| **Workouts** | Workouts this week per brother, a workouts-per-week chart for the last 8 weeks, and every workout from everyone, filterable by brother and type. |
| **Data** | Any metric (steps, Cardio Load, workouts, active minutes, distance, calories) per day or per week for all three brothers, plus totals with the change against the previous period, a calendar heatmap, personal bests, workout mix and spreadsheet export. |

Tapping a brother opens their profile: rings, streaks, a 30-day steps chart, weekly Cardio Load and recent
workouts. Tapping a workout opens its details: time, distance, pace, heart-rate curve and heart-rate zones.

### Challenge scoring

Everyone is scored against the same targets (set in Settings), so personal goals don't affect points:

- **Steps:** 1 point per 1 % of the step target, up to 200 a day
- **Cardio Load:** 1 point per 1 % of the Cardio Load target, up to 200 a day
- **Workouts:** 100 points per workout of at least 20 minutes, up to 2 a day

A perfect day is worth 600 points.

## Accounts

Everyone signs in with **Sign in with Google** (or, as a fallback, an emailed 6-digit code). Accounts, the
group and all shared data live in Supabase, a hosted Postgres database. Everyone in the group can read the
group's data; each person can only change their own.

## Where the data comes from

Each brother picks his own source on the **Get Started** screen after signing in:

| Watch | Route into the app |
| --- | --- |
| **Fitbit Air** (or any Fitbit / Pixel Watch) | **Google Health API.** The brother allows read access to his Google Health data when he connects. A server function (`supabase/functions/google-health`) then copies his daily steps, distance, active calories, active minutes, time in heart-rate zones, resting heart rate and workouts into the group, about once an hour and whenever he taps Sync. This works the same on iPhone and Android, even with the app closed. |
| **Huawei** | **The phone's health store.** On an iPhone, Huawei Health can write to Apple Health and the app reads it from there. On Android, Huawei Health does not write to Health Connect itself; a bridge app (for example Health Sync) has to copy the data into Health Connect first. If neither works, steps and Cardio Load can be typed in under **Daily numbers**. |
| Other watches (Garmin, Samsung, Apple Watch …) | Health Connect on Android or Apple Health on iPhone, read on the phone. |

**Cardio Load.** The Google Health API has no Cardio Load data type (checked against Google's published API
description, revision 20261014). The app therefore estimates it with a heart-rate-reserve training-impulse
formula: from time in heart-rate zones for Google Health data, and from raw heart rate for Health Connect /
Apple Health. Estimates are labelled "estimated". To use Google's exact numbers, type them in under
**Summary → tap Cardio Load** (or **Settings → Enter daily numbers by hand**). Typed values replace the estimate
everywhere, including challenge points, and later syncs never overwrite them.

Until someone signs in, the app shows 12 weeks of generated demo data for three brothers.

## Run it

```bash
npm install
npm run web          # browser preview (demo data; sign-in needs the setup below)
npx expo start       # then scan the QR code with Expo Go
```

Reading Health Connect or Apple Health needs a **development build**, because Expo Go does not include those
modules:

```bash
npx eas-cli@latest build --profile development --platform android   # or ios
```

## Setting up sign-in and sharing (one-time, about 30 minutes)

### 1. Supabase project
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor:** paste `supabase/schema.sql` and run it.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (**Project Settings → API**).

### 2. Google Cloud project (for "Sign in with Google" and Google Health)
1. In the [Google Cloud console](https://console.cloud.google.com), create a project.
2. **APIs & Services → Library:** enable the **Google Health API**.
3. **OAuth consent screen:** user type *External*; add the scopes
   `…/auth/googlehealth.activity_and_fitness.readonly` and
   `…/auth/googlehealth.health_metrics_and_measurements.readonly`; add the three brothers' Google addresses as
   **test users**.
4. **Credentials → Create OAuth client ID → Web application.** Authorized redirect URI:
   `https://<your-project-ref>.supabase.co/auth/v1/callback`. Keep the client ID and secret.

### 3. Connect the two
1. Supabase → **Authentication → Sign In / Providers → Google:** turn it on and paste the client ID and secret.
2. Supabase → **Authentication → URL Configuration → Redirect URLs:** add `brotherschallenge://**`
   (the installed app) and `exp://**` (Expo Go while developing).
3. For the email-code fallback: **Authentication → Email Templates → Magic Link**, add `{{ .Token }}` to the body.
4. Deploy the sync function and give it its secrets (Supabase CLI):
   ```bash
   supabase functions deploy google-health
   supabase secrets set GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… CRON_SECRET=<any long random string>
   ```
5. Hourly background sync (SQL Editor; enable the `pg_cron` and `pg_net` extensions first):
   ```sql
   select cron.schedule('google-health-sync', '17 * * * *', $$
     select net.http_post(
       url := 'https://<your-project-ref>.supabase.co/functions/v1/google-health',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer <anon key>',
         'x-cron-secret', '<CRON_SECRET>'),
       body := '{"action":"sync-all"}'::jsonb);
   $$);
   ```
6. Rebuild the app. The first brother signs in, creates the group and shares the invite code; the others sign
   in and join.

### Known limits of Google's rules
- All Google Health API scopes are classified by Google as *restricted*. While the Google Cloud project stays
  in **Testing** mode (fine for three people listed as test users), Google ends the connection after 7 days and
  each Fitbit brother has to tap **Reconnect Google Health**; the app shows a banner when that is needed.
  Removing that limit means publishing the Google project, which for restricted scopes requires Google's
  review.
- These two points come from Google's Health API setup pages as reported in search results; the Google
  developer site could not be opened directly from the environment this was built in, so re-check them in
  the console when setting up.

## Project layout

```
App.tsx                       entry point
src/
  navigation/                 tabs + stack (React Navigation)
  screens/                    Summary, Challenge, Workouts, Data, Member, WorkoutDetail, Settings, …
  components/                 rings, cards, charts (SVG), list rows
  store/useAppStore.ts        app state (Zustand), persisted on the device
  lib/                        dates, formatting, statistics, scoring, heart-rate maths
  data/demo.ts                deterministic demo data generator
  services/health/            Health Connect (provider.android.ts) and HealthKit (provider.ios.ts)
  services/cloud/             Supabase client, Google sign-in, queries
supabase/schema.sql           database tables, row-level security, create/join group functions
supabase/functions/           google-health sync function (Deno) and its parsing helpers
scripts/build-preview.mjs     bundles the web export into one HTML file
```

## Checks

```bash
npm run typecheck
npm run build:web
```

## Font

The interface uses Segoe UI wherever the device has it (Windows browsers). Segoe UI is a Microsoft font that
ships with Windows. It is not bundled into the phone app because no licence permitting that has been
confirmed, so iOS and Android use the system font. If you hold a licence that allows embedding it, add the
font file with `expo-font` and set `fontFamily` in `src/theme/index.ts`.
