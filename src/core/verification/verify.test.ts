import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Extraction } from '../extraction/schema';
import { verifyQuote } from './match';
import { normalizeForMatching } from './normalize';
import { verifyExtraction } from './verify';

const LETTER =
  'Bitte reichen Sie uns bis spätestens 31.10.2026 eine aktuelle Immatrikulationsbescheinigung ein.';

describe('verifyExtraction', () => {
  it('attaches a verification result to every item and keeps its fields', () => {
    const extraction: Extraction = {
      summary: [
        {
          value: 'Proof of enrolment is needed.',
          source_quote: 'eine aktuelle Immatrikulationsbescheinigung',
          confidence: 'high',
        },
      ],
      deadlines: [
        {
          value: 'Submit enrolment certificate.',
          source_quote: 'bis spätestens 31.10.2026',
          confidence: 'high',
          kind: 'due_date',
          date: '2026-10-31',
        },
      ],
      actions: [
        {
          value: 'Pay the outstanding amount.',
          source_quote: 'Bitte überweisen Sie den Betrag innerhalb von 14 Tagen.',
          confidence: 'medium',
          type: 'required',
        },
      ],
    };

    const result = verifyExtraction(extraction, LETTER);

    expect(result.summary[0]).toMatchObject({
      value: 'Proof of enrolment is needed.',
      verification: { status: 'verified' },
    });
    expect(result.deadlines[0]).toMatchObject({
      date: '2026-10-31',
      verification: { status: 'verified' },
    });
    expect(result.actions[0]).toMatchObject({
      verification: { status: 'unverified', reason: 'not_found' },
    });
  });
});

describe('synthetic eval set', () => {
  const evalDir = join(__dirname, '../../../eval');
  const files = readdirSync(join(evalDir, 'ground-truth')).filter((f) => f.endsWith('.json'));

  it('has ground-truth files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('verifies every ground-truth quote in %s exactly', (file) => {
    const truth: unknown = JSON.parse(readFileSync(join(evalDir, 'ground-truth', file), 'utf8'));
    const { letter_file } = truth as { letter_file: string };
    const body = readFileSync(join(evalDir, letter_file), 'utf8').replace(
      /^---[\s\S]*?\n---\n/,
      '',
    );
    const letter = normalizeForMatching(body);

    const quotes = collectQuotes(truth);
    expect(quotes.length).toBeGreaterThan(0);
    for (const quote of quotes) {
      expect({ quote, result: verifyQuote(quote, letter) }).toMatchObject({
        quote,
        result: { status: 'verified', match: { exact: true } },
      });
    }
  });
});

function collectQuotes(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectQuotes);
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === 'source_quote' && typeof value === 'string' ? [value] : collectQuotes(value),
  );
}
