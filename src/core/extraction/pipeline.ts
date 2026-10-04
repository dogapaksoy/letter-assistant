import { LlmError, type LlmProvider } from '../llm/types';
import { type VerifiedExtraction, verifyExtraction } from '../verification/verify';
import { type DroppedItems, parseExtraction } from './parse';
import {
  buildExtractionSystemPrompt,
  buildExtractionUserMessage,
  type OutputLanguage,
  PROMPT_VERSION,
} from './prompt';

export type ExtractionOutcome =
  | {
      ok: true;
      extraction: VerifiedExtraction;
      dropped: DroppedItems;
      model: string;
      promptVersion: string;
    }
  | {
      ok: false;
      error: 'invalid_json' | 'invalid_shape' | `llm_${LlmError['kind']}`;
      promptVersion: string;
    };

/** Letter text -> LLM -> validated and source-verified items. Never throws. */
export async function extractFromLetter(params: {
  provider: LlmProvider;
  letterText: string;
  language: OutputLanguage;
  maxOutputTokens?: number;
}): Promise<ExtractionOutcome> {
  const promptVersion = PROMPT_VERSION;

  let response;
  try {
    response = await params.provider.complete({
      system: buildExtractionSystemPrompt(params.language),
      user: buildExtractionUserMessage(params.letterText),
      responseFormat: 'json',
      maxOutputTokens: params.maxOutputTokens ?? 16000,
    });
  } catch (error) {
    const kind = error instanceof LlmError ? error.kind : 'provider';
    return { ok: false, error: `llm_${kind}`, promptVersion };
  }

  const parsed = parseExtraction(response.text);
  if (!parsed.ok) return { ok: false, error: parsed.error, promptVersion };

  return {
    ok: true,
    extraction: verifyExtraction(parsed.extraction, params.letterText),
    dropped: parsed.dropped,
    model: response.model,
    promptVersion,
  };
}
