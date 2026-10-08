import type { QuoteVerification } from '../core/verification/match';
import type { Confidence, Deadline } from '../core/extraction/schema';
import type { OutputLanguage } from '../core/extraction/prompt';

export const ERROR_CATEGORIES = [
  'wrong_date',
  'wrong_amount',
  'not_in_letter',
  'wrong_meaning',
  'missing_detail',
  'other',
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];
export type ItemKind = 'summary' | 'deadline' | 'action';

/** Row for public.correction_reports: categories and metadata only, never content. */
export interface CorrectionReport {
  item_kind: ItemKind;
  error_category: ErrorCategory;
  deadline_kind: Deadline['kind'] | null;
  confidence: Confidence;
  verification_status: QuoteVerification['status'];
  language: OutputLanguage;
  prompt_version: string;
  model: string;
}

const PROMPT_VERSION = /^[a-z0-9.-]{1,40}$/;
const MODEL = /^[A-Za-z0-9._/:-]{1,80}$/;

export function buildCorrectionReport(params: {
  itemKind: ItemKind;
  item: { confidence: Confidence; verification: QuoteVerification; kind?: Deadline['kind'] };
  category: ErrorCategory;
  language: OutputLanguage;
  promptVersion: string;
  model: string;
}): CorrectionReport {
  return {
    item_kind: params.itemKind,
    error_category: params.category,
    deadline_kind: params.itemKind === 'deadline' ? (params.item.kind ?? 'due_date') : null,
    confidence: params.item.confidence,
    verification_status: params.item.verification.status,
    language: params.language,
    // Same constraints as the database; anything unexpected becomes "unknown".
    prompt_version: PROMPT_VERSION.test(params.promptVersion) ? params.promptVersion : 'unknown',
    model: MODEL.test(params.model) ? params.model : 'unknown',
  };
}

export type ReportInsert = (report: CorrectionReport) => Promise<{ error: unknown }>;

/** Sends a report; returns false on failure (the local correction is kept either way). */
export async function submitCorrectionReport(
  report: CorrectionReport,
  insert?: ReportInsert,
): Promise<boolean> {
  try {
    const doInsert =
      insert ??
      (async (row: CorrectionReport) => {
        const { getSupabase } = await import('./supabase/client');
        return getSupabase().from('correction_reports').insert(row);
      });
    const { error } = await doInsert(report);
    return !error;
  } catch {
    return false;
  }
}
