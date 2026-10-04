export interface SupabaseConfig {
  url: string;
  publishableKey: string;
}

/**
 * Validates the public Supabase settings shipped inside the app bundle.
 *
 * Everything in an EXPO_PUBLIC_ variable is readable by anyone who has the app, so this
 * refuses secret / service_role keys: they bypass Row Level Security.
 */
export function parseSupabaseConfig(env: {
  url: string | undefined;
  publishableKey: string | undefined;
}): SupabaseConfig {
  const url = env.url?.trim();
  const publishableKey = env.publishableKey?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env and fill in ' +
        'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    );
  }

  if (!/^https:\/\/[^/\s]+$/.test(url)) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_URL must look like https://<project>.supabase.co (no path).',
    );
  }

  if (isSecretKey(publishableKey)) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY contains a secret key. Use the publishable ' +
        '(or legacy anon) key, and rotate the secret key in the Supabase dashboard.',
    );
  }

  return { url, publishableKey };
}

function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) return true;
  // Legacy keys are JWTs; the service_role one carries that role in its payload.
  const payload = key.split('.')[1];
  if (!payload) return false;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return (JSON.parse(json) as { role?: unknown }).role === 'service_role';
  } catch {
    return false;
  }
}
