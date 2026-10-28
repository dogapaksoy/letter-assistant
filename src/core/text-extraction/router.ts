import type { DocumentInput, ExtractedText, TextExtractor } from './types';

/** Below this many non-space characters a PDF text layer is treated as missing (scan). */
export const MIN_TEXT_LAYER_CHARS = 50;

export class TextExtractionError extends Error {
  constructor(
    /** 'unavailable': the OCR service failed or timed out (temporary, not the document's fault). */
    readonly kind: 'ocr_not_configured' | 'unreadable' | 'unavailable',
    message: string,
  ) {
    super(message);
    this.name = 'TextExtractionError';
  }
}

/**
 * Picks the text source per document: the PDF text layer when it has real text, OCR
 * for photos and scanned PDFs. OCR is optional until a provider is chosen.
 */
export function createDocumentTextExtractor(sources: {
  pdf: TextExtractor;
  ocr?: TextExtractor;
}): TextExtractor {
  const ocrOrFail = async (input: DocumentInput): Promise<ExtractedText> => {
    if (!sources.ocr) {
      throw new TextExtractionError('ocr_not_configured', 'No OCR provider is configured');
    }
    try {
      return await sources.ocr.extract(input);
    } catch {
      throw new TextExtractionError('unavailable', 'The OCR service is unavailable');
    }
  };

  return {
    name: 'document-router',
    async extract(input: DocumentInput): Promise<ExtractedText> {
      let result: ExtractedText;
      if (input.kind === 'pdf') {
        let layer: ExtractedText | undefined;
        try {
          layer = await sources.pdf.extract(input);
        } catch {
          throw new TextExtractionError('unreadable', 'The PDF could not be read');
        }
        result = hasEnoughText(layer.text) ? layer : await ocrOrFail(input);
      } else {
        result = await ocrOrFail(input);
      }

      if (!hasEnoughText(result.text)) {
        throw new TextExtractionError('unreadable', 'No readable text found');
      }
      return result;
    },
  };
}

function hasEnoughText(text: string): boolean {
  return text.replace(/\s/g, '').length >= MIN_TEXT_LAYER_CHARS;
}
