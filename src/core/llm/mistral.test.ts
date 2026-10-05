import { createMistralProvider, type MistralClient, toLlmError } from './mistral';

type CompleteParams = Parameters<MistralClient['chat']['complete']>[0];

function fakeClient(response: object | Error) {
  const calls: CompleteParams[] = [];
  const client = {
    chat: {
      complete: async (params: CompleteParams) => {
        calls.push(params);
        if (response instanceof Error) throw response;
        return response;
      },
    },
  };
  // The fake returns plain objects shaped like SDK responses.
  return { client: client as unknown as MistralClient, calls };
}

function completion(overrides: { finishReason?: string; content?: unknown } = {}) {
  return {
    id: 'x',
    object: 'chat.completion',
    model: 'mistral-large-2511',
    created: 0,
    usage: { promptTokens: 120, completionTokens: 30 },
    choices: [
      {
        index: 0,
        finishReason: overrides.finishReason ?? 'stop',
        message: { role: 'assistant', content: overrides.content ?? '{"summary":[]}' },
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

describe('createMistralProvider', () => {
  it('sends system and user messages in JSON mode and returns the text', async () => {
    const { client, calls } = fakeClient(completion());
    const response = await createMistralProvider({ client }).complete(request);

    expect(response).toEqual({
      text: '{"summary":[]}',
      model: 'mistral-large-2511',
      usage: { inputTokens: 120, outputTokens: 30 },
    });
    expect(calls[0]).toEqual({
      model: 'mistral-large-latest',
      maxTokens: 500,
      temperature: 0,
      messages: [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'letter' },
      ],
      responseFormat: { type: 'json_object' },
    });
  });

  it('joins text chunks when content is an array', async () => {
    const { client } = fakeClient(
      completion({
        content: [
          { type: 'text', text: '{"a":' },
          { type: 'image_url', imageUrl: 'x' },
          { type: 'text', text: '1}' },
        ],
      }),
    );
    await expect(createMistralProvider({ client }).complete(request)).resolves.toMatchObject({
      text: '{"a":1}',
    });
  });

  it('throws truncated when the output hit the token limit', async () => {
    const { client } = fakeClient(completion({ finishReason: 'length' }));
    await expect(createMistralProvider({ client }).complete(request)).rejects.toMatchObject({
      kind: 'truncated',
    });
  });

  it('maps thrown SDK errors', async () => {
    const { client } = fakeClient(Object.assign(new Error('x'), { statusCode: 401 }));
    await expect(createMistralProvider({ client }).complete(request)).rejects.toMatchObject({
      kind: 'auth',
    });
  });
});

describe('toLlmError', () => {
  const httpError = (statusCode: number) => Object.assign(new Error('x'), { statusCode });
  const named = (name: string) => Object.assign(new Error('x'), { name });

  it.each([
    [named('RequestTimeoutError'), 'timeout'],
    [named('ConnectionError'), 'provider'],
    [httpError(429), 'rate_limit'],
    [httpError(401), 'auth'],
    [httpError(403), 'auth'],
    [httpError(400), 'invalid_request'],
    [httpError(422), 'invalid_request'],
    [httpError(503), 'provider'],
    [new Error('other'), 'provider'],
    ['not an error', 'provider'],
  ])('maps %p to %s', (error, kind) => {
    expect(toLlmError(error).kind).toBe(kind);
  });

  it('does not copy the original error message', () => {
    const error = Object.assign(new Error('bad input: Ayşe Deneme'), { statusCode: 400 });
    expect(toLlmError(error).message).not.toContain('Ayşe');
  });
});
