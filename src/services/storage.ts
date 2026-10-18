import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage wrapper that never throws. Browser storage can be blocked
 * (private windows, sandboxed previews); the app must keep working without it.
 */
export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
