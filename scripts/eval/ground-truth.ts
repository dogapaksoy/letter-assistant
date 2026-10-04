import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

const bilingual = z.object({ en: z.string(), tr: z.string() });

const groundTruthSchema = z.object({
  synthetic: z.boolean(),
  id: z.string(),
  letter_file: z.string(),
  deadlines: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['due_date', 'appointment', 'expiry', 'recurring', 'relative']),
      date: z.string().nullable(),
      description: bilingual,
      source_quote: z.string(),
    }),
  ),
  actions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['required', 'conditional', 'optional']),
      description: bilingual,
      condition: bilingual.optional(),
      source_quote: z.string(),
    }),
  ),
  non_deadline_dates: z.array(z.object({ date: z.string(), reason: z.string() })),
});

export type GroundTruth = z.infer<typeof groundTruthSchema>;

export interface EvalCase {
  truth: GroundTruth;
  /** Letter text with the front matter (synthetic notice) removed. */
  letterText: string;
}

const FRONT_MATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

export function loadEvalCases(evalDir: string): EvalCase[] {
  const truthDir = join(evalDir, 'ground-truth');
  return readdirSync(truthDir)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const truth = groundTruthSchema.parse(JSON.parse(readFileSync(join(truthDir, file), 'utf8')));
      const raw = readFileSync(join(evalDir, truth.letter_file), 'utf8');
      return { truth, letterText: raw.replace(FRONT_MATTER, '') };
    });
}
