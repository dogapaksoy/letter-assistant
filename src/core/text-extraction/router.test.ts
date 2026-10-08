import { createDocumentTextExtractor, TextExtractionError } from './router';
import type { DocumentInput, ExtractedText, TextExtractor } from './types';

const LONG_TEXT = 'Bitte zahlen Sie den Betrag von 412,00 Euro spätestens am 26.10.2026.';

function extractor(
  name: string,
  result: Partial<ExtractedText> | Error,
): TextExtractor & {
  calls: DocumentInput[];
} {
  const calls: DocumentInput[] = [];
  return {
    name,
    calls,
    async extract(input) {
      calls.push(input);
      if (result instanceof Error) throw result;
      return { text: '', method: 'ocr', provider: name, pageCount: 1, spans: [], ...result };
    },
  };
}

const pdf: DocumentInput = { kind: 'pdf', bytes: new Uint8Array([1]) };
const image: DocumentInput = { kind: 'image', bytes: new Uint8Array([1]), mimeType: 'image/jpeg' };

describe('createDocumentTextExtractor', () => {
  it('uses the PDF text layer when it contains real text', async () => {
    const layer = extractor('pdf', { text: LONG_TEXT, method: 'pdf-text-layer' });
    const ocr = extractor('ocr', { text: 'ocr text that should not be used at all here' });
    const result = await createDocumentTextExtractor({ pdf: layer, ocr }).extract(pdf);

    expect(result).toMatchObject({ text: LONG_TEXT, method: 'pdf-text-layer' });
    expect(ocr.calls).toHaveLength(0);
  });

  it('falls back to OCR for scanned PDFs without a text layer', async () => {
    const layer = extractor('pdf', { text: '  \n ', method: 'pdf-text-layer' });
    const ocr = extractor('ocr', { text: LONG_TEXT });
    const result = await createDocumentTextExtractor({ pdf: layer, ocr }).extract(pdf);

    expect(result).toMatchObject({ text: LONG_TEXT, method: 'ocr' });
    expect(ocr.calls).toEqual([pdf]);
  });

  it('sends photos to OCR', async () => {
    const ocr = extractor('ocr', { text: LONG_TEXT });
    const result = await createDocumentTextExtractor({ pdf: extractor('pdf', {}), ocr }).extract(
      image,
    );
    expect(result.method).toBe('ocr');
  });

  it('reports ocr_not_configured for photos and scans when there is no OCR provider', async () => {
    const router = createDocumentTextExtractor({ pdf: extractor('pdf', { text: '' }) });
    await expect(router.extract(image)).rejects.toMatchObject({ kind: 'ocr_not_configured' });
    await expect(router.extract(pdf)).rejects.toBeInstanceOf(TextExtractionError);
  });

  it('reports unreadable for broken PDFs and text-less results', async () => {
    const broken = createDocumentTextExtractor({ pdf: extractor('pdf', new Error('bad xref')) });
    await expect(broken.extract(pdf)).rejects.toMatchObject({ kind: 'unreadable' });

    const empty = createDocumentTextExtractor({
      pdf: extractor('pdf', {}),
      ocr: extractor('ocr', { text: 'kaum' }),
    });
    await expect(empty.extract(image)).rejects.toMatchObject({ kind: 'unreadable' });
  });
});
