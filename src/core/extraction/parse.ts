import { z } from 'zod';

import { actionSchema, deadlineSchema, type Extraction, summaryPointSchema } from './schema';

/** Number of items per section that failed validation and were left out. */
export interface DroppedItems {
  summary: number;
  deadlines: number;
  actions: number;
}

/**
 * Error codes only: results may be logged, so they must never contain model output
 * (which can quote personal data from the letter).
 */
export type ParseResult =
  | { ok: true; extraction: Extraction; dropped: DroppedItems }
  | { ok: false; error: 'invalid_json' | 'invalid_shape' };

const envelopeSchema = z.object({
  summary: z.array(z.unknown()),
  deadlines: z.array(z.unknown()),
  actions: z.array(z.unknown()),
});

const CODE_FENCE = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i;

/**
 * Parses raw LLM output. Never throws. Invalid items are dropped one by one instead of
 * discarding the whole result, and the drop counts are returned so the UI can say that
 * part of the letter could not be read.
 */
export function parseExtraction(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(raw.replace(CODE_FENCE, '$1'));
  } catch {
    return { ok: false, error: 'invalid_json' };
  }

  const envelope = envelopeSchema.safeParse(json);
  if (!envelope.success) {
    return { ok: false, error: 'invalid_shape' };
  }

  const summary = keepValid(envelope.data.summary, summaryPointSchema);
  const deadlines = keepValid(envelope.data.deadlines, deadlineSchema);
  const actions = keepValid(envelope.data.actions, actionSchema);

  return {
    ok: true,
    extraction: { summary: summary.valid, deadlines: deadlines.valid, actions: actions.valid },
    dropped: { summary: summary.dropped, deadlines: deadlines.dropped, actions: actions.dropped },
  };
}

function keepValid<S extends z.ZodType>(
  items: unknown[],
  schema: S,
): { valid: z.output<S>[]; dropped: number } {
  const valid: z.output<S>[] = [];
  for (const item of items) {
    const result = schema.safeParse(item);
    if (result.success) {
      valid.push(result.data);
    }
  }
  return { valid, dropped: items.length - valid.length };
}
