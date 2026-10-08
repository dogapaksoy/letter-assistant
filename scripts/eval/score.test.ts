import { ratio, scoreDatedDeadlines, scoreMatches } from './score';

const truth = {
  deadlines: [
    {
      id: 'd1',
      kind: 'due_date' as const,
      date: '2026-10-31',
      description: { en: '', tr: '' },
      source_quote: '',
    },
    {
      id: 'd2',
      kind: 'relative' as const,
      date: null,
      description: { en: '', tr: '' },
      source_quote: '',
    },
    {
      id: 'd3',
      kind: 'appointment' as const,
      date: '2026-10-14',
      description: { en: '', tr: '' },
      source_quote: '',
    },
  ],
  non_deadline_dates: [
    { date: '2026-09-25', reason: 'letter date' },
    { date: '2026-09-30', reason: 'consequence' },
  ],
};

describe('scoreDatedDeadlines', () => {
  it('counts found, missing and wrong dates, and flags distractors', () => {
    const score = scoreDatedDeadlines(truth, [
      { kind: 'due_date', date: '2026-10-31' },
      { kind: 'relative', date: null },
      { kind: 'due_date', date: '2026-09-30' },
      { kind: 'due_date', date: '2026-12-01' },
    ]);
    expect(score).toEqual({
      datedExpected: 2,
      datedFound: 1,
      wrongDates: 2,
      distractorDates: 1,
      relativeWithDate: 0,
      missingDates: ['2026-10-14'],
      unexpectedDates: ['2026-09-30', '2026-12-01'],
    });
  });

  it('counts the same date only once', () => {
    const score = scoreDatedDeadlines(truth, [
      { kind: 'due_date', date: '2026-10-31' },
      { kind: 'expiry', date: '2026-10-31' },
    ]);
    expect(score).toMatchObject({ datedFound: 1, wrongDates: 0 });
  });

  it('accepts later dates of an expected recurring schedule, but only for recurring items', () => {
    const recurringTruth = {
      deadlines: [
        {
          id: 'd1',
          kind: 'recurring' as const,
          date: '2026-12-10',
          description: { en: '', tr: '' },
          source_quote: '',
        },
      ],
      non_deadline_dates: [],
    };
    const score = scoreDatedDeadlines(recurringTruth, [
      { kind: 'due_date', date: '2026-12-10' },
      { kind: 'recurring', date: '2027-03-10' },
      { kind: 'due_date', date: '2027-01-15' },
    ]);
    expect(score).toMatchObject({ datedFound: 1, wrongDates: 1, unexpectedDates: ['2027-01-15'] });

    expect(scoreDatedDeadlines(truth, [{ kind: 'recurring', date: '2027-03-10' }])).toMatchObject({
      wrongDates: 1,
    });
  });
});

describe('scoreMatches', () => {
  it('counts matched expected items and unmatched predictions', () => {
    expect(
      scoreMatches(['a1', 'a2', 'a3'], 4, [
        { expectedId: 'a1', predictedIndex: 0 },
        { expectedId: 'a2', predictedIndex: null },
        { expectedId: 'a3', predictedIndex: 2 },
      ]),
    ).toEqual({ expected: 3, found: 2, extra: 2 });
  });

  it('ignores out-of-range indices', () => {
    expect(scoreMatches(['a1'], 1, [{ expectedId: 'a1', predictedIndex: 5 }])).toMatchObject({
      found: 0,
    });
  });
});

describe('ratio', () => {
  it('formats counts with a percentage', () => {
    expect(ratio(3, 4)).toBe('3/4 (75%)');
    expect(ratio(0, 0)).toBe('-');
  });
});
