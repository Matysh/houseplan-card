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

test('#455 гейт стоит во всех точках, где кадры появляются и принимаются', () => {
  // Проверка вида «файл упоминает модуль» слабая, но здесь она про ПОДКЛЮЧЕНИЕ,
  // а поведение каждой точки закреплено отдельно: golden-policy.test.mjs
  // (съёмка golden), docs-accept.test.mjs (приёмка документации) и прогон CI
  // (сами скрипты). Без этой проверки точку можно тихо отцепить.
  const source = (relative) =>
    readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
  for (const file of [
    'demo/golden/policy.mjs', 'demo/golden/accept.mjs',
    'scripts/docs-accept.mjs', 'scripts/assert-capture-env.mjs',
  ]) {
    assert.match(source(file), /capture-environment\.mjs/, `${file} не подключает гейт среды`);
  }
  // Импорта мало: первая редакция этого теста проходила, когда отказ в
  // accept.mjs заменили на `void foreign` — модуль остался подключён, а гейт
  // перестал существовать. Поэтому проверяется форма ОСТАНОВКИ, а не наличие
  // строки: поведение точек, которые можно запустить на Linux, закреплено в
  // golden-policy.test.mjs и docs-accept.test.mjs, а эти две проверяются на
  // Windows и в CI прогоном самих скриптов.
  // Вызывается именно бросающая обёртка: она останавливает прогон по
  // построению, поэтому «понизить отказ до печати» без правки этой строки
  // нельзя. Первая редакция проверки смотрела лишь на импорт модуля — и
  // молча проходила, когда отказ заменили на `void foreign`.
  assert.match(source('demo/golden/accept.mjs'),
    /assertCaptureEnvironment\(\{ kind: 'golden', stage: 'accept' \}\)/,
    'приёмка golden обязана проверять среду бросающей обёрткой');
  assert.match(source('scripts/docs-accept.mjs'),
    /assertCaptureEnvironment\(\{ kind: 'docs', stage: 'accept' \}\)/,
    'приёмка документации обязана проверять среду');
  // Съёмка документации гейтится шагом раньше, в npm-скрипте: править
  // demo/docs/capture.mjs дорого — его sha записан в индексе скриншотов, и
  // любая правка требует пересъёмки всех картинок (проверено, гейт
  // документации покраснел сразу). Отсюда требование к самому скрипту:
  assert.doesNotMatch(source('demo/docs/capture.mjs'), /capture-environment\.mjs/,
    'demo/docs/capture.mjs трогать нельзя: его sha в индексе скриншотов');
  const packageJson = JSON.parse(source('package.json'));
  assert.match(packageJson.scripts['docs:capture'] || '',
    /assert-capture-env\.mjs docs/,
    'у съёмки документации обязан быть npm-скрипт с проверкой среды');
  // `run.mjs` трогать нельзя: он в корпусе sourceFingerprint, и его правка
  // объявила бы устаревшими бандл, скриншоты документации и индекс эталонов.
  assert.doesNotMatch(source('demo/golden/run.mjs'), /capture-environment\.mjs/,
    'гейт обязан стоять в policy.mjs, а не в фингерпринтуемом run.mjs');
});

test('#455 бросающая обёртка бросает и возвращает разрешённую причину', () => {
  assert.throws(() => assertCaptureEnvironment({ platform: 'win32', allowance: null }),
    /съёмка отказана/);
  assert.equal(assertCaptureEnvironment({ platform: 'linux', allowance: null }), null);
  assert.equal(assertCaptureEnvironment({ platform: 'win32', allowance: 'нет WSL' }), 'нет WSL');
});
