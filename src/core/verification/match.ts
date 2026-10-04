import { type NormalizedText, normalizeForMatching } from './normalize';

/** Quotes shorter than this (after normalization) are too weak to count as evidence. */
export const MIN_QUOTE_LENGTH = 6;
/** Below this length only exact matches count: one wrong character changes too much. */
export const FUZZY_MIN_LENGTH = 20;
/** Minimum similarity (1 - edit distance / quote length) for a fuzzy match. */
export const FUZZY_MIN_SIMILARITY = 0.9;

export interface QuoteMatch {
  /** Range in the original letter text; `start` inclusive, `end` exclusive. */
  start: number;
  end: number;
  /** 1 for an exact match after normalization. */
  similarity: number;
  exact: boolean;
}

export type UnverifiedReason = 'empty_quote' | 'too_short' | 'not_found' | 'digits_differ';

export type QuoteVerification =
  { status: 'verified'; match: QuoteMatch } | { status: 'unverified'; reason: UnverifiedReason };

/**
 * Checks whether `quote` appears in the letter, tolerating small OCR/whitespace
 * differences. A fuzzy match is rejected if its digits differ from the quote's: a quote
 * with "26.10.2025" must never be verified by a letter that says "26.10.2026".
 */
export function verifyQuote(quote: string, letter: NormalizedText): QuoteVerification {
  const q = normalizeForMatching(quote).text;

  if (q.length === 0) return { status: 'unverified', reason: 'empty_quote' };
  if (q.length < MIN_QUOTE_LENGTH) return { status: 'unverified', reason: 'too_short' };

  const exactStart = letter.text.indexOf(q);
  if (exactStart !== -1) {
    return verified(letter, exactStart, exactStart + q.length, 1, true);
  }

  if (q.length < FUZZY_MIN_LENGTH) return { status: 'unverified', reason: 'not_found' };

  const best = approximateSearch(q, letter.text);
  const similarity = 1 - best.distance / q.length;
  if (similarity < FUZZY_MIN_SIMILARITY) return { status: 'unverified', reason: 'not_found' };

  if (digitsOf(q) !== digitsOf(letter.text.slice(best.start, best.end))) {
    return { status: 'unverified', reason: 'digits_differ' };
  }

  return verified(letter, best.start, best.end, similarity, false);
}

function verified(
  letter: NormalizedText,
  start: number,
  end: number,
  similarity: number,
  exact: boolean,
): QuoteVerification {
  const originalStart = letter.sourceIndex[start] ?? 0;
  const originalEnd = (letter.sourceIndex[end - 1] ?? originalStart) + 1;
  return {
    status: 'verified',
    match: { start: originalStart, end: originalEnd, similarity, exact },
  };
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, '');
}

/**
 * Best approximate occurrence of `pattern` anywhere in `text` (Sellers' algorithm):
 * Levenshtein distance where the match may start and end at any position of `text`.
 * O(pattern × text) time, O(text) memory.
 */
function approximateSearch(
  pattern: string,
  text: string,
): { start: number; end: number; distance: number } {
  const n = text.length;
  // Row for the previous pattern prefix: edit distance and match start for each text end.
  let prevDist = new Int32Array(n + 1); // Empty pattern matches everywhere at cost 0.
  let prevStart = Int32Array.from({ length: n + 1 }, (_, j) => j);
  let curDist = new Int32Array(n + 1);
  let curStart = new Int32Array(n + 1);

  for (let i = 1; i <= pattern.length; i++) {
    curDist[0] = i;
    curStart[0] = 0;
    const p = pattern.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const substitute = prevDist[j - 1]! + (p === text.charCodeAt(j - 1) ? 0 : 1);
      const skipPatternChar = prevDist[j]! + 1;
      const skipTextChar = curDist[j - 1]! + 1;
      if (substitute <= skipPatternChar && substitute <= skipTextChar) {
        curDist[j] = substitute;
        curStart[j] = prevStart[j - 1]!;
      } else if (skipPatternChar <= skipTextChar) {
        curDist[j] = skipPatternChar;
        curStart[j] = prevStart[j]!;
      } else {
        curDist[j] = skipTextChar;
        curStart[j] = curStart[j - 1]!;
      }
    }
    [prevDist, curDist] = [curDist, prevDist];
    [prevStart, curStart] = [curStart, prevStart];
  }

  let bestEnd = 0;
  for (let j = 1; j <= n; j++) {
    if (prevDist[j]! < prevDist[bestEnd]!) bestEnd = j;
  }
  return { start: prevStart[bestEnd]!, end: bestEnd, distance: prevDist[bestEnd]! };
}
