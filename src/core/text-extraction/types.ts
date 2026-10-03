/**
 * Text extraction from letters (PDF text layer or OCR).
 *
 * `ExtractedText.text` is the single source of truth: the LLM only ever sees this
 * text, and every `source_quote` is verified against it. Providers must not
 * normalize or reorder the text beyond what extraction requires, so that character
 * offsets in `spans` stay valid.
 */

export type DocumentInput =
  | { kind: 'pdf'; bytes: Uint8Array }
  | { kind: 'image'; bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/heic' };

/** Axis-aligned box, normalized to 0..1 relative to the page width and height. */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A word or line of the extracted text, located on the page. Used to highlight a verified quote. */
export interface TextSpan {
  /** Character offsets into `ExtractedText.text`; `start` inclusive, `end` exclusive. */
  start: number;
  end: number;
  /** 0-based page index. */
  page: number;
  box: BoundingBox;
  /** Provider confidence in 0..1. Absent for PDF text layers. */
  confidence?: number;
}

export interface ExtractedText {
  text: string;
  method: 'pdf-text-layer' | 'ocr';
  /** Provider identifier, e.g. 'pdf-text-layer' or 'azure-document-intelligence'. Never contains letter content. */
  provider: string;
  pageCount: number;
  /** May be empty if the provider returns no layout; the UI then falls back to highlighting in a text view. */
  spans: TextSpan[];
}

export interface TextExtractor {
  readonly name: string;
  extract(input: DocumentInput): Promise<ExtractedText>;
}
