import { LlmError } from './types';

describe('LlmError', () => {
  it('keeps the error kind and is a real Error', () => {
    const error = new LlmError('rate_limit', 'Too many requests');

    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe('rate_limit');
    expect(error.name).toBe('LlmError');
    expect(error.message).toBe('Too many requests');
  });
});
