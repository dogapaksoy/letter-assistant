import { createFakeProvider } from '../../src/core/llm/fake';
import { judgeMatches } from './judge';

const expected = [
  { id: 'a1', text: 'Pay 55.08 euros.' },
  { id: 'a2', text: 'Apply for an exemption if you receive BAföG.' },
];

describe('judgeMatches', () => {
  it('returns one decision per expected item and drops invalid indices', async () => {
    const provider = createFakeProvider([
      JSON.stringify({
        matches: [
          { expected_id: 'a1', predicted_index: 1, reason: 'same amount' },
          { expected_id: 'a2', predicted_index: 7, reason: 'out of range' },
        ],
      }),
    ]);

    const result = await judgeMatches(provider, expected, ['Set up direct debit.', 'Pay 55,08 €.']);

    expect(result).toEqual([
      { expectedId: 'a1', predictedIndex: 1, reason: 'same amount' },
      { expectedId: 'a2', predictedIndex: null, reason: 'out of range' },
    ]);
    expect(provider.requests[0]?.user).toContain('Pay 55,08 €.');
  });

  it('skips the LLM when there is nothing to compare', async () => {
    const provider = createFakeProvider([]);
    await expect(judgeMatches(provider, [], ['x'])).resolves.toEqual([]);
    await expect(judgeMatches(provider, expected, [])).resolves.toMatchObject([
      { expectedId: 'a1', predictedIndex: null },
      { expectedId: 'a2', predictedIndex: null },
    ]);
    expect(provider.requests).toHaveLength(0);
  });

  it('fails clearly on malformed judge output', async () => {
    const provider = createFakeProvider(['not json']);
    await expect(judgeMatches(provider, expected, ['x'])).rejects.toMatchObject({
      kind: 'provider',
    });
  });
});
