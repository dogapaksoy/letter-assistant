/**
 * Normalization used only to match quotes against letter text; never shown to users.
 *
 * Both the quote and the letter go through the same function, so differences that OCR or
 * the LLM commonly introduce disappear: whitespace and line breaks, quote and dash styles,
 * letter case, diacritics (ä/a, ş/s), ß/ss and words hyphenated across a line break.
 *
 * Each normalized character remembers the index of the original character it came from,
 * so a match can be mapped back to the original text (and from there to OCR spans).
 */
export interface NormalizedText {
  text: string;
  /** `sourceIndex[i]` is the index in the original text of normalized character `i`. */
  sourceIndex: number[];
}

const QUOTE_CHARS = /["'`«´»‘-‟‹›]/;
const DASH_CHARS = /[‐-―−]/;
const INVISIBLE_CHARS = /[­​-‍⁠﻿]/;
const COMBINING_MARKS = /[̀-ͯ]/g;
const HORIZONTAL_SPACE = /[ \t\r ]/;

export function normalizeForMatching(input: string): NormalizedText {
  let text = '';
  const sourceIndex: number[] = [];

  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);

    if (INVISIBLE_CHARS.test(ch)) continue;

    if (ch === '-' || DASH_CHARS.test(ch)) {
      const next = skipLineBreak(input, i + 1);
      if (next !== null) {
        // Word split across lines: "Aufenthalts-\ntitel" -> "aufenthaltstitel". Keep the
        // hyphen when the next part is capitalized, as in a real compound ("Yılmaz-\nDeneme").
        if (!/\p{Ll}/u.test(input.charAt(next))) {
          text += '-';
          sourceIndex.push(i);
        }
        i = next - 1;
        continue;
      }
    }

    if (/\s/.test(ch)) {
      if (text.length > 0 && !text.endsWith(' ')) {
        text += ' ';
        sourceIndex.push(i);
      }
      continue;
    }

    for (const folded of foldChar(ch)) {
      text += folded;
      sourceIndex.push(i);
    }
  }

  if (text.endsWith(' ')) {
    text = text.slice(0, -1);
    sourceIndex.pop();
  }

  return { text, sourceIndex };
}

/** If a line break follows `from` (optionally surrounded by spaces), returns the index after it. */
function skipLineBreak(input: string, from: number): number | null {
  let k = from;
  while (k < input.length && HORIZONTAL_SPACE.test(input.charAt(k))) k++;
  if (input.charAt(k) !== '\n') return null;
  k++;
  while (k < input.length && HORIZONTAL_SPACE.test(input.charAt(k))) k++;
  return k;
}

function foldChar(ch: string): string {
  if (QUOTE_CHARS.test(ch)) return '"';
  if (DASH_CHARS.test(ch)) return '-';
  if (ch === 'ß' || ch === 'ẞ') return 'ss';
  if (ch === 'ı') return 'i';
  return ch.normalize('NFKD').replace(COMBINING_MARKS, '').toLowerCase();
}
