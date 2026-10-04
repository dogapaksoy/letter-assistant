import { z } from 'zod';

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

const judgeOutputSchema = z.object({
  matches: z.array(
    z.object({
      expected_id: z.string(),
      predicted_index: z.number().int().nullable(),
      reason: z.string(),
    }),
  ),
});

const SYSTEM = `You grade an information-extraction system against a hand-written answer key.

You get EXPECTED items (from the answer key) and PREDICTED items (from the system). For each expected item, decide which predicted item, if any, states the same thing. Wording and language may differ; the meaning must match, including any concrete amount, date, document or condition. A predicted item may match at most one expected item. If nothing matches, use null. Be strict: a vaguer or partly wrong item is not a match.

Return ONLY JSON: {"matches": [{"expected_id": string, "predicted_index": number | null, "reason": string}]} with exactly one entry per expected item. Keep each reason under 20 words.`;

/** LLM-as-judge matching of free-text items. Results must be spot-checked by a human. */
export async function judgeMatches(
  provider: LlmProvider,
  expected: JudgeItem[],
  predicted: string[],
): Promise<JudgeMatch[]> {
  if (expected.length === 0) return [];
  if (predicted.length === 0) {
    return expected.map((e) => ({
      expectedId: e.id,
      predictedIndex: null,
      reason: 'nothing predicted',
    }));
  }

  const user = JSON.stringify(
    {
      expected: expected.map((e) => ({ id: e.id, text: e.text })),
      predicted: predicted.map((text, index) => ({ index, text })),
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
    parsed = judgeOutputSchema.parse(
      JSON.parse(response.text.replace(/^\s*```(?:json)?|```\s*$/g, '')),
    );
  } catch {
    throw new LlmError('provider', 'Judge returned output that is not valid judge JSON');
  }

  const byId = new Map(parsed.matches.map((m) => [m.expected_id, m]));
  return expected.map((e) => {
    const match = byId.get(e.id);
    const index = match?.predicted_index ?? null;
    return {
      expectedId: e.id,
      predictedIndex: index !== null && index >= 0 && index < predicted.length ? index : null,
      reason: match?.reason ?? 'judge returned no entry',
    };
  });
}
