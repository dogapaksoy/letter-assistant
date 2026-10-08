import type { DocumentInput, ExtractedText, TextExtractor } from './types';

/**
 * Reads the text layer of a digital PDF (no OCR). Scanned PDFs have no or almost no
 * text layer; the router falls back to OCR for those.
 *
 * Layout spans are not extracted yet, so highlighting uses the text view.
 */
export function createPdfTextExtractor(): TextExtractor {
  return {
    name: 'pdf-text-layer',
    async extract(input: DocumentInput): Promise<ExtractedText> {
      if (input.kind !== 'pdf') throw new Error('pdf-text-layer only reads PDFs');
      // Loaded lazily: pdf.js is large and only needed for PDF uploads.
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(input.bytes);
      const { totalPages, text } = await extractText(pdf, { mergePages: true });
      return {
        text,
        method: 'pdf-text-layer',
        provider: 'unpdf',
        pageCount: totalPages,
        spans: [],
      };
    },
  };
}
