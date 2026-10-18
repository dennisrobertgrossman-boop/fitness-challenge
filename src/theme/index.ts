import { Platform, TextStyle } from 'react-native';

/**
 * Dark, high-contrast palette modelled on Apple Fitness: true-black canvas,
 * charcoal cards, vivid ring colours.
 */
export const colors = {
  bg: '#000000',
  card: '#1C1C1E',
  cardRaised: '#2C2C2E',
  separator: '#38383A',
  text: '#FFFFFF',
  textSecondary: '#AEAEB2',
  textMuted: '#8E8E93',
  accent: '#A6FF00',
  danger: '#FF453A',
  warning: '#FFD60A',
  success: '#32D74B',
  gold: '#FFD60A',
  silver: '#C7C7CC',
  bronze: '#D49A6A',
  grid: '#2C2C2E',
};

/** Metric identity colours (rings, metric chips). */
export const metricColors = {
  steps: '#FA114F',
  cardioLoad: '#A6FF00',
  activeMinutes: '#00E0F0',
  workouts: '#FF9F0A',
  distanceKm: '#64D2FF',
  activeCalories: '#FF375F',
} as const;

/**
 * Member identity colours. Order is fixed (never cycled) and the set was
 * validated for colour-vision-deficiency separation against the card surface.
 */
export const memberPalette = ['#3987E5', '#D95926', '#199E70'] as const;

/**
 * Segoe UI is used wherever the platform provides it (Windows / web).
 * The font file is not bundled (no licence for embedding it has been confirmed),
 * so iOS and Android fall back to the system font unless one is added via expo-font.
 */
export const fontFamily = Platform.select<string | undefined>({
  web: "'Segoe UI', 'Segoe UI Variable Text', system-ui, -apple-system, Roboto, 'Helvetica Neue', sans-serif",
  default: undefined,
});

type Variant =
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subhead'
  | 'footnote'
  | 'caption';

export const type: Record<Variant, TextStyle> = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: 0.3 },
  title: { fontSize: 28, fontWeight: '700' },
  title2: { fontSize: 22, fontWeight: '700' },
  title3: { fontSize: 20, fontWeight: '600' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  callout: { fontSize: 16, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '400' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 22 };
