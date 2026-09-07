import test from 'node:test';
import assert from 'node:assert/strict';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  measurePdfText, pdfTextBounds, writePdf,
} from '../test-build/pdf/pdf-writer.js';
import {
  PDF_FONT_ASCENT, PDF_FONT_DESCENT, PDF_FONT_UNITS_PER_EM,
} from '../test-build/pdf/pdf-font.generated.js';

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

test('text bounds use the embedded ascent/descent around the emitted baseline', () => {
  const command = { kind: 'text', x: 30, y: 70, text: 'Width', size: 12 };
  const width = measurePdfText(command.text, command.size);
  const ascent = PDF_FONT_ASCENT * command.size / PDF_FONT_UNITS_PER_EM;
  const descent = PDF_FONT_DESCENT * command.size / PDF_FONT_UNITS_PER_EM;
  assert.deepEqual(pdfTextBounds(command), {
    minX: command.x,
    minY: command.y - ascent,
    maxX: command.x + width,
    maxY: command.y - descent,
  });
});

test('centered vertical text bounds handle both rotations about the real baseline anchor', () => {
  const base = { kind: 'text', x: 42, y: 80, text: '12.34 m', size: 7, align: 'center' };
  const width = measurePdfText(base.text, base.size);
  const ascent = PDF_FONT_ASCENT * base.size / PDF_FONT_UNITS_PER_EM;
  const descent = PDF_FONT_DESCENT * base.size / PDF_FONT_UNITS_PER_EM;
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10,
    `${actual} != ${expected}`);

  const clockwise = pdfTextBounds({ ...base, angle: 90 });
  close(clockwise.minX, base.x - ascent);
  close(clockwise.maxX, base.x - descent);
  close(clockwise.minY, base.y - width / 2);
  close(clockwise.maxY, base.y + width / 2);

  const counterClockwise = pdfTextBounds({ ...base, angle: -90 });
  close(counterClockwise.minX, base.x + descent);
  close(counterClockwise.maxX, base.x + ascent);
  close(counterClockwise.minY, base.y - width / 2);
  close(counterClockwise.maxY, base.y + width / 2);
});

test('emitted vertical Tm uses the same centered baseline as text bounds', () => {
  const command = {
    kind: 'text', x: 42, y: 80, text: '12.34 m', size: 7, angle: 90, align: 'center',
  };
  const width = measurePdfText(command.text, command.size);
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10,
    `${actual} != ${expected}`);

  const page = { width: 200, height: 200, now, commands: [command] };
  const raw = new TextDecoder('latin1').decode(writePdf(page));
  const tm = raw.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm/);
  assert.ok(tm, 'the text matrix is emitted');
  assert.deepEqual(tm.slice(1, 5).map(Number), [0, 1, -1, 0]);
  close(Number(tm[5]), command.x);
  assert.ok(Math.abs(Number(tm[6]) - (page.height - command.y - width / 2)) <= 0.005,
    'the serialized Tm starts at the same aligned baseline used by the bounds helper');
});

test('emitted angled right-aligned Tm rotates about the command anchor', () => {
  const command = {
    kind: 'text', x: 91, y: 47, text: 'Rotated label', size: 9, angle: 37, align: 'right',
  };
  const width = measurePdfText(command.text, command.size);
  const radians = command.angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const page = { width: 200, height: 200, now, commands: [command] };
  const raw = new TextDecoder('latin1').decode(writePdf(page));
  const tm = raw.match(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm/);
  assert.ok(tm, 'the angled text matrix is emitted');
  const actual = tm.slice(1).map(Number);
  const expected = [
    cos, sin, -sin, cos,
    command.x - cos * width,
    page.height - command.y - sin * width,
  ];
  expected.forEach((value, index) => assert.ok(Math.abs(actual[index] - value) <= 0.005,
    `Tm[${index}] ${actual[index]} != ${value}`));
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

test('path colors retain 8-bit precision without changing coordinate rounding', () => {
  const bytes = writePdf({
    width: 200, height: 200, now,
    commands: [{
      kind: 'path',
      rings: [[[10.1234, 20.1234], [30.129, 20.1234], [30.129, 40.129]]],
      fill: [127 / 255, 127 / 255, 127 / 255],
    }],
  });
  const raw = new TextDecoder('latin1').decode(bytes);
  assert.match(raw, /0\.498039 0\.498039 0\.498039 rg/);
  assert.match(raw, /10\.12 179\.88 m\n30\.13 179\.88 l\n30\.13 159\.87 l/);
  assert.doesNotMatch(raw, /10\.1234 179\.8766 m/);
});

test('hatched paths use an even-odd clip and draw their border above page-anchored hatch lines', async () => {
  const page = {
    width: 200, height: 200, now,
    commands: [{
      kind: 'path',
      rings: [
        [[20, 20], [180, 20], [180, 180], [20, 180]],
        [[70, 70], [130, 70], [130, 130], [70, 130]],
      ],
      fill: [127 / 255, 127 / 255, 127 / 255],
      stroke: [0, 0, 0],
      width: 1,
      hatch: {
        lines: [
          [[0, 0], [200, 200]],
          [[-20, 20], [180, 220]],
        ],
        stroke: [0.2, 0.2, 0.2],
        width: 0.3,
      },
    }],
  };
  const first = writePdf(page);
  const second = writePdf(page);
  assert.deepEqual(first, second);

  const raw = new TextDecoder('latin1').decode(first);
  const clipIndex = raw.indexOf('W*\nn');
  const hatchIndex = raw.indexOf('0 200 m\n200 0 l', clipIndex);
  const borderIndex = raw.indexOf('0 0 0 RG 1 w', hatchIndex);
  assert.ok(clipIndex >= 0, 'expected an even-odd clipping path');
  assert.ok(hatchIndex > clipIndex, 'expected explicit page-coordinate hatch lines after the clip');
  assert.ok(borderIndex > hatchIndex, 'expected the wall border to be drawn after the hatch');

  const task = getDocument({ data: first, useWorkerFetch: false, isEvalSupported: false });
  const document = await task.promise;
  assert.equal(document.numPages, 1);
  await task.destroy();
});

test('compound vectors support deterministic even-odd fill without a stroke', async () => {
  const page = {
    width: 100, height: 100, now,
    commands: [{
      kind: 'vector',
      ops: [
        { op: 'M', x: 10, y: 10 }, { op: 'L', x: 90, y: 10 },
        { op: 'L', x: 90, y: 90 }, { op: 'L', x: 10, y: 90 }, { op: 'Z' },
        { op: 'M', x: 30, y: 30 }, { op: 'L', x: 70, y: 30 },
        { op: 'L', x: 70, y: 70 }, { op: 'L', x: 30, y: 70 }, { op: 'Z' },
      ],
      fill: [0.1, 0.2, 0.3],
      width: 0,
      fillRule: 'evenodd',
    }],
  };
  const bytes = writePdf(page);
  const raw = new TextDecoder('latin1').decode(bytes);
  assert.match(raw, /0\.1 0\.2 0\.3 rg[\s\S]*\nf\*\nQ/);
  assert.doesNotMatch(raw, /0\.1 0\.2 0\.3 RG/);

  const task = getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false });
  const document = await task.promise;
  assert.equal(document.numPages, 1);
  await task.destroy();
});
