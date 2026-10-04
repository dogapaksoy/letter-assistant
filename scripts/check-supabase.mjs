// Checks that .env points at a reachable Supabase project with a valid public key.
// Usage: npm run supabase:check   (never prints the key)

const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error('Missing values. Copy .env.example to .env and fill it in.');
  process.exit(1);
}
if (!/^https:\/\/[^/\s]+$/.test(url)) {
  const ref = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/)?.[1];
  console.error(
    'EXPO_PUBLIC_SUPABASE_URL must be the project API URL, like https://<project>.supabase.co (no path).' +
      (ref ? `\nYou entered the dashboard address. Use: https://${ref}.supabase.co` : ''),
  );
  process.exit(1);
}
if (key.startsWith('sb_secret_')) {
  console.error('This is a SECRET key. Use the publishable key, and rotate the secret key.');
  process.exit(1);
}

try {
  const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
  if (response.ok) {
    console.log(`OK: connected to ${new URL(url).host}`);
  } else if (response.status === 401 || response.status === 403) {
    console.error(
      `Reached ${new URL(url).host}, but the key was rejected (HTTP ${response.status}).`,
    );
    process.exit(1);
  } else {
    console.error(`Unexpected response from ${new URL(url).host}: HTTP ${response.status}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`Could not reach ${url}: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}
