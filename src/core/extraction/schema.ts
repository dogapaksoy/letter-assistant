import { z } from 'zod';

/**
 * Shape of the LLM's extraction output. Every item is grounded: it carries the exact
 * letter text it is based on (`source_quote`), which code verifies afterwards.
 */

export const confidenceSchema = z.enum(['high', 'medium', 'low']);

const groundedItem = {
  /** The extracted information, in the user's output language. */
  value: z.string().trim().min(1),
  /** Exact text from the letter this item is based on. */
  source_quote: z.string(),
  confidence: confidenceSchema,
};

export const summaryPointSchema = z.object(groundedItem);

export const deadlineSchema = z
  .object({
    ...groundedItem,
    kind: z.enum(['due_date', 'appointment', 'expiry', 'recurring', 'relative']),
    /** ISO date. `null` only for `relative` deadlines, where the letter gives no fixed date. */
    date: z.iso.date().nullable(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .nullable()
      .optional(),
  })
  // A relative deadline ("within 14 days of receipt") must not come with a computed date:
  // that would present a guess as certain. Every other kind needs a date.
  .refine((deadline) => (deadline.kind === 'relative') === (deadline.date === null));

export const actionSchema = z.object({
  ...groundedItem,
  type: z.enum(['required', 'conditional', 'optional']),
  condition: z.string().nullable().optional(),
});

export type Confidence = z.infer<typeof confidenceSchema>;
export type SummaryPoint = z.infer<typeof summaryPointSchema>;
export type Deadline = z.infer<typeof deadlineSchema>;
export type Action = z.infer<typeof actionSchema>;

export interface Extraction {
  summary: SummaryPoint[];
  deadlines: Deadline[];
  actions: Action[];
}
