/**
 * Provider-agnostic LLM adapter.
 *
 * Adapters only move text in and out. Prompt building, JSON parsing, schema
 * validation and source verification live in core code, so switching providers
 * never changes how output is checked.
 */

export interface LlmRequest {
  system: string;
  /** Contains letter text. Adapters must never log it. */
  user: string;
  /** Ask for JSON-only output where the provider supports it. Output is still validated with Zod. */
  responseFormat: 'json' | 'text';
  maxOutputTokens: number;
  temperature?: number;
}

export interface LlmResponse {
  /** Raw model output; parsed and validated by the caller. */
  text: string;
  /** Exact model identifier that produced the output, recorded in eval results. */
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
}

export type LlmErrorKind =
  | 'timeout'
  | 'rate_limit'
  | 'auth'
  | 'invalid_request'
  /** The model declined the request (e.g. a safety refusal). */
  | 'refused'
  /** Output hit the token limit, so it is incomplete. */
  | 'truncated'
  | 'provider';

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmProvider {
  readonly name: string;
  /** Rejects with `LlmError` on failure. */
  complete(request: LlmRequest): Promise<LlmResponse>;
}
