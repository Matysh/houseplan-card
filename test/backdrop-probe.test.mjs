// #39: header-level raster diagnostics. Every case here proves the parser
// works on BYTES ONLY — no canvas, no ImageBitmap, no allocation sized by the
// file. Fixtures are handcrafted headers a few dozen bytes long even when they
// claim a 400-megapixel image.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HARD_DIMENSION, WARN_DECODED_BYTES, DOWNSCALE_TARGET_PX,
  downscaleDimensions, probeBackdrop,
} from '../test-build/backdrop-probe.js';

const u32 = (value) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const u16 = (value) => [(value >>> 8) & 255, value & 255];
const asciiBytes = (text) => [...text].map((ch) => ch.charCodeAt(0));

const png = (width, height, { colourType = 2, chunks = [] } = {}) => Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ...u32(13), ...asciiBytes('IHDR'),
  ...u32(width), ...u32(height),
  8, colourType, 0, 0, 0,
  ...u32(0), // IHDR CRC (не проверяется парсером)
  ...chunks,
  ...u32(0), ...asciiBytes('IEND'), ...u32(0),
]);
const pngChunk = (type, length, payload = []) => [
  ...u32(length), ...asciiBytes(type), ...payload, ...u32(0),
];

const jpeg = (width, height, { progressive = false } = {}) => Uint8Array.from([
  0xff, 0xd8,
  0xff, 0xe0, ...u16(16), ...asciiBytes('JFIF\0'), 1, 1, 0, ...u16(1), ...u16(1), 0, 0,
  0xff, progressive ? 0xc2 : 0xc0, ...u16(11), 8, ...u16(height), ...u16(width), 1, 0x11, 0,
]);

const webpVp8x = (width, height, { alpha = false } = {}) => {
  const w = width - 1, h = height - 1;
  return Uint8Array.from([
    ...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP'),
    ...asciiBytes('VP8X'), 10, 0, 0, 0,
    alpha ? 0x10 : 0x00, 0, 0, 0,
    w & 255, (w >> 8) & 255, (w >> 16) & 255,
    h & 255, (h >> 8) & 255, (h >> 16) & 255,
  ]);
};
const webpVp8 = (width, height) => Uint8Array.from([
  ...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP'),
  ...asciiBytes('VP8 '), 0, 0, 0, 0,
  0, 0, 0, 0x9d, 0x01, 0x2a,
  width & 255, (width >> 8) & 255, height & 255, (height >> 8) & 255,
]);
const webpVp8l = (width, height, { alpha = false } = {}) => {
  const raw = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14) | ((alpha ? 1 : 0) << 28);
  return Uint8Array.from([
    ...asciiBytes('RIFF'), 0, 0, 0, 0, ...asciiBytes('WEBP'),
    ...asciiBytes('VP8L'), 0, 0, 0, 0,
    0x2f, raw & 255, (raw >> 8) & 255, (raw >> 16) & 255, (raw >>> 24) & 255,
    0, 0, 0, 0, 0,
  ]);
};

test('пороги: безопасно / предупреждение / жёсткий отказ (#39 AC1)', () => {
  // ровно на границе 128 МиБ: 5792×5792×4 = 134 189 056 < 134 217 728
  const safeSide = 5792;
  assert.equal(probeBackdrop(png(safeSide, safeSide), 'png').kind, 'safe');
  // +1 по стороне переваливает порог
  const warn = probeBackdrop(png(safeSide + 1, safeSide + 1), 'png');
  assert.equal(warn.kind, 'warn');
  assert.equal(warn.decodedBytes, (safeSide + 1) ** 2 * 4);
  assert.ok(warn.decodedBytes > WARN_DECODED_BYTES);
  // ровно 16384 по стороне — ещё не hard (порог строгий), а 16384×100 мал по памяти
  assert.equal(probeBackdrop(png(HARD_DIMENSION, 100), 'png').kind, 'safe');
  assert.equal(probeBackdrop(png(HARD_DIMENSION + 1, 100), 'png').kind, 'hard');
  assert.equal(probeBackdrop(png(100, HARD_DIMENSION + 1), 'png').kind, 'hard');
});

