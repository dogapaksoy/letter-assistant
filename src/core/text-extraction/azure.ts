import type { BoundingBox, DocumentInput, ExtractedText, TextExtractor, TextSpan } from './types';

/**
 * OCR with Azure AI Document Intelligence ("prebuilt-read", REST API 2024-11-30).
 * Configure a resource in an EU region (e.g. Germany West Central). The document is sent
 * for analysis and not stored by this app; check the service's data handling terms.
 *
 * Word spans use UTF-16 offsets, so they index straight into the returned text, and word
 * polygons give the boxes used to highlight a quote on the photo.
 */

export interface AzureOcrOptions {
  /** e.g. https://<resource>.cognitiveservices.azure.com */
  endpoint: string;
  key: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

const API_VERSION = '2024-11-30';

interface AzureWord {
  content: string;
  polygon?: number[];
  confidence?: number;
  span: { offset: number; length: number };
}

interface AzurePage {
  pageNumber: number;
  width?: number;
  height?: number;
  words?: AzureWord[];
}

interface AzureResult {
  status: string;
  analyzeResult?: { content: string; pages?: AzurePage[] };
}

export class OcrServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrServiceError';
  }
}

export function createAzureOcrExtractor(options: AzureOcrOptions): TextExtractor {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const endpoint = options.endpoint.replace(/\/+$/, '');
  const headers = { 'Ocp-Apim-Subscription-Key': options.key };

  return {
    name: 'azure-document-intelligence',
    async extract(input: DocumentInput): Promise<ExtractedText> {
      const url =
        `${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze` +
        `?_overload=analyzeDocument&api-version=${API_VERSION}&stringIndexType=utf16CodeUnit&locale=de`;
      const started = await doFetch(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Source: toBase64(input.bytes) }),
      });
      const operation = started.headers.get('operation-location');
      if (started.status !== 202 || !operation) {
        throw new OcrServiceError(`Azure OCR request failed (HTTP ${started.status})`);
      }

      for (let waited = 0; waited <= timeoutMs; waited += pollIntervalMs) {
        await sleep(pollIntervalMs);
        const response = await doFetch(operation, { headers });
        if (!response.ok) {
          throw new OcrServiceError(`Azure OCR polling failed (HTTP ${response.status})`);
        }
        const result = (await response.json()) as AzureResult;
        if (result.status === 'succeeded' && result.analyzeResult) {
          return toExtractedText(result.analyzeResult);
        }
        if (result.status === 'failed' || result.status === 'canceled') {
          throw new OcrServiceError(`Azure OCR ${result.status}`);
        }
      }
      throw new OcrServiceError('Azure OCR timed out');
    },
  };
}

/** Converts Azure's result; exported for tests. */
export function toExtractedText(result: { content: string; pages?: AzurePage[] }): ExtractedText {
  const pages = result.pages ?? [];
  const spans: TextSpan[] = pages.flatMap((page) =>
    (page.words ?? []).flatMap((word) => {
      const box = normalizedBox(word.polygon, page.width, page.height);
      if (!box) return [];
      return [
        {
          start: word.span.offset,
          end: word.span.offset + word.span.length,
          page: page.pageNumber - 1,
          box,
          ...(word.confidence !== undefined && { confidence: word.confidence }),
        },
      ];
    }),
  );
  return {
    text: result.content,
    method: 'ocr',
    provider: 'azure-document-intelligence',
    pageCount: pages.length,
    spans,
  };
}

/** Polygon (x1,y1,x2,y2,...) in page units -> axis-aligned box in 0..1 of the page. */
function normalizedBox(
  polygon: number[] | undefined,
  width: number | undefined,
  height: number | undefined,
): BoundingBox | null {
  if (!polygon || polygon.length < 4 || !width || !height) return null;
  const xs = polygon.filter((_, i) => i % 2 === 0);
  const ys = polygon.filter((_, i) => i % 2 === 1);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  const x = clamp(Math.min(...xs) / width);
  const y = clamp(Math.min(...ys) / height);
  return {
    x,
    y,
    width: clamp(Math.max(...xs) / width) - x,
    height: clamp(Math.max(...ys) / height) - y,
  };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
