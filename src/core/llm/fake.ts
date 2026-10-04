import type { LlmProvider, LlmRequest, LlmResponse } from './types';

/** Test double: returns scripted outputs in order and records every request. */
export function createFakeProvider(outputs: (string | Error)[]): LlmProvider & {
  requests: LlmRequest[];
} {
  const requests: LlmRequest[] = [];
  let next = 0;
  return {
    name: 'fake',
    requests,
    async complete(request: LlmRequest): Promise<LlmResponse> {
      requests.push(request);
      const output = outputs[next++];
      if (output === undefined) throw new Error('FakeProvider: no scripted output left');
      if (output instanceof Error) throw output;
      return { text: output, model: 'fake-model' };
    },
  };
}
