import { createAzureOcrExtractor, OcrServiceError, toExtractedText } from './azure';
import { createDocumentTextExtractor, TextExtractionError } from './router';
import type { DocumentInput, TextExtractor } from './types';

const image: DocumentInput = {
  kind: 'image',
  bytes: new TextEncoder().encode('fake jpeg'),
  mimeType: 'image/jpeg',
};

const CONTENT = 'Bitte zahlen Sie bis zum 26.10.2026.';
const analyzeResult = {
  content: CONTENT,
  pages: [
    {
      pageNumber: 1,
      width: 1000,
      height: 2000,
      unit: 'pixel',
      words: [
        // "Bitte" at x 100..300, y 200..260
        {
          content: 'Bitte',
          polygon: [100, 200, 300, 200, 300, 260, 100, 260],
          confidence: 0.99,
          span: { offset: 0, length: 5 },
        },
        {
          content: '26.10.2026.',
          polygon: [500, 200, 800, 200, 800, 260, 500, 260],
          confidence: 0.95,
          span: { offset: 25, length: 11 },
        },
      ],
    },
  ],
};

type Step = { status: number; body?: unknown; headers?: Record<string, string> };

function fakeAzure(steps: Step[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let next = 0;
  const fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const step = steps[next++];
    if (!step) throw new Error('unexpected request');
    return new Response(step.body === undefined ? null : JSON.stringify(step.body), {
      status: step.status,
      headers: step.headers,
    });
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

const accepted: Step = {
  status: 202,
  headers: { 'Operation-Location': 'https://x.cognitiveservices.azure.com/result/1' },
};
const options = {
  endpoint: 'https://x.cognitiveservices.azure.com/',
  key: 'secret-key',
  sleep: async () => {},
  pollIntervalMs: 1000,
  timeoutMs: 3000,
};

describe('createAzureOcrExtractor', () => {
  it('starts an analysis, polls until it succeeds and returns text with word boxes', async () => {
    const azure = fakeAzure([
      accepted,
      { status: 200, body: { status: 'running' } },
      { status: 200, body: { status: 'succeeded', analyzeResult } },
    ]);
    const result = await createAzureOcrExtractor({ ...options, fetch: azure.fetch }).extract(image);

    expect(result).toMatchObject({ text: CONTENT, method: 'ocr', pageCount: 1 });
    expect(result.spans[1]).toEqual({
      start: 25,
      end: 36,
      page: 0,
      box: { x: 0.5, y: 0.1, width: expect.closeTo(0.3), height: expect.closeTo(0.03) },
      confidence: 0.95,
    });
    expect(CONTENT.slice(result.spans[1]!.start, result.spans[1]!.end)).toBe('26.10.2026.');

    const [start, poll] = azure.calls;
    expect(start!.url).toBe(
      'https://x.cognitiveservices.azure.com/documentintelligence/documentModels/prebuilt-read:analyze' +
        '?_overload=analyzeDocument&api-version=2024-11-30&stringIndexType=utf16CodeUnit&locale=de',
    );
    expect(start!.init?.headers).toMatchObject({ 'Ocp-Apim-Subscription-Key': 'secret-key' });
    expect(JSON.parse(start!.init?.body as string)).toEqual({ base64Source: btoa('fake jpeg') });
    expect(poll!.url).toBe('https://x.cognitiveservices.azure.com/result/1');
  });

  it.each([
    ['a rejected request', [{ status: 401, body: { error: { code: '401' } } }]],
    ['a failed analysis', [accepted, { status: 200, body: { status: 'failed' } }]],
    ['a polling error', [accepted, { status: 500 }]],
    [
      'a timeout',
      [
        accepted,
        ...Array.from({ length: 5 }, () => ({ status: 200, body: { status: 'running' } })),
      ],
    ],
  ])('throws OcrServiceError on %s', async (_, steps) => {
    const azure = fakeAzure(steps as Step[]);
    await expect(
      createAzureOcrExtractor({ ...options, fetch: azure.fetch }).extract(image),
    ).rejects.toBeInstanceOf(OcrServiceError);
  });

  it('skips words without usable geometry', () => {
    const result = toExtractedText({
      content: 'a b',
      pages: [
        {
          pageNumber: 1,
          width: 0,
          height: 10,
          words: [{ content: 'a', polygon: [0, 0, 1, 1], span: { offset: 0, length: 1 } }],
        },
      ],
    });
    expect(result.spans).toEqual([]);
  });
});

describe('router with a failing OCR service', () => {
  it('reports unavailable, not unreadable', async () => {
    const failing: TextExtractor = {
      name: 'down',
      async extract() {
        throw new OcrServiceError('Azure OCR timed out');
      },
    };
    const router = createDocumentTextExtractor({
      pdf: {
        name: 'pdf',
        extract: async () => ({
          text: '',
          method: 'pdf-text-layer',
          provider: 'p',
          pageCount: 1,
          spans: [],
        }),
      },
      ocr: failing,
    });
    await expect(router.extract(image)).rejects.toEqual(
      expect.objectContaining({ kind: 'unavailable' }),
    );
    await expect(router.extract(image)).rejects.toBeInstanceOf(TextExtractionError);
  });
});
