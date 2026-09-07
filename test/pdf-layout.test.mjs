import test from 'node:test';
import assert from 'node:assert/strict';
import {
  centerPdfScene, pdfBoundsHeight, pdfBoundsWidth, pdfCommandBounds, pdfSceneFits,
  translatePdfCommands,
} from '../test-build/pdf/pdf-layout.js';
import { measurePdfText } from '../test-build/pdf/pdf-writer.js';
import {
  PDF_FONT_ASCENT, PDF_FONT_DESCENT, PDF_FONT_UNITS_PER_EM,
} from '../test-build/pdf/pdf-font.generated.js';

const close = (actual, expected, epsilon = 1e-8) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('full PDF scene bbox includes path stroke, rotated text, vector controls and image', () => {
  const commands = [
    { kind: 'path', rings: [[[10, 10], [30, 10], [30, 20], [10, 20]]],
      stroke: [0, 0, 0], width: 2 },
    { kind: 'text', x: 42, y: 18, text: '12.34 m', size: 7, angle: 90, align: 'center' },
    { kind: 'vector', ops: [
      { op: 'M', x: 2, y: 3 },
      { op: 'C', x1: 4, y1: 1, x2: 7, y2: 8, x: 9, y: 6 },
    ], stroke: [0, 0, 0], width: 1 },
    { kind: 'image', imageId: 'bg', x: 50, y: 10, width: 8, height: 4, angle: 30 },
  ];
  const bounds = pdfCommandBounds(commands);
  assert.ok(bounds.minX <= 1.5, 'vector stroke is included');
  assert.ok(bounds.maxX > 58, 'rotated image extent is included');
  assert.ok(bounds.maxY >= 21, 'path stroke is included');
});

test('scene bounds use the writer text transform for arbitrary rotated alignment', () => {
  const text = {
    kind: 'text', x: 91, y: 47, text: 'Rotated label', size: 9, angle: 37, align: 'right',
  };
  const width = measurePdfText(text.text, text.size);
  const ascent = PDF_FONT_ASCENT * text.size / PDF_FONT_UNITS_PER_EM;
  const descent = PDF_FONT_DESCENT * text.size / PDF_FONT_UNITS_PER_EM;
  const radians = text.angle * Math.PI / 180;
  const cos = Math.cos(radians), sin = Math.sin(radians);
  const corners = [0, width].flatMap((along) => [descent, ascent].map((vertical) => ({
    x: text.x + cos * (along - width) - sin * vertical,
    y: text.y - sin * (along - width) - cos * vertical,
  })));
  const expected = {
    minX: Math.min(...corners.map(({ x }) => x)),
    minY: Math.min(...corners.map(({ y }) => y)),
    maxX: Math.max(...corners.map(({ x }) => x)),
    maxY: Math.max(...corners.map(({ y }) => y)),
  };
  const actual = pdfCommandBounds([text]);
  close(actual.minX, expected.minX);
  close(actual.minY, expected.minY);
  close(actual.maxX, expected.maxX);
  close(actual.maxY, expected.maxY);
  assert.ok(actual.minX < text.x && actual.minY < text.y && actual.maxY > text.y,
    'rotation happens around the real right-aligned baseline anchor');
});

test('centering translates every command as one scene and preserves its size', () => {
  const commands = [
    { kind: 'path', rings: [[[0, 0], [40, 0], [40, 20], [0, 20]]], fill: [0.5, 0.5, 0.5] },
    { kind: 'line', points: [[-8, 0], [-8, 20]], stroke: [0, 0, 0], width: 1 },
    { kind: 'text', x: 50, y: 10, text: 'R1 12.34 m', size: 7 },
  ];
  const before = pdfCommandBounds(commands);
  const field = { minX: 100, minY: 40, maxX: 300, maxY: 180 };
  const centered = centerPdfScene(commands, field);
  close(pdfBoundsWidth(centered.bounds), pdfBoundsWidth(before));
  close(pdfBoundsHeight(centered.bounds), pdfBoundsHeight(before));
  close((centered.bounds.minX + centered.bounds.maxX) / 2, 200);
  close((centered.bounds.minY + centered.bounds.maxY) / 2, 110);
  assert.equal(centered.commands[0].kind, 'path');
  assert.equal(centered.commands[1].kind, 'line');
  assert.equal(centered.commands[2].kind, 'text');
});

test('scene translation keeps page-anchored hatch phase identical across physical components', () => {
  const pageHatchLines = [
    [[-100, 0], [100, 200]],
    [[-90, 0], [110, 200]],
  ];
  const commands = [
    { kind: 'path', rings: [[[10, 10], [20, 10], [20, 20], [10, 20]]],
      fill: [0.5, 0.5, 0.5], hatch: { lines: pageHatchLines, stroke: [0, 0, 0], width: 0.5 } },
    { kind: 'path', rings: [[[30, 30], [40, 30], [40, 40], [30, 40]]],
      fill: [0.5, 0.5, 0.5], hatch: { lines: pageHatchLines, stroke: [0, 0, 0], width: 0.5 } },
  ];
  const translated = translatePdfCommands(commands, 37, 51);

  assert.deepEqual(translated[0].rings[0][0], [47, 61]);
  assert.deepEqual(translated[1].rings[0][0], [67, 81]);
  assert.strictEqual(translated[0].hatch.lines, pageHatchLines);
  assert.strictEqual(translated[1].hatch.lines, pageHatchLines);
  assert.deepEqual(translated[0].hatch.lines, translated[1].hatch.lines,
    'separate physical components keep one common page-origin hatch phase');
});

test('scene fit compares full bbox against the printable field with tolerance', () => {
  const field = { minX: 10, minY: 20, maxX: 110, maxY: 80 };
  assert.equal(pdfSceneFits({ minX: -4, minY: 2, maxX: 96, maxY: 62 }, field, 0), true);
  assert.equal(pdfSceneFits({ minX: 0, minY: 0, maxX: 100.4, maxY: 60 }, field, 0.5), true);
  assert.equal(pdfSceneFits({ minX: 0, minY: 0, maxX: 100.6, maxY: 60 }, field, 0.5), false);
});
