import { type QuoteVerification, verifyQuote } from './match';
import { normalizeForMatching } from './normalize';

const LETTER = [
  'Abrechnung',
  'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026. Geben Sie bei der',
  'Überweisung bitte Ihre Steuernummer an.',
  '',
  'Die erste Vorauszahlung ist am 10.12.2026 fällig.',
].join('\n');

const letter = normalizeForMatching(LETTER);

function matchedText(result: QuoteVerification): string {
  if (result.status !== 'verified') throw new Error(`expected verified, got ${result.reason}`);
  return LETTER.slice(result.match.start, result.match.end);
}

describe('verifyQuote', () => {
  it('verifies an exact quote and returns its range in the original text', () => {
    const result = verifyQuote('Die erste Vorauszahlung ist am 10.12.2026 fällig.', letter);
    expect(result).toMatchObject({ status: 'verified', match: { exact: true, similarity: 1 } });
    expect(matchedText(result)).toBe('Die erste Vorauszahlung ist am 10.12.2026 fällig.');
  });

  it('verifies a quote that spans a line break in the letter', () => {
    const result = verifyQuote('Geben Sie bei der Überweisung bitte Ihre Steuernummer an.', letter);
    expect(result).toMatchObject({ status: 'verified', match: { exact: true } });
    expect(matchedText(result)).toBe('Geben Sie bei der\nÜberweisung bitte Ihre Steuernummer an.');
  });

  it('ignores case, typographic quotes and missing umlauts', () => {
    const result = verifyQuote('die erste vorauszahlung ist am 10.12.2026 FALLIG.', letter);
    expect(result).toMatchObject({ status: 'verified', match: { exact: true } });
  });

  it('verifies a long quote with small OCR errors as a fuzzy match', () => {
    const result = verifyQuote(
      'Bitte zahIen Sie den Betraq von 412,00 Euro spätestens am 26.10.2026.',
      letter,
    );
    expect(result).toMatchObject({ status: 'verified', match: { exact: false } });
    if (result.status === 'verified') {
      expect(result.match.similarity).toBeGreaterThanOrEqual(0.9);
      expect(result.match.similarity).toBeLessThan(1);
    }
    expect(matchedText(result)).toContain('412,00 Euro spätestens am 26.10.2026');
  });

  it('rejects OCR confusions that change digits (deliberately conservative)', () => {
    // "Euro" read as "Eur0" adds a digit. Treating it as unverified costs a warning;
    // accepting digit changes could verify a wrong date or amount.
    const result = verifyQuote(
      'Bitte zahlen Sie den Betrag von 412,00 Eur0 spätestens am 26.10.2026.',
      letter,
    );
    expect(result).toEqual({ status: 'unverified', reason: 'digits_differ' });
  });

  it('rejects a near-identical quote whose date differs', () => {
    const result = verifyQuote(
      'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2025.',
      letter,
    );
    expect(result).toEqual({ status: 'unverified', reason: 'digits_differ' });
  });

  it('rejects a near-identical quote whose amount differs', () => {
    const result = verifyQuote(
      'Bitte zahlen Sie den Betrag von 412,50 Euro spätestens am 26.10.2026.',
      letter,
    );
    expect(result).toEqual({ status: 'unverified', reason: 'digits_differ' });
  });

  it('rejects a fabricated quote', () => {
    const result = verifyQuote('Sie können die Zahlung bis Ende des Jahres aufschieben.', letter);
    expect(result).toEqual({ status: 'unverified', reason: 'not_found' });
  });

  it('accepts a short quote only if it matches exactly', () => {
    expect(verifyQuote('10.12.2026', letter)).toMatchObject({ status: 'verified' });
    expect(verifyQuote('10.12.2025', letter)).toEqual({
      status: 'unverified',
      reason: 'not_found',
    });
  });

  it('rejects empty and too-short quotes', () => {
    expect(verifyQuote('', letter)).toEqual({ status: 'unverified', reason: 'empty_quote' });
    expect(verifyQuote('  \n ', letter)).toEqual({ status: 'unverified', reason: 'empty_quote' });
    expect(verifyQuote('Euro', letter)).toEqual({ status: 'unverified', reason: 'too_short' });
  });

  it('finds quotes at the very start and end of the letter', () => {
    expect(matchedText(verifyQuote('Abrechnung Bitte zahlen', letter))).toBe(
      'Abrechnung\nBitte zahlen',
    );
    expect(matchedText(verifyQuote('10.12.2026 fällig.', letter))).toBe('10.12.2026 fällig.');
  });

  it('returns unverified for an empty letter', () => {
    const empty = normalizeForMatching('');
    expect(verifyQuote('Die erste Vorauszahlung ist fällig.', empty)).toEqual({
      status: 'unverified',
      reason: 'not_found',
    });
  });

  it('verifies a correct quote when OCR turned digits into look-alike letters', () => {
    const ocr = normalizeForMatching(
      'Bitte zahlen Sie den Betrag von 4l2,OO Euro spätestens am 26.1O.2O26.',
    );
    expect(
      verifyQuote('Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026.', ocr),
    ).toMatchObject({ status: 'verified', match: { exact: true } });
    expect(
      verifyQuote('Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2027.', ocr),
    ).toEqual({ status: 'unverified', reason: 'digits_differ' });
  });
});
