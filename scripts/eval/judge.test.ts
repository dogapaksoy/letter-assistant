import { createFakeProvider } from '../../src/core/llm/fake';
import { judgeSections } from './judge';

const actions = {
  name: 'actions',
  expected: [
    { id: 'a1', text: 'Attend the appointment.' },
    { id: 'a2', text: 'Bring the listed documents.' },
  ],
  predicted: ['Set up direct debit.', 'Attend the appointment and bring your passport and CV.'],
};
const relative = {
  name: 'relative',
  expected: [{ id: 'd2', text: 'Pay within 14 days of receipt.' }],
  predicted: ['Pay within 14 days after you receive the letter.'],
};

describe('judgeSections', () => {
  it('judges all sections in one call and allows one prediction to cover several items', async () => {
    const provider = createFakeProvider([
      JSON.stringify({
        sections: [
          {
            name: 'actions',
            matches: [
              { expected_id: 'a1', predicted_index: 1, reason: 'attend' },
              { expected_id: 'a2', predicted_index: 1, reason: 'documents' },
            ],
          },
          {
            name: 'relative',
            matches: [{ expected_id: 'd2', predicted_index: 0, reason: 'same' }],
          },
        ],
      }),
    ]);

    const [actionMatches, relativeMatches] = await judgeSections(provider, [actions, relative]);

    expect(provider.requests).toHaveLength(1);
    expect(actionMatches).toEqual([
      { expectedId: 'a1', predictedIndex: 1, reason: 'attend' },
      { expectedId: 'a2', predictedIndex: 1, reason: 'documents' },
    ]);
    expect(relativeMatches).toEqual([{ expectedId: 'd2', predictedIndex: 0, reason: 'same' }]);
  });

  it('drops out-of-range indices and fills in missing entries', async () => {
    const provider = createFakeProvider([
      JSON.stringify({
        sections: [
          { name: 'actions', matches: [{ expected_id: 'a1', predicted_index: 9, reason: 'x' }] },
        ],
      }) + '\n}',
    ]);
    const [actionMatches] = await judgeSections(provider, [actions]);
    expect(actionMatches).toEqual([
      { expectedId: 'a1', predictedIndex: null, reason: 'x' },
      { expectedId: 'a2', predictedIndex: null, reason: 'judge returned no entry' },
    ]);
  });

  it('skips the LLM for sections with nothing to compare', async () => {
    const provider = createFakeProvider([]);
    const result = await judgeSections(provider, [
      { name: 'empty', expected: [], predicted: ['x'] },
      { name: 'none-predicted', expected: [{ id: 'a1', text: 'x' }], predicted: [] },
    ]);
    expect(result).toEqual([
      [],
      [{ expectedId: 'a1', predictedIndex: null, reason: 'nothing predicted' }],
    ]);
    expect(provider.requests).toHaveLength(0);
  });

  it('fails clearly on malformed judge output', async () => {
    const provider = createFakeProvider(['not json']);
    await expect(judgeSections(provider, [actions])).rejects.toMatchObject({ kind: 'provider' });
  });
});
