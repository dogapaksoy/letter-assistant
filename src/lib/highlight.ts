import type { ExtractSuccess } from '../core/api/contract';

type Span = ExtractSuccess['spans'][number];
export type Box = Span['box'];

/**
 * Boxes of the OCR words that overlap the matched text range [start, end) on one page,
 * for drawing the highlight on the photo. Empty if the text has no word positions.
 */
export function boxesForRange(spans: readonly Span[], start: number, end: number, page = 0): Box[] {
  return spans
    .filter((span) => span.page === page && span.start < end && span.end > start)
    .map((span) => span.box);
}
