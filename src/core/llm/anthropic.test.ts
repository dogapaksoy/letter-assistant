import Anthropic from '@anthropic-ai/sdk';

import { createAnthropicProvider, toLlmError } from './anthropic';
import { LlmError } from './types';

type CreateParams = Parameters<Anthropic['beta']['messages']['create']>[0];

function fakeClient(response: object | Error) {
  const calls: CreateParams[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: CreateParams) => {
          calls.push(params);
          if (response instanceof Error) throw response;
          return response;
        },
      },
    },
  };
  // Only the method the adapter uses is implemented.
  return { client: client as unknown as Anthropic, calls };
}

function message(overrides: object) {
  return {
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    stop_details: null,
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: '{"summary":' },
      { type: 'text', text: '[]}' },
    ],
    usage: { input_tokens: 100, output_tokens: 20 },
    ...overrides,
  };
}

const request = {
  system: 'sys',
  user: 'letter',
  responseFormat: 'json' as const,
  maxOutputTokens: 500,
};

describe('createAnthropicProvider', () => {
  it('sends the request without sampling parameters and joins text blocks', async () => {
    const { client, calls } = fakeClient(message({}));
    const provider = createAnthropicProvider({ client });

    const response = await provider.complete({ ...request, temperature: 0 });

    expect(response).toEqual({
      text: '{"summary":[]}',
      model: 'claude-opus-5-5',
      usage: { inputTokens: 100, outputTokens: 20 },
    });
    expect(calls[0]).toMatchObject({
      model: 'claude-opus-5-5',
      max_tokens: 500,
      system: 'sys',
      messages: [{ role: 'user', content: 'letter' }],
      output_config: { effort: 'high' },
      fallbacks: 'default',
    });
    expect(calls[0]).not.toHaveProperty('temperature');
  });

  it('reports the model that actually answered', async () => {
    const { client } = fakeClient(message({ model: 'claude-opus-5' }));
    const response = await createAnthropicProvider({ client }).complete(request);
    expect(response.model).toBe('claude-opus-5');
  });

  it('throws refused and truncated errors based on stop_reason', async () => {
    const refused = fakeClient(
      message({ stop_reason: 'refusal', stop_details: { type: 'refusal', category: 'cyber' } }),
    );
    await expect(
      createAnthropicProvider({ client: refused.client }).complete(request),
    ).rejects.toMatchObject({
      kind: 'refused',
    });

    const truncated = fakeClient(message({ stop_reason: 'max_tokens' }));
    await expect(
      createAnthropicProvider({ client: truncated.client }).complete(request),
    ).rejects.toMatchObject({ kind: 'truncated' });
  });

  it('maps SDK errors to LlmError kinds', async () => {
    const { client } = fakeClient(
      new Anthropic.RateLimitError(429, undefined, 'rate', new Headers()),
    );
    await expect(createAnthropicProvider({ client }).complete(request)).rejects.toBeInstanceOf(
      LlmError,
    );
  });
});

describe('toLlmError', () => {
  const headers = new Headers();

  it.each([
    [new Anthropic.APIConnectionTimeoutError(), 'timeout'],
    [new Anthropic.APIConnectionError({ message: 'down' }), 'provider'],
    [new Anthropic.RateLimitError(429, undefined, 'x', headers), 'rate_limit'],
    [new Anthropic.AuthenticationError(401, undefined, 'x', headers), 'auth'],
    [new Anthropic.PermissionDeniedError(403, undefined, 'x', headers), 'auth'],
    [new Anthropic.BadRequestError(400, undefined, 'x', headers), 'invalid_request'],
    [new Anthropic.NotFoundError(404, undefined, 'x', headers), 'invalid_request'],
    [new Anthropic.InternalServerError(500, undefined, 'x', headers), 'provider'],
    [new Error('other'), 'provider'],
  ])('maps %p to %s', (error, kind) => {
    expect(toLlmError(error).kind).toBe(kind);
  });

  it('does not copy the original error message, which may echo request content', () => {
    const error = new Anthropic.BadRequestError(400, undefined, 'bad input: Ayşe Deneme', headers);
    expect(toLlmError(error).message).not.toContain('Ayşe');
  });
});
