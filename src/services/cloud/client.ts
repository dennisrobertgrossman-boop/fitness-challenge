import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { safeStorage } from '../storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when the app was built with Supabase credentials (see README → Cloud sync). */
export const cloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cloudConfigured) throw new Error('Cloud sync is not configured for this build.');
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: {
        storage: safeStorage,
        autoRefreshToken: true,
        persistSession: true,
        // PKCE: the browser sign-in returns a one-time code the app exchanges for a session.
        flowType: 'pkce',
        // On the web the code arrives in the page URL after Google redirects back.
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}
