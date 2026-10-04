import { createFakeProvider } from '../llm/fake';
import { LlmError } from '../llm/types';
import { extractFromLetter } from './pipeline';
import { PROMPT_VERSION } from './prompt';

const LETTER = 'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026.';

const output = JSON.stringify({
  summary: [],
  deadlines: [
    {
      value: '412 Euro bis 26.10.2026 zahlen.',
      source_quote: 'spätestens am 26.10.2026',
      confidence: 'high',
      kind: 'due_date',
      date: '2026-10-26',
    },
  ],
  actions: [
    {
      value: 'Ödemeyi yap.',
      source_quote: 'Bitte überweisen Sie sofort.',
      confidence: 'medium',
      type: 'required',
    },
  ],
});

describe('extractFromLetter', () => {
  it('sends the letter to the provider and returns verified items', async () => {
    const provider = createFakeProvider([output]);

    const outcome = await extractFromLetter({ provider, letterText: LETTER, language: 'tr' });

    expect(outcome).toMatchObject({
      ok: true,
      model: 'fake-model',
      promptVersion: PROMPT_VERSION,
      dropped: { summary: 0, deadlines: 0, actions: 0 },
      extraction: {
        deadlines: [{ date: '2026-10-26', verification: { status: 'verified' } }],
        actions: [{ verification: { status: 'unverified', reason: 'not_found' } }],
      },
    });
    expect(provider.requests).toHaveLength(1);
    expect(provider.requests[0]?.user).toContain(LETTER);
    expect(provider.requests[0]?.system).toContain('Turkish');
  });

  it('reports invalid model output instead of throwing', async () => {
    const provider = createFakeProvider(['I cannot help with that.']);
    await expect(
      extractFromLetter({ provider, letterText: LETTER, language: 'en' }),
    ).resolves.toEqual({ ok: false, error: 'invalid_json', promptVersion: PROMPT_VERSION });
  });

  it('reports provider errors by kind', async () => {
    const provider = createFakeProvider([new LlmError('rate_limit', 'slow down')]);
    await expect(
      extractFromLetter({ provider, letterText: LETTER, language: 'en' }),
    ).resolves.toMatchObject({ ok: false, error: 'llm_rate_limit' });
  });

  it('treats unexpected errors as provider errors', async () => {
    const provider = createFakeProvider([new Error('boom')]);
    await expect(
      extractFromLetter({ provider, letterText: LETTER, language: 'en' }),
    ).resolves.toMatchObject({ ok: false, error: 'llm_provider' });
  });
});
