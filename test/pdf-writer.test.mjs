import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { measurePdfText, writePdf } from '../test-build/pdf/pdf-writer.js';

const now = new Date('2026-09-07T10:00:00.000Z');

test('PDF writer emits a deterministic parseable A4 document with extractable Cyrillic', async () => {
  const page = {
    width: 595.28, height: 841.89, now,
    commands: [
      { kind: 'path', rings: [[[40, 40], [200, 40], [200, 160], [40, 160]]],
        fill: [0.5, 0.5, 0.5], stroke: [0, 0, 0], width: 0.7 },
      { kind: 'text', x: 120, y: 100, text: 'Кухня · Scale 1:50', size: 12, align: 'center' },
    ],
  };
  const first = writePdf(page);
  const second = writePdf(page);
  assert.deepEqual(first, second);
  assert.match(new TextDecoder('latin1').decode(first), /CIDFontType2/);
  assert.match(new TextDecoder('latin1').decode(first), /ToUnicode/);
  const task = getDocument({ data: first, useWorkerFetch: false, isEvalSupported: false });
  const document = await task.promise;
  assert.equal(document.numPages, 1);
  const content = await (await document.getPage(1)).getTextContent();
  assert.match(content.items.map((item) => item.str).join(''), /Кухня/);
  await task.destroy();
});

test('embedded font exposes proportional text metrics', () => {
  assert.ok(measurePdfText('WW', 10) > measurePdfText('ii', 10));
});

test('JPEG images keep independent opacity resources', () => {
  const bytes = writePdf({
    width: 595.28, height: 841.89, now,
    images: [
      { id: 'a', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 },
      { id: 'b', bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 1, height: 1 },
    ],
    commands: [
      { kind: 'image', imageId: 'a', x: 20, y: 30, width: 100, height: 50, opacity: 0.25 },
      { kind: 'image', imageId: 'b', x: 200, y: 30, width: 40, height: 80, opacity: 0.6 },
    ],
  });
  const raw = new TextDecoder('latin1').decode(bytes);
  assert.match(raw, /DCTDecode/);
  assert.match(raw, /\/ca 0\.25/);
  assert.match(raw, /\/ca 0\.6/);
});
