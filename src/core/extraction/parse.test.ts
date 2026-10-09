import { firstJsonObject, parseExtraction } from './parse';

const summaryPoint = {
  value: 'An additional 412 euros are due.',
  source_quote: 'Nachzahlung: 412,00 Euro',
  confidence: 'high',
};
const deadline = {
  value: 'Pay 412 euros.',
  source_quote: 'spätestens am 26.10.2026',
  confidence: 'high',
  kind: 'due_date',
  date: '2026-10-26',
};
const relativeDeadline = {
  value: 'Objection deadline: one month after delivery.',
  source_quote: 'Die Frist für die Einlegung des Einspruchs beträgt einen Monat.',
  confidence: 'medium',
  kind: 'relative',
  date: null,
};
const action = {
  value: 'Pay with your tax number as reference.',
  source_quote: 'Geben Sie bei der Überweisung bitte Ihre Steuernummer an.',
  confidence: 'high',
  type: 'required',
};

const valid = {
  summary: [summaryPoint],
  deadlines: [deadline, relativeDeadline],
  actions: [action],
};
const noneDropped = { summary: 0, deadlines: 0, actions: 0 };

describe('parseExtraction', () => {
  it('parses valid output', () => {
    expect(parseExtraction(JSON.stringify(valid))).toEqual({
      ok: true,
      extraction: valid,
      dropped: noneDropped,
    });
  });

  it('accepts output wrapped in a markdown code fence', () => {
    const result = parseExtraction('```json\n' + JSON.stringify(valid) + '\n```');
    expect(result).toMatchObject({ ok: true, dropped: noneDropped });
  });

  it('returns invalid_json for non-JSON output instead of throwing', () => {
    expect(parseExtraction('Sorry, I cannot read this letter.')).toEqual({
      ok: false,
      error: 'invalid_json',
    });
    expect(parseExtraction('')).toEqual({ ok: false, error: 'invalid_json' });
    expect(parseExtraction('{"summary": [')).toEqual({ ok: false, error: 'invalid_json' });
  });

  it('returns invalid_shape when a section is missing or not an array', () => {
    expect(parseExtraction(JSON.stringify({ summary: [], deadlines: [] }))).toEqual({
      ok: false,
      error: 'invalid_shape',
    });
    expect(parseExtraction(JSON.stringify({ ...valid, actions: 'none' }))).toEqual({
      ok: false,
      error: 'invalid_shape',
    });
    expect(parseExtraction('[]')).toEqual({ ok: false, error: 'invalid_shape' });
    expect(parseExtraction('null')).toEqual({ ok: false, error: 'invalid_shape' });
  });

  it('drops only the invalid items and counts them per section', () => {
    const result = parseExtraction(
      JSON.stringify({
        summary: [summaryPoint, { ...summaryPoint, confidence: 'very high' }],
        deadlines: [deadline, { ...deadline, date: '26.10.2026' }, 'not an object'],
        actions: [action, { ...action, value: '   ' }],
      }),
    );
    expect(result).toEqual({
      ok: true,
      extraction: { summary: [summaryPoint], deadlines: [deadline], actions: [action] },
      dropped: { summary: 1, deadlines: 2, actions: 1 },
    });
  });

  it('rejects a relative deadline that comes with a computed date', () => {
    const result = parseExtraction(
      JSON.stringify({ ...valid, deadlines: [{ ...relativeDeadline, date: '2026-10-26' }] }),
    );
    expect(result).toMatchObject({
      ok: true,
      extraction: { deadlines: [] },
      dropped: { deadlines: 1 },
    });
  });

  it('rejects a fixed deadline without a date', () => {
    const result = parseExtraction(
      JSON.stringify({ ...valid, deadlines: [{ ...deadline, date: null }] }),
    );
    expect(result).toMatchObject({
      ok: true,
      extraction: { deadlines: [] },
      dropped: { deadlines: 1 },
    });
  });

  it('rejects impossible dates and times', () => {
    const result = parseExtraction(
      JSON.stringify({
        ...valid,
        deadlines: [
          { ...deadline, date: '2026-02-30' },
          { ...deadline, kind: 'appointment', time: '25:00' },
        ],
      }),
    );
    expect(result).toMatchObject({ ok: true, dropped: { deadlines: 2 } });
  });

  it('strips unknown fields', () => {
    const result = parseExtraction(
      JSON.stringify({ ...valid, actions: [{ ...action, legal_advice: 'You will win.' }] }),
    );
    expect(result).toMatchObject({ ok: true, extraction: { actions: [action] } });
    if (result.ok) expect(result.extraction.actions[0]).not.toHaveProperty('legal_advice');
  });
});

describe('recovering JSON from noisy model output', () => {
  it('accepts valid JSON followed by an extra closing brace (seen with gemini-3.5-flash)', () => {
    const result = parseExtraction(JSON.stringify(valid, null, 2) + '\n}');
    expect(result).toMatchObject({ ok: true, dropped: noneDropped });
  });

  it('accepts JSON surrounded by prose', () => {
    const result = parseExtraction(
      `Here is the result:\n${JSON.stringify(valid)}\nHope this helps.`,
    );
    expect(result).toMatchObject({ ok: true, extraction: valid });
  });

  it('ignores braces inside strings when finding the object', () => {
    expect(firstJsonObject('x {"a": "} {", "b": "\\"}"} tail }')).toBe('{"a": "} {", "b": "\\"}"}');
  });

  it('still rejects output without a complete object', () => {
    expect(firstJsonObject('{"summary": [')).toBeNull();
    expect(firstJsonObject('no json here')).toBeNull();
    expect(parseExtraction('{"summary": [}')).toEqual({ ok: false, error: 'invalid_json' });
  });
});
