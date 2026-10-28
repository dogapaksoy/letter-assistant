import { extractResponseSchema } from '../core/api/contract';
import { createFakeProvider } from '../core/llm/fake';
import { LlmError } from '../core/llm/types';
import { TextExtractionError } from '../core/text-extraction/router';
import type { TextExtractor } from '../core/text-extraction/types';
import { createRequestHandler, depsFromEnv, type ServerDeps } from './extract-letter';

const LETTER = 'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026.';

const MODEL_OUTPUT = JSON.stringify({
  summary: [{ value: 'You owe 412 euros.', source_quote: '412,00 Euro', confidence: 'high' }],
  deadlines: [
    {
      value: 'Pay 412 euros.',
      source_quote: 'spätestens am 26.10.2026',
      confidence: 'high',
      kind: 'due_date',
      date: '2026-10-26',
    },
  ],
  actions: [],
});

const noOcr: TextExtractor = {
  name: 'no-ocr',
  async extract() {
    throw new TextExtractionError('ocr_not_configured', 'none');
  },
};

function handler(
  overrides: Partial<ServerDeps> = {},
  outputs: (string | Error)[] = [MODEL_OUTPUT],
) {
  const provider = createFakeProvider(outputs);
  const deps: ServerDeps = {
    provider,
    textExtractor: noOcr,
    mode: 'dev-synthetic-only',
    ...overrides,
  };
  return { handle: createRequestHandler(() => deps), provider };
}

