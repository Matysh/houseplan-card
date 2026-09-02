import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DETERMINISTIC_ARGS } from '../demo/docs/browser-args.mjs';

// #424. Съёмка документации давала разные кадры на одном коммите: один-два
// случайных кадра из десяти расходились между прогонами, при этом внутри
// процесса всё было стабильно. Причина — композитор: частичная растеризация
// переиспользует ранее нарисованные куски тайла, а снимок берётся до конца всех
// стадий. Два флага чинят это только вместе; по отдельности ни один не помогает
// (проверено перебором, восемь прогонов на конфигурацию).

test('набор запрещает частичную растеризацию', () => {
  assert.ok(DETERMINISTIC_ARGS.includes('--disable-partial-raster'),
    'без этого флага кадр зависит от того, что композитор рисовал до него');
});

test('набор требует пройти все стадии композитора до отрисовки', () => {
  assert.ok(DETERMINISTIC_ARGS.includes('--run-all-compositor-stages-before-draw'),
    'без этого флага снимок берётся на полпути, и докрутка каждый раз своя');
});

test('прежние флаги детерминизма текста остались на месте', () => {
  // #410 убрал ими основную часть дрейфа; потерять их вместе с правкой #424
  // означало бы разменять одну недетерминированность на другую.
  for (const flag of ['--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text']) {
    assert.ok(DETERMINISTIC_ARGS.includes(flag), flag);
  }
});

test('съёмка берёт набор из этого модуля, а не объявляет свой', () => {
  // Иначе тест стерёг бы константу, которой никто не пользуется.
  const source = readFileSync(new URL('../demo/docs/capture.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ DETERMINISTIC_ARGS \} from '\.\/browser-args\.mjs'/);
  assert.doesNotMatch(source, /const DETERMINISTIC_ARGS\s*=/,
    'собственное объявление в capture.mjs разошлось бы с проверяемым набором');
});
