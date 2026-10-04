import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { parseSupabaseConfig } from './config';

let client: SupabaseClient | undefined;

/**
 * Lazily created so that screens and tests that never talk to Supabase do not need
 * the environment variables. Throws a descriptive error if they are missing.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const { url, publishableKey } = parseSupabaseConfig({
    // Expo inlines EXPO_PUBLIC_ variables only when they are read with this exact syntax.
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  client = createClient(url, publishableKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Refresh the session only while the app is in the foreground.
  if (Platform.OS !== 'web') {
    const auth = client.auth;
    AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        auth.startAutoRefresh();
      } else {
        auth.stopAutoRefresh();
      }
    });
  }

  return client;
}
