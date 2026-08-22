import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';

import { verifyDocsCandidate } from '../scripts/docs-accept.mjs';
import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from '../demo/docs/screenshots.mjs';

// Приёмка — единственное место, где картинки попадают в репозиторий, поэтому
// проверяется не «работает ли она», а от чего именно отказывается. Половина
// принятого набора хуже непринятого: на плане окажется картинка от одного
// дерева рядом с манифестом от другого.

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const FINGERPRINT = 'f'.repeat(64);
const SCRIPT_SHA = 'a'.repeat(64);
const bytesOf = (id) => Buffer.from(`картинка ${id}`);

const candidate = (overrides = {}) => {
  const scenarios = {};
  for (const scenario of DOC_SCREENSHOTS) {
    scenarios[scenario.id] = {
      file: scenario.file,
      viewport: scenario.viewport,
      theme: scenario.theme,
      language: scenario.language,
      sourceSha256: FINGERPRINT,
      imageSha256: sha256(bytesOf(scenario.id)),
    };
  }
  return {
    version: DOC_SCREENSHOT_VERSION,
    fixture: 'synthetic-only',
    chromium: 'Chromium 151.0.7922.34',
    sourceFingerprint: FINGERPRINT,
    captureScriptSha256: SCRIPT_SHA,
    command: 'npm run build && node demo/docs/capture.mjs',
    scenarios,
    ...overrides,
  };
};

// Разделитель зависит от платформы, а фикстура — нет (#247). `resolve()` на
// Windows отдаёт `C:\\artifact\\01-view-desktop.png`, и разбор только по «/»
// возвращал весь путь целиком: `idOf` давал undefined, синтетический хэш не
// сходился, и три проверки краснели на верной реализации. Linux этого не ловил
// вовсе — поэтому ниже отдельный тест на сам разбор.
export const basename = (path) => String(path).split(/[\\/]/).filter(Boolean).pop() ?? '';

const idOf = (path) => {
  const file = basename(path);
  return DOC_SCREENSHOTS.find((scenario) => scenario.file === file)?.id;
};

const verify = (manifest, { missing = null } = {}) => verifyDocsCandidate({
  root: '/repo',
  from: '/artifact',
  manifest,
  expectedFingerprint: FINGERPRINT,
  captureScript: SCRIPT_SHA,
  exists: (path) => idOf(path) !== missing,
  readBytes: (path) => bytesOf(idOf(path)),
});

test('полный корректный кандидат принимается целиком (#246)', () => {
  const plan = verify(candidate());
  assert.equal(plan.files.length, DOC_SCREENSHOTS.length);
  for (const file of plan.files) {
    assert.match(file.to, /docs[\\/]+images[\\/]+\d\d[\w-]*\.png$/);
  }
});

test('кандидат с другого дерева не принимается (#246)', () => {
  assert.throws(() => verify(candidate({ sourceFingerprint: 'b'.repeat(64) })),
    /не с текущего дерева/);
});

test('кандидат, снятый другой версией капчура, не принимается (#246)', () => {
  assert.throws(() => verify(candidate({ captureScriptSha256: 'c'.repeat(64) })),
    /другой версией/);
});

test('кандидат без названного Chromium не принимается (#246)', () => {
  // Именно смена браузера переписывает все картинки без содержательных
  // изменений, поэтому окружение съёмки — часть доказательства.
  assert.throws(() => verify(candidate({ chromium: '  ' })), /Chromium/);
  const noField = candidate();
  delete noField.chromium;
  assert.throws(() => verify(noField), /Chromium/);
});

test('неполный набор сценариев не принимается (#246)', () => {
  const partial = candidate();
  delete partial.scenarios[DOC_SCREENSHOTS[0].id];
  assert.throws(() => verify(partial), /набор сценариев неполный/);
});

test('отсутствующий в артефакте файл не принимается (#246)', () => {
  const id = DOC_SCREENSHOTS[2].id;
  assert.throws(() => verify(candidate(), { missing: id }), new RegExp(`${id}: в артефакте нет`));
});

test('подменённый после съёмки файл не принимается (#246)', () => {
  const tampered = candidate();
  tampered.scenarios[DOC_SCREENSHOTS[1].id].imageSha256 = 'd'.repeat(64);
  assert.throws(() => verify(tampered), /изменился после съёмки/);
});

test('сценарий с чужим отпечатком не принимается (#246)', () => {
  const mixed = candidate();
  mixed.scenarios[DOC_SCREENSHOTS[3].id].sourceSha256 = 'e'.repeat(64);
  assert.throws(() => verify(mixed), /отпечаток сценария не совпадает/);
});

test('кандидат не на синтетической фикстуре не принимается (#246)', () => {
  assert.throws(() => verify(candidate({ fixture: 'live' })), /синтетическую фикстуру/);
});

test('кандидат чужой версии манифеста не принимается (#246)', () => {
  assert.throws(() => verify(candidate({ version: DOC_SCREENSHOT_VERSION + 1 })),
    /версии/);
});

test('разбор пути фикстуры не зависит от разделителя платформы (#247)', () => {
  // Тест существует, чтобы регресс к `split('/')` краснел и на Linux: сам по
  // себе набор проверок выше на POSIX-путях проходит при любом разборе.
  assert.equal(basename('C:\\artifact\\01-view-desktop.png'), '01-view-desktop.png');
  assert.equal(basename('/artifact/01-view-desktop.png'), '01-view-desktop.png');
  assert.equal(basename('C:/artifact/sub\\02-view-touch.png'), '02-view-touch.png');
  assert.equal(basename('01-view-desktop.png'), '01-view-desktop.png');
});
