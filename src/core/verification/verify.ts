import type { Action, Deadline, Extraction, SummaryPoint } from '../extraction/schema';
import { type QuoteVerification, verifyQuote } from './match';
import { normalizeForMatching } from './normalize';

export type Verified<T> = T & { verification: QuoteVerification };

export interface VerifiedExtraction {
  summary: Verified<SummaryPoint>[];
  deadlines: Verified<Deadline>[];
  actions: Verified<Action>[];
}

/**
 * Attaches a verification result to every extracted item by checking its `source_quote`
 * against the letter text (the OCR / PDF text the LLM received). Pure function.
 */
export function verifyExtraction(extraction: Extraction, letterText: string): VerifiedExtraction {
  const letter = normalizeForMatching(letterText);
  const withVerification = <T extends { source_quote: string }>(item: T): Verified<T> => ({
    ...item,
    verification: verifyQuote(item.source_quote, letter),
  });

  return {
    summary: extraction.summary.map(withVerification),
    deadlines: extraction.deadlines.map(withVerification),
    actions: extraction.actions.map(withVerification),
  };
}
