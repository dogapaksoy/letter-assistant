// How well does quote verification hold up on OCR-like text? No LLM calls.
// Usage: npm run eval:ocr
//
// For each synthetic letter, noise level and seed, the letter gets OCR-style errors and
// every ground-truth quote (clean, as a model that "corrects" OCR errors would write it)
// is verified against the noisy text, together with short quotes (dates and amounts alone). As a safety check, each quote with digits is also
// verified with one digit changed: those must always be rejected.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { MIN_QUOTE_LENGTH, FUZZY_MIN_LENGTH, verifyQuote } from '../../src/core/verification/match';
import { normalizeForMatching } from '../../src/core/verification/normalize';
import { loadEvalCases } from './ground-truth';
import { addOcrNoise, type NoiseLevel } from './ocr-noise';

const LEVELS: (NoiseLevel | 'none')[] = ['none', 'low', 'medium', 'high'];
const SEEDS = [1, 2, 3, 4, 5];

interface Tally {
  quotes: number;
  exact: number;
  fuzzy: number;
  notFound: number;
  digitsDiffer: number;
  tooShort: number;
  shortQuotes: number;
  shortVerified: number;
  mutated: number;
  mutatedAccepted: number;
}

const empty = (): Tally => ({
  quotes: 0,
  exact: 0,
  fuzzy: 0,
  notFound: 0,
  digitsDiffer: 0,
  tooShort: 0,
  shortQuotes: 0,
  shortVerified: 0,
  mutated: 0,
  mutatedAccepted: 0,
});

function collectQuotes(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectQuotes);
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'source_quote' && typeof value === 'string' ? [value] : collectQuotes(value),
  );
}

/** Changes the last digit of a quote (9 -> 0, otherwise +1); null if it has no digit. */
export function mutateLastDigit(quote: string): string | null {
  const match = /\d(?=\D*$)/.exec(quote);
  if (!match) return null;
  const digit = Number(match[0]);
  return quote.slice(0, match.index) + String((digit + 1) % 10) + quote.slice(match.index + 1);
}

function main() {
  const root = join(__dirname, '../..');
  const cases = loadEvalCases(join(root, 'eval'));
  const byLevel = new Map(LEVELS.map((level) => [level, empty()]));

  for (const c of cases) {
    // Ground-truth quotes plus short quotes models often use: dates and amounts alone.
    const shortProbes = c.letterText.match(/\d{2}\.\d{2}\.\d{4}|\d+(?:\.\d{3})*,\d{2} Euro/g) ?? [];
    const quotes = [...new Set([...collectQuotes(c.truth), ...shortProbes])];
    for (const level of LEVELS) {
      const tally = byLevel.get(level)!;
      for (const seed of level === 'none' ? [0] : SEEDS) {
        const text = level === 'none' ? c.letterText : addOcrNoise(c.letterText, level, seed);
        const letter = normalizeForMatching(text);
        for (const quote of quotes) {
          const short = normalizeForMatching(quote).text.length < FUZZY_MIN_LENGTH;
          const result = verifyQuote(quote, letter);
          tally.quotes++;
          if (short) tally.shortQuotes++;
          if (result.status === 'verified') {
            if (result.match.exact) tally.exact++;
            else tally.fuzzy++;
            if (short) tally.shortVerified++;
          } else if (result.reason === 'not_found') tally.notFound++;
          else if (result.reason === 'digits_differ') tally.digitsDiffer++;
          else tally.tooShort++;

          const mutated = mutateLastDigit(quote);
          if (mutated && normalizeForMatching(mutated).text.length >= MIN_QUOTE_LENGTH) {
            tally.mutated++;
            if (verifyQuote(mutated, letter).status === 'verified') tally.mutatedAccepted++;
          }
        }
      }
    }
  }

  const pct = (n: number, d: number) => (d === 0 ? '-' : `${((100 * n) / d).toFixed(1)}%`);
  console.table(
    LEVELS.map((level) => {
      const t = byLevel.get(level)!;
      return {
        noise: level,
        verified: pct(t.exact + t.fuzzy, t.quotes),
        exact: pct(t.exact, t.quotes),
        fuzzy: pct(t.fuzzy, t.quotes),
        'not found': t.notFound,
        'digits differ': t.digitsDiffer,
        'short quotes verified': pct(t.shortVerified, t.shortQuotes),
        'wrong-digit quotes accepted': `${t.mutatedAccepted}/${t.mutated}`,
      };
    }),
  );

  const outDir = join(root, 'eval', 'results');
  mkdirSync(outDir, { recursive: true });
  const file = join(
    outDir,
    `ocr-robustness-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
  );
  writeFileSync(file, JSON.stringify(Object.fromEntries(byLevel), null, 2));
  console.log(`Saved ${file}`);
}

if (require.main === module) main();
