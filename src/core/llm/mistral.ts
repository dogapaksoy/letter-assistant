import type { Mistral } from '@mistralai/mistralai';

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from './types';

/** The part of the SDK client this adapter uses. */
export interface MistralClient {
  chat: Pick<Mistral['chat'], 'complete'>;
}

export interface MistralProviderOptions {
  /** Defaults to a client created from MISTRAL_API_KEY. Injected in tests. */
  client?: MistralClient;
  apiKey?: string;
  model?: string;
}

/**
 * Mistral adapter. The free "Experiment" plan may use submitted data for training, so it
 * must only ever see SYNTHETIC letters. Real letters need a paid plan configured for no
 * training (CLAUDE.md privacy rules); the eval runner refuses them by default.
 */
export function createMistralProvider(options: MistralProviderOptions = {}): LlmProvider {
  const model = options.model ?? 'mistral-large-latest';
  let client: Promise<MistralClient> | undefined = options.client
    ? Promise.resolve(options.client)
    : undefined;

  // The SDK is ESM-only; load it on first use so importing this module stays cheap.
  const getClient = () =>
    (client ??= import('@mistralai/mistralai').then(
      ({ Mistral }) =>
        new Mistral({
          apiKey: options.apiKey ?? process.env.MISTRAL_API_KEY,
          timeoutMs: 120_000,
          // Free-tier rate limits are low: back off and retry on 429/5xx and network errors.
          retryConfig: {
            strategy: 'backoff',
            backoff: {
              initialInterval: 2_000,
              maxInterval: 30_000,
              exponent: 1.5,
              maxElapsedTime: 180_000,
            },
            retryConnectionErrors: true,
          },
        }),
    ));

  return {
    name: 'mistral',
    async complete(request: LlmRequest): Promise<LlmResponse> {
      let response;
      try {
        response = await (
          await getClient()
        ).chat.complete({
          model,
          maxTokens: request.maxOutputTokens,
          // Deterministic output makes eval runs comparable.
          temperature: request.temperature ?? 0,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user },
          ],
          ...(request.responseFormat === 'json' && { responseFormat: { type: 'json_object' } }),
        });
      } catch (error) {
        throw toLlmError(error);
      }

      const choice = response.choices[0];
      if (!choice) throw new LlmError('provider', 'Mistral returned no choices');
      if (choice.finishReason === 'length' || choice.finishReason === 'model_length') {
        throw new LlmError('truncated', `Output hit the token limit (${request.maxOutputTokens})`);
      }
      if (choice.finishReason === 'error') {
        throw new LlmError('provider', 'Mistral reported an error while generating');
      }

      const content = choice.message?.content;
      const text =
        typeof content === 'string'
          ? content
          : (content ?? []).map((chunk) => (chunk.type === 'text' ? chunk.text : '')).join('');

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage.promptTokens ?? 0,
          outputTokens: response.usage.completionTokens ?? 0,
        },
      };
    },
  };
}

/**
 * Maps Mistral SDK errors to LlmError without importing the ESM-only SDK: HTTP errors
 * carry `statusCode`, client-side errors a fixed `name`. Messages never include the
 * original error text, which may echo request content.
 */
export function toLlmError(error: unknown): LlmError {
  if (!(error instanceof Error)) return new LlmError('provider', 'Unexpected Mistral error');
  if (error.name === 'RequestTimeoutError') return new LlmError('timeout', 'Request timed out');
  if (error.name === 'ConnectionError') {
    return new LlmError('provider', 'Could not connect to the Mistral API');
  }

  const status = (error as { statusCode?: unknown }).statusCode;
  if (typeof status !== 'number') return new LlmError('provider', 'Unexpected Mistral error');
  if (status === 429) return new LlmError('rate_limit', 'Rate limited (HTTP 429)');
  if (status === 401 || status === 403) {
    return new LlmError('auth', `Authentication failed (HTTP ${status})`);
  }
  if (status === 400 || status === 404 || status === 422) {
    return new LlmError('invalid_request', `Invalid request (HTTP ${status})`);
  }
  return new LlmError('provider', `Mistral API error (HTTP ${status})`);
}
