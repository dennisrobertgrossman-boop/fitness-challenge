# Brothers Challenge

A fitness challenge app for iOS and Android, built for three brothers. It compares steps, Cardio Load,
workouts and more, with a design modelled on Apple Fitness.

Built with Expo (React Native) and TypeScript. It runs on iPhone, Android and in a web browser. The browser
version is only a preview with demo data.

## What's in the app

| Tab | What you see |
| --- | --- |
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

## Where the data comes from

- **Android:** steps, workouts, heart rate, active calories and distance are read from Health Connect.
  The Google Health app (and most watches) write their data there.
- **iPhone:** the same data is read from Apple Health (HealthKit).
- **Cardio Load:** the app has no way to read Google's own Cardio Load number. It estimates Cardio Load from
  heart-rate samples using a heart-rate-reserve training-impulse formula (`src/lib/heartRate.ts`), and the
  estimate is labelled "estimated" in the app. To use Google's exact numbers, copy them in under
  **Summary → tap Cardio Load** (or **Settings → Cardio Load from Google Health**). Typed values replace the
  estimate everywhere, including in challenge points.
- **Sharing between brothers:** Supabase, a hosted Postgres database. Each brother signs in with an emailed
  code. Everyone in the group can read the group's data, and each person can only change their own.

Until you switch to real data, the app shows 12 weeks of generated demo data for three brothers, so every
screen has something in it.

## Run it

```bash
npm install
npm run web          # browser preview (demo data only)
npx expo start       # then scan the QR code with Expo Go (demo data only)
```

Reading health data needs a **development build**, because Expo Go does not include the Health Connect or
HealthKit modules:

```bash
npx eas-cli@latest build --profile development --platform android   # or ios
```

Install the build on your phone, open it, then go to **Settings → Use My Real Data → Sync**.

### Cloud sync (for sharing with your brothers)

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it.
3. Under **Authentication → Email Templates → Magic Link**, add `{{ .Token }}` to the email body so the
   email contains a 6-digit code.
4. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from **Project Settings → API**.
5. Rebuild the app. In **Settings → Group**, one brother creates the group and shares the invite code; the
   others join with it.

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
  services/cloud/             Supabase client and queries
supabase/schema.sql           database tables, row-level security, create/join group functions
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