test('PNG: alpha по colour type и по tRNS (#39 AC2-вход)', () => {
  assert.equal(probeBackdrop(png(6000, 6000, { colourType: 6 }), 'png').alpha, true);
  assert.equal(probeBackdrop(png(6000, 6000, { colourType: 4 }), 'png').alpha, true);
  assert.equal(probeBackdrop(png(6000, 6000, { colourType: 2 }), 'png').alpha, false);
  const trns = png(6000, 6000, { colourType: 3, chunks: pngChunk('tRNS', 1, [0]) });
  assert.equal(probeBackdrop(trns, 'png').alpha, true);
  const idatFirst = png(6000, 6000, {
    colourType: 3, chunks: [...pngChunk('IDAT', 2, [0, 0]), ...pngChunk('tRNS', 1, [0])],
  });
  assert.equal(probeBackdrop(idatFirst, 'png').alpha, false, 'после IDAT tRNS не ищем');
});

test('JPEG: baseline и progressive SOF, alpha всегда false', () => {
  const base = probeBackdrop(jpeg(9000, 7000), 'jpg');
  assert.deepEqual([base.width, base.height, base.alpha], [9000, 7000, false]);
  const prog = probeBackdrop(jpeg(6500, 6500, { progressive: true }), 'jpg');
  assert.equal(prog.kind, 'warn');
});

test('WebP: VP8X с alpha-флагом, lossy VP8, lossless VP8L', () => {
  const x = probeBackdrop(webpVp8x(8000, 8000, { alpha: true }), 'webp');
  assert.deepEqual([x.width, x.height, x.alpha, x.kind], [8000, 8000, true, 'warn']);
  const lossy = probeBackdrop(webpVp8(4000, 3000), 'webp');
  assert.deepEqual([lossy.width, lossy.height, lossy.kind], [4000, 3000, 'safe']);
  const lossless = probeBackdrop(webpVp8l(6100, 6100, { alpha: true }), 'webp');
  assert.deepEqual([lossless.width, lossless.alpha, lossless.kind], [6100, true, 'warn']);
});

test('битые и враждебные заголовки → unknown, никогда не исключение (#39 AC6, security)', () => {
  const hostile = [
    ['png', new Uint8Array(0)],
    ['png', png(6000, 6000).slice(0, 20)], // усечён посреди IHDR
    ['png', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])],
    ['png', png(0, 6000)], // нулевая ширина
    ['png', png(0x7fffffff, 0x7fffffff)], // неправдоподобные стороны
    ['jpg', Uint8Array.from([0xff, 0xd8, 0xff, 0xda, 0, 4, 0, 0])], // SOS до SOF
    ['jpg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 1])], // длина сегмента < 2
    ['jpg', jpeg(9000, 7000).slice(0, 22)], // обрезан до SOF-полей
    ['webp', Uint8Array.from(asciiBytes('RIFF....WEBPVP8X'))], // огрызок VP8X
    ['webp', webpVp8(4000, 3000).slice(0, 24)],
    ['gif', Uint8Array.from(asciiBytes('GIF89a'))], // не поддерживаемый ext
  ];
  for (const [ext, bytes] of hostile) {
    const probe = probeBackdrop(bytes, ext);
    assert.equal(probe.kind, 'unknown', `${ext}/${bytes.length}B`);
    assert.equal(probe.decodedBytes, null);
  }
  // враждебная длина чанка не мешает вердикту по IHDR
  const evil = png(6000, 6000, { colourType: 2, chunks: pngChunk('iTXt', 0xffffffff >>> 0) });
  assert.equal(probeBackdrop(evil, 'png').kind, 'warn');
});

test('downscaleDimensions: aspect и цель (#39 AC2)', () => {
  assert.deepEqual(downscaleDimensions(10000, 5000), { width: DOWNSCALE_TARGET_PX, height: 2048 });
  assert.deepEqual(downscaleDimensions(3000, 2000), { width: 3000, height: 2000 }, 'меньше цели — не трогаем');
  assert.deepEqual(downscaleDimensions(5000, 10000), { width: 2048, height: DOWNSCALE_TARGET_PX });
});
