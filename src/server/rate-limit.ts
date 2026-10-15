/**
 * Rate limiting for the extract-letter function, backed by public.consume_rate_limit
 * (see supabase/migrations/*_rate_limit.sql).
 *
 * Two limits per hour: a global one (protects the LLM budget, no personal data) and one
 * per client. Clients are identified by a keyed hash of their IP address and the current
 * day; the IP itself is never stored or logged, and counters are deleted after a day.
 */

export interface RateLimiter {
  /** True if the request may proceed. Fails closed: errors count as "not allowed". */
  allow(request: Request): Promise<boolean>;
}

export interface RateLimitConfig {
  supabaseUrl: string;
  /** Service role / secret key: the only role allowed to call consume_rate_limit. */
  dbKey: string;
  /** Secret for hashing client IPs. */
  hashSecret: string;
  perClientPerHour: number;
  globalPerHour: number;
  fetch?: typeof fetch;
  now?: () => Date;
}

const HOUR = 3600;

export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const doFetch = config.fetch ?? fetch;
  const now = config.now ?? (() => new Date());

  async function consume(bucket: string, limit: number): Promise<boolean> {
    const response = await doFetch(`${config.supabaseUrl}/rest/v1/rpc/consume_rate_limit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.dbKey,
        Authorization: `Bearer ${config.dbKey}`,
      },
      body: JSON.stringify({ p_bucket: bucket, p_window_seconds: HOUR, p_limit: limit }),
    });
    if (!response.ok) throw new Error(`rate limit RPC failed (HTTP ${response.status})`);
    return (await response.json()) === true;
  }

  return {
    async allow(request) {
      try {
        const day = now().toISOString().slice(0, 10);
        const client = await hashClient(clientIp(request), day, config.hashSecret);
        // Check the client first so one abusive client does not use up the global budget.
        if (!(await consume(`client:${client}`, config.perClientPerHour))) return false;
        return await consume('global', config.globalPerHour);
      } catch {
        return false;
      }
    },
  };
}

/** First address in X-Forwarded-For (set by the Supabase gateway), else a fallback header. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  return first || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/** HMAC-SHA256(secret, day + ip), shortened. Not reversible without the secret. */
export async function hashClient(ip: string, day: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}|${ip}`));
  return Array.from(new Uint8Array(signature).slice(0, 16), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
