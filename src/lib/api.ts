import {
  type ExtractErrorCode,
  type ExtractRequest,
  extractResponseSchema,
  type ExtractSuccess,
} from '../core/api/contract';
import { parseSupabaseConfig } from './supabase/config';

export type ClientError = ExtractErrorCode | 'network' | 'invalid_response';

export type AnalyzeResult = { ok: true; data: ExtractSuccess } | { ok: false; error: ClientError };

/** The server can take a while (LLM call plus retries on busy providers). */
const TIMEOUT_MS = 150_000;

export type Fetch = typeof fetch;

/**
 * Calls the extract-letter edge function. Never throws: every failure becomes an error
 * code the UI can explain. Responses are validated, so a malformed answer cannot crash
 * the result screen.
 */
export async function requestExtraction(
  request: ExtractRequest,
  options: { fetch?: Fetch; url?: string; publishableKey?: string } = {},
): Promise<AnalyzeResult> {
  let endpoint: string;
  let key: string;
  try {
    const config = parseSupabaseConfig({
      url: options.url ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
      publishableKey: options.publishableKey ?? process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });
    endpoint = `${config.url}/functions/v1/extract-letter`;
    key = config.publishableKey;
  } catch {
    return { ok: false, error: 'not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: response.ok ? 'invalid_response' : 'service_unavailable' };
  }
  const parsed = extractResponseSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: 'invalid_response' };
  return parsed.data.ok ? { ok: true, data: parsed.data } : { ok: false, error: parsed.data.error };
}
