import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { supabase } from './client';

// Closes the sign-in popup when the web app is reopened inside it.
WebBrowser.maybeCompleteAuthSession();

/** Read-only Google Health access, used to import Fitbit data. */
export const GOOGLE_HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
];

export interface SignedInUser {
  userId: string;
  email: string;
  name?: string;
  /** Present when Google granted offline access (used to connect Google Health). */
  providerRefreshToken?: string;
}

const PENDING_HEALTH_KEY = 'pending-google-health';

/**
 * "Sign in with Google" through Supabase Auth.
 * Native: opens Google in an in-app browser and returns here through the app's link.
 * Web: redirects the page; the result is picked up by `completeWebSignIn` on reload.
 * Pass `health: true` to also ask for read access to Google Health (Fitbit) data.
 */
export async function signInWithGoogle({ health = false } = {}): Promise<SignedInUser | null> {
  const queryParams: Record<string, string> = health
    ? { access_type: 'offline', prompt: 'consent' }
    : { prompt: 'select_account' };
  const options = { scopes: health ? GOOGLE_HEALTH_SCOPES.join(' ') : undefined, queryParams };

  if (Platform.OS === 'web') {
    try {
      if (health) globalThis.localStorage?.setItem(PENDING_HEALTH_KEY, '1');
    } catch {
      // storage blocked; the health link will need a second tap
    }
    const { error } = await supabase().auth.signInWithOAuth({
      provider: 'google',
      options: { ...options, redirectTo: globalThis.location?.href.split('#')[0].split('?')[0] },
    });
    if (error) throw error;
    return null; // the page navigates to Google
  }

  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { ...options, redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return null; // closed or cancelled

  const returned = Linking.parse(result.url).queryParams;
  const errorDescription = returned?.error_description ?? returned?.error;
  if (errorDescription) throw new Error(String(errorDescription));
  const code = returned?.code;
  if (typeof code !== 'string') throw new Error('Google sign-in did not return a code.');

  const { data: exchanged, error: exchangeError } = await supabase().auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
  return toSignedInUser(exchanged.session);
}

/** After a web redirect back from Google: the signed-in user, and whether Google Health was requested. */
export async function completeWebSignIn(): Promise<{ user: SignedInUser; healthRequested: boolean } | null> {
  if (Platform.OS !== 'web') return null;
  const { data } = await supabase().auth.getSession();
  if (!data.session) return null;
  let healthRequested = false;
  try {
    healthRequested = globalThis.localStorage?.getItem(PENDING_HEALTH_KEY) === '1';
    globalThis.localStorage?.removeItem(PENDING_HEALTH_KEY);
  } catch {
    // ignore
  }
  return { user: toSignedInUser(data.session), healthRequested };
}

function toSignedInUser(session: {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
  provider_refresh_token?: string | null;
}): SignedInUser {
  const meta = session.user.user_metadata ?? {};
  const fullName = (meta.full_name ?? meta.name) as string | undefined;
  return {
    userId: session.user.id,
    email: session.user.email ?? '',
    name: fullName?.split(' ')[0],
    providerRefreshToken: session.provider_refresh_token ?? undefined,
  };
}
