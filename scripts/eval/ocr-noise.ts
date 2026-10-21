/**
 * Deterministic OCR-style noise for robustness tests of quote verification. It simulates
 * errors typical of phone photos of printed German letters: character confusions, lost
 * umlauts, words hyphenated at random line breaks, and doubled or missing spaces.
 */

export type NoiseLevel = 'low' | 'medium' | 'high';

/** Probability that an eligible spot gets an error, per level. */
const RATES: Record<NoiseLevel, number> = { low: 0.01, medium: 0.03, high: 0.07 };

/** Confusions OCR engines commonly make with Latin print. */
const CONFUSIONS: [string, string][] = [
  ['rn', 'm'],
  ['m', 'rn'],
  ['l', 'I'],
  ['I', 'l'],
  ['i', 'l'],
  ['O', '0'],
  ['0', 'O'],
  ['1', 'l'],
  ['5', 'S'],
  ['ä', 'a'],
  ['ö', 'o'],
  ['ü', 'u'],
  ['ß', 'B'],
  ['e', 'c'],
  ['c', 'e'],
  [',', '.'],
];

/** Small seeded PRNG (mulberry32) so every run produces the same noisy letters. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addOcrNoise(text: string, level: NoiseLevel, seed: number): string {
  const random = seededRandom(seed);
  const rate = RATES[level];
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (random() < rate) {
      const confusion = CONFUSIONS.find(([from]) => text.startsWith(from, i));
      if (confusion) {
        out += confusion[1];
        i += confusion[0].length;
        continue;
      }
    }
    const ch = text.charAt(i);
    // Break a long word across lines with a hyphen, as narrow columns do.
    if (/\p{L}/u.test(ch) && /\p{L}{3}/u.test(text.slice(i + 1, i + 4)) && random() < rate / 2) {
      out += `${ch}-\n`;
      i++;
      continue;
    }
    if (ch === ' ' && random() < rate / 2) {
      out += random() < 0.5 ? '' : '  ';
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}
