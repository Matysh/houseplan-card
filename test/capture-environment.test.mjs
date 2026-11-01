/**
 * #455: среда съёмки как проверяемое условие.
 *
 * Вопрос владельца был «зачем агенты снимают PNG на Windows, если мы их не
 * принимаем». Ответ оказался «потому что этому ничто не мешало»: ни один из
 * шести скриптов съёмки и приёмки не знал, на какой он ОС, а отказ приёмки
 * говорил про число сцен-свидетелей — то есть подсказывал неверный вывод
 * «надо объявить больше сцен».
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  ALLOW_FOREIGN_ENV, CAPTURE_CANON_PLATFORM, assertCaptureEnvironment, captureEnvironment,
  environmentNote, foreignCaptureAllowance, foreignCaptureRefusal,
} from '../scripts/capture-environment.mjs';

test('#455 канон среды — linux, и чужая платформа получает отказ с командой', () => {
  assert.equal(CAPTURE_CANON_PLATFORM, 'linux');
  assert.equal(foreignCaptureRefusal({ platform: 'linux' }).refusal, null);
  for (const platform of ['win32', 'darwin', '']) {
    const { refusal } = foreignCaptureRefusal({ platform });
    assert.ok(refusal, `${platform} обязан получить отказ`);
    assert.match(refusal, /wsl -d Ubuntu/, 'отказ обязан называть команду, а не только запрет');
    assert.match(refusal, /golden:verify/, 'диагностика законна — это должно быть сказано');
    assert.match(refusal, new RegExp(ALLOW_FOREIGN_ENV), 'осознанный обход должен быть назван');
  }
});

test('#455 текст отказа различает съёмку и приёмку и называет предмет', () => {
  assert.match(foreignCaptureRefusal({ platform: 'win32', stage: 'capture' }).refusal,
    /съёмка отказана: эталоны golden/);
  assert.match(foreignCaptureRefusal({ platform: 'win32', stage: 'accept' }).refusal,
    /приёмка отказана: эталоны golden/);
  assert.match(foreignCaptureRefusal({ platform: 'win32', kind: 'docs' }).refusal,
    /скриншоты документации/);
  assert.match(foreignCaptureRefusal({ platform: 'win32', kind: 'docs' }).refusal,
    /demo\/docs\/capture\.mjs/, 'у документации своя команда');
});

test('#455 обход требует причину, пустая строка причиной не считается', () => {
  assert.equal(foreignCaptureAllowance({}), null);
  assert.equal(foreignCaptureAllowance({ [ALLOW_FOREIGN_ENV]: '   ' }), null);
  assert.equal(foreignCaptureAllowance({ [ALLOW_FOREIGN_ENV]: ' нет WSL ' }), 'нет WSL');
  const allowed = foreignCaptureRefusal({ platform: 'win32', allowance: 'нет WSL' });
  assert.equal(allowed.refusal, null);
  assert.equal(allowed.allowance, 'нет WSL', 'причина обязана доехать до вывода');
  assert.ok(foreignCaptureRefusal({ platform: 'win32', allowance: null }).refusal);
});

test('#455 приписка про среду появляется только при расхождении', () => {
  // Именно этой фразы не хватало отказу «свидетелей 0 из 10».
  assert.equal(environmentNote({ capturedOn: 'linux', acceptedOn: 'linux' }), null);
  assert.equal(environmentNote({ capturedOn: 'win32' }), null, 'без второй стороны сравнивать нечего');
  const note = environmentNote({ capturedOn: 'win32', acceptedOn: 'linux' });
  assert.match(note, /win32/);
  assert.match(note, /не в числе объявленных сцен/,
    'приписка обязана снимать именно неверный вывод про число сцен');
});

test('#455 провенанс среды снимается с процесса, а не выдумывается', () => {
  const environment = captureEnvironment({ platform: 'win32', arch: 'x64' });
  assert.deepEqual(environment, { platform: 'win32', arch: 'x64' });
  assert.equal(typeof captureEnvironment().platform, 'string');
});

test('#455 бросающая обёртка бросает и возвращает разрешённую причину', () => {
  assert.throws(() => assertCaptureEnvironment({ platform: 'win32', allowance: null }),
    /съёмка отказана/);
  assert.equal(assertCaptureEnvironment({ platform: 'linux', allowance: null }), null);
  assert.equal(assertCaptureEnvironment({ platform: 'win32', allowance: 'нет WSL' }), 'нет WSL');
});
