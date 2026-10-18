# Brothers Challenge — notes for Claude

Expo SDK 58 / React Native 0.88 / TypeScript app. See README.md for features and setup.

## Commands

- `npm run typecheck` — must pass before committing
- `npm run build:web` — Metro web export into `dist/` (also catches bundling errors)
- `npm run build:preview` — single-file HTML preview (used for the shareable web preview)
- Install Expo packages with `EXPO_OFFLINE=1 npx expo install <pkg>` in the cloud sandbox (the Expo versions API is blocked there).

## Architecture

- Navigation uses React Navigation directly (not Expo Router) with no URL linking, so the web preview works at any URL.
- All state lives in `src/store/useAppStore.ts` (Zustand + persist). Demo data is regenerated on launch and never persisted; live data is persisted.
- `useDataView()` gives screens `{ daily, index }`; derive numbers with helpers in `src/lib/stats.ts` and `src/lib/scoring.ts` instead of ad-hoc loops.
- Health providers are platform files (`provider.android.ts`, `provider.ios.ts`, `provider.ts` fallback) that load native modules lazily so Expo Go and web don't crash.
- Charts are hand-written SVG (`src/components/charts`). Member colours come from `memberPalette` (fixed order, validated for colour-vision deficiency); metric colours from `metricColors`.
- Accounts: Supabase Auth. "Sign in with Google" runs through `src/services/cloud/auth.ts` (PKCE; in-app browser on native, page redirect on web). `entry` in the store switches between the Welcome stack and the main stack; `setupPending` opens Get Started after the first sign-in.
- Fitbit data comes from the Google Health API via the `google-health` Edge Function (`supabase/functions`). Parsing lives in `supabase/functions/_shared/googleHealth.ts` with no Deno imports so it can be tested with Node (`node --experimental-strip-types`). The Google Health API has no Cardio Load type; it is estimated from heart-rate zone minutes there.
- UI text: no unexplained acronyms; Cardio Load values computed here are always labelled "estimated".
