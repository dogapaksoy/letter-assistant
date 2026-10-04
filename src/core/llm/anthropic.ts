import Anthropic from '@anthropic-ai/sdk';

import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from './types';

export interface AnthropicProviderOptions {
  /** Defaults to `new Anthropic()`, which reads ANTHROPIC_API_KEY from the environment. */
  client?: Anthropic;
  model?: string;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/**
 * Anthropic adapter. For development with SYNTHETIC letters only, until an EU-compliant
 * provider configuration is chosen for real data (see CLAUDE.md, privacy rules).
 *
 * `temperature` is not sent: current Claude models reject sampling parameters.
 * Server-side fallbacks are enabled, so a refused request may be answered by another
 * model; `LlmResponse.model` always reports which model actually answered.
 */
export function createAnthropicProvider(options: AnthropicProviderOptions = {}): LlmProvider {
  const client = options.client ?? new Anthropic();
  const model = options.model ?? 'claude-opus-5-5';
  // Extraction errors have real consequences; Opus 5.5 would default to "medium".
  const effort = options.effort ?? 'high';

  return {
    name: 'anthropic',
    async complete(request: LlmRequest): Promise<LlmResponse> {
      let response: Anthropic.Beta.BetaMessage;
      try {
        response = await client.beta.messages.create({
          model,
          max_tokens: request.maxOutputTokens,
          system: request.system,
          messages: [{ role: 'user', content: request.user }],
          output_config: { effort },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        });
      } catch (error) {
        throw toLlmError(error);
      }

      if (response.stop_reason === 'refusal') {
        throw new LlmError('refused', `Request refused (category: ${refusalCategory(response)})`);
      }
      if (response.stop_reason === 'max_tokens') {
        throw new LlmError('truncated', `Output hit max_tokens (${request.maxOutputTokens})`);
      }

      const text = response.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('');

      return {
        text,
        model: response.model,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    },
  };
}

function refusalCategory(response: Anthropic.Beta.BetaMessage): string {
  return response.stop_details?.category ?? 'unknown';
}

/** Maps SDK errors to LlmError. Messages carry status codes only, never request content. */
export function toLlmError(error: unknown): LlmError {
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new LlmError('timeout', 'Request timed out');
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new LlmError('provider', 'Could not connect to the Anthropic API');
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new LlmError('rate_limit', 'Rate limited (HTTP 429)');
  }
  if (
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return new LlmError('auth', `Authentication failed (HTTP ${error.status})`);
  }
  if (
    error instanceof Anthropic.BadRequestError ||
    error instanceof Anthropic.NotFoundError ||
    error instanceof Anthropic.UnprocessableEntityError
  ) {
    return new LlmError('invalid_request', `Invalid request (HTTP ${error.status})`);
  }
  if (error instanceof Anthropic.APIError) {
    return new LlmError('provider', `Anthropic API error (HTTP ${error.status ?? 'unknown'})`);
  }
  return new LlmError('provider', 'Unexpected error calling the Anthropic API');
}
