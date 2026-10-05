import type { GoogleGenAI } from '@google/genai';

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from './types';

/** The part of the SDK client this adapter uses. */
export interface GeminiClient {
  models: Pick<GoogleGenAI['models'], 'generateContent'>;
}

export interface GeminiProviderOptions {
  /** Defaults to a client created from GEMINI_API_KEY. Injected in tests. */
  client?: GeminiClient;
  apiKey?: string;
  /** Defaults to GEMINI_MODEL, then gemini-2.5-flash. */
  model?: string;
}

const REFUSAL_REASONS = new Set([
  'SAFETY',
  'RECITATION',
  'BLOCKLIST',
  'PROHIBITED_CONTENT',
  'SPII',
  'LANGUAGE',
]);

/**
 * Google Gemini adapter. The free tier may use submitted data to improve Google's
 * products, so it must only ever see SYNTHETIC letters (CLAUDE.md privacy rules);
 * the eval runner refuses real letters by default.
 */
export function createGeminiProvider(options: GeminiProviderOptions = {}): LlmProvider {
  const model = options.model ?? (process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash');
  let client: Promise<GeminiClient> | undefined = options.client
    ? Promise.resolve(options.client)
    : undefined;

  // Loaded on first use so importing this module (e.g. in tests) stays cheap.
  const getClient = () =>
    (client ??= import('@google/genai').then(
      ({ GoogleGenAI }) =>
        new GoogleGenAI({
          apiKey: options.apiKey ?? process.env.GEMINI_API_KEY,
          // Free-tier rate limits are low: retry 429/5xx with backoff.
          httpOptions: { timeout: 120_000, retryOptions: { attempts: 5, initialDelay: 2 } },
        }),
    ));

  return {
    name: 'gemini',
    async complete(request: LlmRequest): Promise<LlmResponse> {
      let response;
      try {
        response = await (
          await getClient()
        ).models.generateContent({
          model,
          contents: request.user,
          config: {
            systemInstruction: request.system,
            maxOutputTokens: request.maxOutputTokens,
            // Deterministic output makes eval runs comparable.
            temperature: request.temperature ?? 0,
            ...(request.responseFormat === 'json' && { responseMimeType: 'application/json' }),
          },
        });
      } catch (error) {
        throw toLlmError(error);
      }

      const candidate = response.candidates?.[0];
      if (!candidate) {
        const blocked = response.promptFeedback?.blockReason;
        throw new LlmError(
          blocked ? 'refused' : 'provider',
          blocked ? `Prompt blocked (${blocked})` : 'Gemini returned no candidates',
        );
      }

      const reason = candidate.finishReason;
      if (reason === 'MAX_TOKENS') {
        throw new LlmError('truncated', `Output hit the token limit (${request.maxOutputTokens})`);
      }
      if (reason && REFUSAL_REASONS.has(reason)) {
        throw new LlmError('refused', `Response blocked (${reason})`);
      }

      // Skip "thought" parts: only the answer counts.
      const text = (candidate.content?.parts ?? [])
        .map((part) => (part.thought ? '' : (part.text ?? '')))
        .join('');

      return {
        text,
        model: response.modelVersion ?? model,
        usage: {
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens:
            (response.usageMetadata?.candidatesTokenCount ?? 0) +
            (response.usageMetadata?.thoughtsTokenCount ?? 0),
        },
      };
    },
  };
}

/**
 * Maps SDK errors to LlmError by shape (ApiError carries an HTTP `status`), so the SDK
 * is not loaded just to classify errors. Never copies the original message, which may
 * echo request content.
 */
export function toLlmError(error: unknown): LlmError {
  if (!(error instanceof Error)) return new LlmError('provider', 'Unexpected Gemini error');
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return new LlmError('timeout', 'Request timed out');
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status !== 'number') {
    return new LlmError('provider', 'Could not reach the Gemini API');
  }
  if (status === 429) return new LlmError('rate_limit', 'Rate limited (HTTP 429)');
  // Gemini reports a bad key as HTTP 400 with reason API_KEY_INVALID.
  if (status === 401 || status === 403 || error.message.includes('API_KEY_INVALID')) {
    return new LlmError('auth', `Authentication failed (HTTP ${status})`);
  }
  if (status === 400 || status === 404) {
    return new LlmError('invalid_request', `Invalid request (HTTP ${status})`);
  }
  return new LlmError('provider', `Gemini API error (HTTP ${status})`);
}
