// Runs with `npm run test:node` (node:test), not Jest: pdf.js does not work inside
// Jest's module sandbox.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createPdfTextExtractor } from './pdf';

/** Builds a minimal one-page PDF with one line of text (Helvetica, ASCII only). */
function minimalPdf(line: string): Uint8Array {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}

describe('createPdfTextExtractor', () => {
  it('reads the text layer of a digital PDF', async () => {
    const line = 'Bitte zahlen Sie bis zum 26.10.2026 den Betrag von 412,00 Euro.';
    const result = await createPdfTextExtractor().extract({ kind: 'pdf', bytes: minimalPdf(line) });

    assert.equal(result.method, 'pdf-text-layer');
    assert.equal(result.pageCount, 1);
    assert.equal(result.text.trim(), line);
  });

  it('rejects broken PDFs', async () => {
    await assert.rejects(
      createPdfTextExtractor().extract({
        kind: 'pdf',
        bytes: new TextEncoder().encode('not a pdf'),
      }),
    );
  });

  it('rejects input that is not a PDF', async () => {
    await assert.rejects(
      createPdfTextExtractor().extract({
        kind: 'image',
        bytes: new Uint8Array([1]),
        mimeType: 'image/png',
      }),
    );
  });
});
