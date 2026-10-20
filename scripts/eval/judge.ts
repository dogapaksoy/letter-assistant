import { z } from 'zod';

import { firstJsonObject } from '../../src/core/extraction/parse';
import { LlmError, type LlmProvider } from '../../src/core/llm/types';

export interface JudgeItem {
  id: string;
  text: string;
}

export interface JudgeMatch {
  expectedId: string;
  predictedIndex: number | null;
  reason: string;
}

/** A group of expected and predicted items that are matched only with each other. */
export interface JudgeSection {
  name: string;
  /** Section-specific matching rules, passed to the judge with the items. */
  instructions?: string;
  expected: JudgeItem[];
  predicted: string[];
}

const judgeOutputSchema = z.object({
  sections: z.array(
    z.object({
      name: z.string(),
      matches: z.array(
        z.object({
          expected_id: z.string(),
          predicted_index: z.number().int().nullable(),
          reason: z.string(),
        }),
      ),
    }),
  ),
});

const SYSTEM = `You grade an information-extraction system against a hand-written answer key.

You get one or more SECTIONS. Each section has EXPECTED items (from the answer key) and PREDICTED items (from the system). Match items only within the same section, and follow a section's "instructions" when it has them. For each expected item, decide which predicted item, if any, states the same thing. Wording and language may differ; the meaning must match: the same thing to do, and any amount, document, method or condition the expected item names. If nothing matches, use null.

One predicted item may match several expected items when it clearly covers each of them (for example "attend the appointment and bring these documents" covers both "attend the appointment" and "bring the documents").

Calendar dates are scored separately, so do not reject a predicted item only because it omits a calendar date that the expected item mentions. Do reject it if it states a different date, amount or rule.

For rules instead of dates (such as "within 14 days of receipt"), the essential time limit must match (one month, 14 days, three working days before...). Supporting details, such as how the delivery date is calculated, are not required.

Do not reject an item for leaving out a minor detail that does not change what the reader must do. A vaguer item that loses the essential what, how much or under which condition is not a match.

Return ONLY JSON: {"sections": [{"name": string, "matches": [{"expected_id": string, "predicted_index": number | null, "reason": string}]}]} with every section and exactly one entry per expected item. Keep each reason under 20 words.`;

/**
 * LLM-as-judge matching of free-text items, all sections in one call to save quota.
 * Results must be spot-checked by a human (see the judge review file).
 */
export async function judgeSections(
  provider: LlmProvider,
  sections: JudgeSection[],
): Promise<JudgeMatch[][]> {
  const toJudge = sections.filter((s) => s.expected.length > 0 && s.predicted.length > 0);

  let byName = new Map<string, Map<string, { predicted_index: number | null; reason: string }>>();
  if (toJudge.length > 0) {
    const user = JSON.stringify(
      {
        sections: toJudge.map((s) => ({
          name: s.name,
          ...(s.instructions && { instructions: s.instructions }),
          expected: s.expected,
          predicted: s.predicted.map((text, index) => ({ index, text })),
        })),
      },
      null,
      2,
    );
    const response = await provider.complete({
      system: SYSTEM,
      user,
      responseFormat: 'json',
      maxOutputTokens: 8000,
    });

    let parsed;
    try {
      parsed = judgeOutputSchema.parse(JSON.parse(firstJsonObject(response.text) ?? ''));
    } catch {
      throw new LlmError('provider', 'Judge returned output that is not valid judge JSON');
    }
    byName = new Map(
      parsed.sections.map((s) => [s.name, new Map(s.matches.map((m) => [m.expected_id, m]))]),
    );
  }

  return sections.map((section) =>
    section.expected.map((e) => {
      if (section.predicted.length === 0) {
        return { expectedId: e.id, predictedIndex: null, reason: 'nothing predicted' };
      }
      const match = byName.get(section.name)?.get(e.id);
      const index = match?.predicted_index ?? null;
      return {
        expectedId: e.id,
        predictedIndex:
          index !== null && index >= 0 && index < section.predicted.length ? index : null,
        reason: match?.reason ?? 'judge returned no entry',
      };
    }),
  );
}
