import { z } from 'zod';

import { actionSchema, deadlineSchema, summaryPointSchema } from '../extraction/schema';

/**
 * Contract between the app and the `extract-letter` edge function. Both sides validate
 * with these schemas, so a malformed request or response is rejected instead of crashing.
 */

/** ~7.5 MB of binary data. Phone photos should be resized by the picker before upload. */
export const MAX_BASE64_LENGTH = 10_000_000;
export const MAX_TEXT_LENGTH = 50_000;

export const outputLanguageSchema = z.enum(['tr', 'en']);

export const extractRequestSchema = z.object({
  language: outputLanguageSchema,
  document: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('pdf'), base64: z.string().min(1).max(MAX_BASE64_LENGTH) }),
    z.object({
      kind: z.literal('image'),
      base64: z.string().min(1).max(MAX_BASE64_LENGTH),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/heic']),
    }),
    z.object({ kind: z.literal('text'), text: z.string().min(1).max(MAX_TEXT_LENGTH) }),
  ]),
});

export type ExtractRequest = z.infer<typeof extractRequestSchema>;

export const extractErrorCodeSchema = z.enum([
  'invalid_request',
  'unreadable_document',
  'ocr_not_configured',
  'extraction_failed',
  'service_unavailable',
  'not_configured',
]);

export type ExtractErrorCode = z.infer<typeof extractErrorCodeSchema>;

const verificationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('verified'),
    match: z.object({
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
      similarity: z.number(),
      exact: z.boolean(),
    }),
  }),
  z.object({
    status: z.literal('unverified'),
    reason: z.enum(['empty_quote', 'too_short', 'not_found', 'digits_differ']),
  }),
]);

const withVerification = <S extends z.ZodObject>(schema: S) =>
  schema.extend({ verification: verificationSchema });

export const extractSuccessSchema = z.object({
  ok: z.literal(true),
  /** The text the LLM saw and quotes were verified against. Kept in memory only. */
  letterText: z.string(),
  textMethod: z.enum(['text', 'pdf-text-layer', 'ocr']),
  extraction: z.object({
    summary: z.array(withVerification(summaryPointSchema)),
    // deadlineSchema has a refinement, so extend its shape rather than the refined schema.
    deadlines: z.array(z.object({ ...deadlineSchema.shape, verification: verificationSchema })),
    actions: z.array(withVerification(actionSchema)),
  }),
  dropped: z.object({ summary: z.number(), deadlines: z.number(), actions: z.number() }),
  model: z.string(),
  promptVersion: z.string(),
  /** True when the server only accepts synthetic test letters (free-tier LLM). */
  devMode: z.boolean(),
});

export const extractResponseSchema = z.discriminatedUnion('ok', [
  extractSuccessSchema,
  z.object({ ok: z.literal(false), error: extractErrorCodeSchema }),
]);

export type ExtractSuccess = z.infer<typeof extractSuccessSchema>;
export type ExtractResponse = z.infer<typeof extractResponseSchema>;