function post(body: unknown): Request {
  return new Request('http://localhost/extract-letter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function read(response: Response) {
  return extractResponseSchema.parse(await response.json());
}

describe('extract-letter handler', () => {
  it('extracts and verifies items from pasted text', async () => {
    const { handle, provider } = handler();
    const response = await handle(
      post({ language: 'en', document: { kind: 'text', text: LETTER } }),
    );

    expect(response.status).toBe(200);
    const body = await read(response);
    expect(body).toMatchObject({
      ok: true,
      letterText: LETTER,
      textMethod: 'text',
      devMode: true,
      extraction: {
        deadlines: [{ date: '2026-10-26', verification: { status: 'verified' } }],
      },
    });
    expect(provider.requests[0]?.user).toContain(LETTER);
  });

  it('returns OCR word boxes for photos so the app can highlight on the image', async () => {
    const box = { x: 0.5, y: 0.1, width: 0.3, height: 0.03 };
    const ocr: TextExtractor = {
      name: 'ocr',
      async extract() {
        return {
          text: LETTER,
          method: 'ocr',
          provider: 'stub',
          pageCount: 1,
          spans: [{ start: 44, end: 68, page: 0, box, confidence: 0.9 }],
        };
      },
    };
    const { handle } = handler({ textExtractor: ocr });
    const body = await read(
      await handle(
        post({
          language: 'tr',
          document: { kind: 'image', base64: btoa('jpeg'), mimeType: 'image/jpeg' },
        }),
      ),
    );
    expect(body).toMatchObject({
      ok: true,
      textMethod: 'ocr',
      spans: [{ start: 44, end: 68, page: 0, box }],
    });
  });

  it('reports service_unavailable when the OCR service fails', async () => {
    const down: TextExtractor = {
      name: 'down',
      async extract() {
        throw new TextExtractionError('unavailable', 'timeout');
      },
    };
    const { handle, provider } = handler({ textExtractor: down });
    const response = await handle(
      post({
        language: 'tr',
        document: { kind: 'image', base64: btoa('jpeg'), mimeType: 'image/jpeg' },
      }),
    );
    expect(response.status).toBe(503);
    expect(await read(response)).toEqual({ ok: false, error: 'service_unavailable' });
    expect(provider.requests).toHaveLength(0);
  });

  it('uses the text extractor for PDFs', async () => {
    const pdfExtractor: TextExtractor = {
      name: 'stub',
      async extract(input) {
        expect(input).toMatchObject({ kind: 'pdf' });
        return {
          text: LETTER,
          method: 'pdf-text-layer',
          provider: 'stub',
          pageCount: 1,
          spans: [],
        };
      },
    };
    const { handle } = handler({ textExtractor: pdfExtractor, mode: 'production' });
    const body = await read(
      await handle(post({ language: 'tr', document: { kind: 'pdf', base64: btoa('%PDF') } })),
    );
    expect(body).toMatchObject({ ok: true, textMethod: 'pdf-text-layer', devMode: false });
  });

  it.each([
    ['not json', 'invalid_request', 400],
    [{ language: 'de', document: { kind: 'text', text: LETTER } }, 'invalid_request', 400],
    [
      { language: 'en', document: { kind: 'pdf', base64: '%%%not-base64%%%' } },
      'invalid_request',
      400,
    ],
    [
      { language: 'en', document: { kind: 'image', base64: btoa('x'), mimeType: 'image/jpeg' } },
      'ocr_not_configured',
      501,
    ],
  ])('rejects %p with %s', async (body, error, status) => {
    const { handle, provider } = handler();
    const response = await handle(post(body));
    expect(response.status).toBe(status);
    expect(await read(response)).toEqual({ ok: false, error });
    expect(provider.requests).toHaveLength(0);
  });

  it('maps temporary LLM failures to service_unavailable and bad output to extraction_failed', async () => {
    const request = { language: 'en', document: { kind: 'text', text: LETTER } };

    const busy = handler({}, [new LlmError('rate_limit', '429')]);
    const busyResponse = await busy.handle(post(request));
    expect(busyResponse.status).toBe(503);
    expect(await read(busyResponse)).toEqual({ ok: false, error: 'service_unavailable' });

    const broken = handler({}, ['not json']);
    expect(await read(await broken.handle(post(request)))).toEqual({
      ok: false,
      error: 'extraction_failed',
    });
  });

  it('rejects rate-limited requests before extracting text or calling the LLM', async () => {
    const extractor: TextExtractor = {
      name: 'never',
      async extract() {
        throw new Error('must not be called');
      },
    };
    const { handle, provider } = handler({
      textExtractor: extractor,
      rateLimiter: { allow: async () => false },
    });
    const response = await handle(
      post({ language: 'en', document: { kind: 'pdf', base64: btoa('%PDF') } }),
    );
    expect(response.status).toBe(429);
    expect(await read(response)).toEqual({ ok: false, error: 'rate_limited' });
    expect(provider.requests).toHaveLength(0);
  });

  it('lets requests through when the rate limiter allows them', async () => {
    const { handle } = handler({ rateLimiter: { allow: async () => true } });
    const body = await read(
      await handle(post({ language: 'en', document: { kind: 'text', text: LETTER } })),
    );
    expect(body.ok).toBe(true);
  });

  it('refuses to work when the server is not configured', async () => {
    const handle = createRequestHandler(() => null);
    const response = await handle(
      post({ language: 'en', document: { kind: 'text', text: LETTER } }),
    );
    expect(response.status).toBe(503);
    expect(await read(response)).toEqual({ ok: false, error: 'not_configured' });
  });

  it('answers CORS preflight and rejects other methods', async () => {
    const { handle } = handler();
    const preflight = await handle(new Request('http://localhost', { method: 'OPTIONS' }));
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect((await handle(new Request('http://localhost', { method: 'GET' }))).status).toBe(400);
  });
});

describe('depsFromEnv', () => {
  it('requires an explicit data mode and a provider key', () => {
    expect(depsFromEnv({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' })).toBeNull();
    expect(depsFromEnv({ DEV_MODE_SYNTHETIC_ONLY: 'true', LLM_PROVIDER: 'gemini' })).toBeNull();
    expect(depsFromEnv({ DEV_MODE_SYNTHETIC_ONLY: 'true', LLM_PROVIDER: 'nope' })).toBeNull();
  });

  const rateLimitEnv = {
    SUPABASE_URL: 'https://abc.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    RATE_LIMIT_SECRET: 'secret',
  };
  const production = {
    LLM_APPROVED_FOR_PERSONAL_DATA: 'true',
    LLM_PROVIDER: 'mistral',
    MISTRAL_API_KEY: 'k',
  };

  it('builds a dev configuration, with rate limiting only if configured', () => {
    const dev = { DEV_MODE_SYNTHETIC_ONLY: 'true', LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' };
    const withoutLimit = depsFromEnv(dev);
    expect(withoutLimit).toMatchObject({
      mode: 'dev-synthetic-only',
      provider: { name: 'gemini' },
    });
    expect(withoutLimit?.rateLimiter).toBeUndefined();
    expect(depsFromEnv({ ...dev, ...rateLimitEnv })?.rateLimiter).toBeDefined();
  });

  it('requires rate limiting in production', () => {
    expect(depsFromEnv(production)).toBeNull();
    expect(depsFromEnv({ ...production, ...rateLimitEnv, RATE_LIMIT_SECRET: '' })).toBeNull();
    const deps = depsFromEnv({ ...production, ...rateLimitEnv });
    expect(deps).toMatchObject({ mode: 'production', provider: { name: 'mistral' } });
    expect(deps?.rateLimiter).toBeDefined();
  });
});
