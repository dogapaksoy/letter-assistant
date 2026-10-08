import { createFakeProvider } from '../../src/core/llm/fake';
import { LlmError } from '../../src/core/llm/types';
import { withPacing } from './paced';

const request = { system: 's', user: 'u', responseFormat: 'json' as const, maxOutputTokens: 10 };

function clock() {
  let time = 0;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => time,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      time += ms;
    },
  };
}

describe('withPacing', () => {
  it('spaces requests by the minimum interval', async () => {
    const c = clock();
    const provider = withPacing(createFakeProvider(['a', 'b']), {
      minIntervalMs: 5000,
      retryDelaysMs: [],
      ...c,
    });

    await provider.complete(request);
    await provider.complete(request);

    expect(c.sleeps).toEqual([5000]);
  });

  it('retries rate limits and temporary failures, then succeeds', async () => {
    const c = clock();
    const retries: number[] = [];
    const provider = withPacing(
      createFakeProvider([
        new LlmError('rate_limit', '429'),
        new LlmError('provider', '503'),
        'ok',
      ]),
      {
        minIntervalMs: 0,
        retryDelaysMs: [1000, 2000, 3000],
        onRetry: (n) => retries.push(n),
        ...c,
      },
    );

    await expect(provider.complete(request)).resolves.toMatchObject({ text: 'ok' });
    expect(c.sleeps).toEqual([1000, 2000]);
    expect(retries).toEqual([1, 2]);
  });

  it('gives up after the last retry delay', async () => {
    const c = clock();
    const provider = withPacing(
      createFakeProvider([new LlmError('rate_limit', '429'), new LlmError('rate_limit', '429')]),
      { minIntervalMs: 0, retryDelaysMs: [1000], ...c },
    );
    await expect(provider.complete(request)).rejects.toMatchObject({ kind: 'rate_limit' });
  });

  it('does not retry errors that will not go away', async () => {
    const c = clock();
    const provider = withPacing(createFakeProvider([new LlmError('auth', '401')]), {
      minIntervalMs: 0,
      retryDelaysMs: [1000],
      ...c,
    });
    await expect(provider.complete(request)).rejects.toMatchObject({ kind: 'auth' });
    expect(c.sleeps).toEqual([]);
  });
});
