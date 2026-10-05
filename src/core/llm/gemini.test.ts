import { createGeminiProvider, type GeminiClient, toLlmError } from './gemini';

type GenerateParams = Parameters<GeminiClient['models']['generateContent']>[0];

function fakeClient(response: object | Error) {
  const calls: GenerateParams[] = [];
  const client = {
    models: {
      generateContent: async (params: GenerateParams) => {
        calls.push(params);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
  // The fake returns plain objects shaped like SDK responses.
  return { client: client as unknown as GeminiClient, calls };
}

function generation(overrides: { finishReason?: string; parts?: object[] } = {}) {
  return {
    modelVersion: 'gemini-2.5-flash-001',
    usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 40, thoughtsTokenCount: 60 },
    candidates: [
      {
        finishReason: overrides.finishReason ?? 'STOP',
        content: {
          role: 'model',
          parts: overrides.parts ?? [
            { text: 'thinking about it', thought: true },
            { text: '{"summary":' },
            { text: '[]}' },
          ],
        },
      },
    ],
  };
}

const request = {
  system: 'sys',
  user: 'letter',
  responseFormat: 'json' as const,
  maxOutputTokens: 500,
};

describe('createGeminiProvider', () => {
  it('sends the prompt in JSON mode and returns answer text without thoughts', async () => {
    const { client, calls } = fakeClient(generation());
    const response = await createGeminiProvider({ client, model: 'gemini-test' }).complete(request);

    expect(response).toEqual({
      text: '{"summary":[]}',
      model: 'gemini-2.5-flash-001',
      usage: { inputTokens: 200, outputTokens: 100 },
    });
    expect(calls[0]).toEqual({
      model: 'gemini-test',
      contents: 'letter',
      config: {
        systemInstruction: 'sys',
        maxOutputTokens: 500,
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });
  });

  it('throws truncated on MAX_TOKENS and refused on safety blocks', async () => {
    const truncated = fakeClient(generation({ finishReason: 'MAX_TOKENS' }));
    await expect(
      createGeminiProvider({ client: truncated.client }).complete(request),
    ).rejects.toMatchObject({ kind: 'truncated' });

    const blocked = fakeClient(generation({ finishReason: 'SAFETY' }));
    await expect(
      createGeminiProvider({ client: blocked.client }).complete(request),
    ).rejects.toMatchObject({ kind: 'refused' });
  });

  it('throws refused when the prompt itself was blocked', async () => {
    const { client } = fakeClient({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(createGeminiProvider({ client }).complete(request)).rejects.toMatchObject({
      kind: 'refused',
    });
  });

  it('maps thrown SDK errors', async () => {
    const { client } = fakeClient(Object.assign(new Error('x'), { status: 429 }));
    await expect(createGeminiProvider({ client }).complete(request)).rejects.toMatchObject({
      kind: 'rate_limit',
    });
  });
});

describe('toLlmError', () => {
  const apiError = (status: number) => Object.assign(new Error('x'), { name: 'ApiError', status });
  const named = (name: string) => Object.assign(new Error('x'), { name });

  it.each([
    [named('AbortError'), 'timeout'],
    [named('TimeoutError'), 'timeout'],
    [new TypeError('fetch failed'), 'provider'],
    [apiError(429), 'rate_limit'],
    [apiError(401), 'auth'],
    [apiError(403), 'auth'],
    [apiError(400), 'invalid_request'],
    [apiError(404), 'invalid_request'],
    [apiError(500), 'provider'],
    ['not an error', 'provider'],
  ])('maps %p to %s', (error, kind) => {
    expect(toLlmError(error).kind).toBe(kind);
  });

  it('recognizes an invalid key reported as HTTP 400', () => {
    const error = Object.assign(
      new Error('{"error":{"status":"INVALID_ARGUMENT","reason":"API_KEY_INVALID"}}'),
      {
        status: 400,
      },
    );
    expect(toLlmError(error).kind).toBe('auth');
  });

  it('does not copy the original error message', () => {
    const error = Object.assign(new Error('bad input: Ayşe Deneme'), { status: 400 });
    expect(toLlmError(error).message).not.toContain('Ayşe');
  });
});
