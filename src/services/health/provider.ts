import type { HealthProvider } from './types';

/**
 * Fallback for platforms without a health store (web, Expo Go preview).
 * Metro picks provider.android.ts / provider.ios.ts on those platforms.
 */
export const provider: HealthProvider = {
  id: 'none',
  label: 'Not available on this platform',
  isAvailable: async () => false,
  requestPermissions: async () => false,
  read: async () => {
    throw new Error('Health data is only available in the iOS and Android apps.');
  },
};
