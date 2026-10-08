import Anthropic from '@anthropic-ai/sdk';

import {
  type ExtractErrorCode,
  type ExtractResponse,
  extractRequestSchema,
} from '../core/api/contract';
import { extractFromLetter } from '../core/extraction/pipeline';
import { createAnthropicProvider } from '../core/llm/anthropic';
import { createGeminiProvider } from '../core/llm/gemini';
import { createMistralProvider } from '../core/llm/mistral';
import type { LlmProvider } from '../core/llm/types';
import { createPdfTextExtractor } from '../core/text-extraction/pdf';
import { createDocumentTextExtractor, TextExtractionError } from '../core/text-extraction/router';
import type { DocumentInput, TextExtractor } from '../core/text-extraction/types';

/**
 * The extract-letter edge function, written against web-standard Request/Response so
 * it runs in Supabase (Deno) and in Jest. Privacy: nothing here logs or stores the
 * document, its text or the extraction (CLAUDE.md). The request body only lives for
 * the duration of the request.
 */

export interface ServerDeps {
  provider: LlmProvider;
  textExtractor: TextExtractor;
  /**
   * 'dev-synthetic-only': the LLM configuration is not approved for personal data
   * (e.g. a free tier that may train on inputs). The app warns users to upload only
   * test letters. 'production': EU, no-training configuration, approved by the owner.
   */
  mode: 'dev-synthetic-only' | 'production';
}

export type Env = Record<string, string | undefined>;

/** Builds dependencies from environment variables; returns null if not configured. */
export function depsFromEnv(env: Env): ServerDeps | null {
  const mode =
    env.LLM_APPROVED_FOR_PERSONAL_DATA === 'true'
      ? 'production'
      : env.DEV_MODE_SYNTHETIC_ONLY === 'true'
        ? 'dev-synthetic-only'
        : null;
  if (!mode) return null;

  const provider = providerFromEnv(env);
  if (!provider) return null;

  return {
    provider,
    // OCR is added here once a provider is chosen; until then photos are rejected.
    textExtractor: createDocumentTextExtractor({ pdf: createPdfTextExtractor() }),
    mode,
  };
}

function providerFromEnv(env: Env): LlmProvider | null {
  switch (env.LLM_PROVIDER) {
    case 'gemini':
      return env.GEMINI_API_KEY
        ? createGeminiProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL || undefined })
        : null;
    case 'mistral':
      return env.MISTRAL_API_KEY
        ? createMistralProvider({
            apiKey: env.MISTRAL_API_KEY,
            model: env.MISTRAL_MODEL || undefined,
          })
        : null;
    case 'anthropic':
      return env.ANTHROPIC_API_KEY
        ? createAnthropicProvider({
            client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
            model: env.ANTHROPIC_MODEL || undefined,
          })
        : null;
    default:
      return null;
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STATUS: Record<ExtractErrorCode, number> = {
  invalid_request: 400,
  unreadable_document: 422,
  ocr_not_configured: 501,
  extraction_failed: 502,
  service_unavailable: 503,
  not_configured: 503,
};

function json(body: ExtractResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const fail = (error: ExtractErrorCode) => json({ ok: false, error }, STATUS[error]);

export function createRequestHandler(getDeps: () => ServerDeps | null) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
    if (request.method !== 'POST') return fail('invalid_request');

    const deps = getDeps();
    if (!deps) return fail('not_configured');

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail('invalid_request');
    }
    const parsed = extractRequestSchema.safeParse(body);
    if (!parsed.success) return fail('invalid_request');
    const { language, document } = parsed.data;

    let letterText: string;
    let textMethod: 'text' | 'pdf-text-layer' | 'ocr';
    if (document.kind === 'text') {
      letterText = document.text;
      textMethod = 'text';
    } else {
      let input: DocumentInput;
      try {
        input =
          document.kind === 'pdf'
            ? { kind: 'pdf', bytes: fromBase64(document.base64) }
            : { kind: 'image', bytes: fromBase64(document.base64), mimeType: document.mimeType };
      } catch {
        return fail('invalid_request');
      }
      try {
        const extracted = await deps.textExtractor.extract(input);
        letterText = extracted.text;
        textMethod = extracted.method;
      } catch (error) {
        if (error instanceof TextExtractionError && error.kind === 'ocr_not_configured') {
          return fail('ocr_not_configured');
        }
        return fail('unreadable_document');
      }
    }

    const outcome = await extractFromLetter({ provider: deps.provider, letterText, language });
    if (!outcome.ok) {
      const temporary = ['llm_timeout', 'llm_rate_limit', 'llm_provider'].includes(outcome.error);
      return fail(temporary ? 'service_unavailable' : 'extraction_failed');
    }

    return json({
      ok: true,
      letterText,
      textMethod,
      extraction: outcome.extraction,
      dropped: outcome.dropped,
      model: outcome.model,
      promptVersion: outcome.promptVersion,
      devMode: deps.mode === 'dev-synthetic-only',
    });
  };
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
