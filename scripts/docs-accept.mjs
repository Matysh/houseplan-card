#!/usr/bin/env node
/**
 * Приёмка скриншотов документации, снятых в CI (#246).
 *
 *   npm run docs:accept -- --reviewed --from=artifacts/docs
 *
 * Зачем приёмка вообще. Съёмка на машине исполнителя даёт байтово разный PNG
 * при одинаковом содержимом кадра: сглаживание и хинтинг зависят от окружения.
 * Измерено на истории — пересъёмка в #231 изменила два файла из девяти на 7–8
 * байт, а набор, приехавший с бетой, все девять целиком. Поэтому картинки
 * рождаются в одном месте (`.github/workflows/docs-screenshots.yml`), а сюда
 * приезжают артефактом. Та же конструкция, что у golden-эталонов, и по той же
 * причине.
 *
 * Что здесь НЕ делается: коммит. Файлы заменяются, коммит делает человек —
 * приёмка не должна быть способом протащить картинки мимо чужих глаз.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from '../demo/docs/screenshots.mjs';
import { visualFingerprint } from './source-fingerprint.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Проверить кандидата целиком и вернуть план замены. Ни одного побочного
 * эффекта: половина принятого набора хуже непринятого — на плане останется
 * картинка от одного дерева рядом с манифестом от другого, и `check-docs`
 * покажет ровно одну ошибку вместо девяти.
 *
 * @returns {{ manifest: object, files: Array<{ from: string, to: string }> }}
 */
export function verifyDocsCandidate({
  root = ROOT,
  from,
  manifest,
  readBytes = (path) => readFileSync(path),
  exists = (path) => existsSync(path),
  expectedFingerprint,
  captureScript,
  scenarios = DOC_SCREENSHOTS,
  version = DOC_SCREENSHOT_VERSION,
} = {}) {
  if (!manifest || typeof manifest !== 'object') throw new Error('кандидат без манифеста');
  if (manifest.version !== version)
    throw new Error(`манифест кандидата версии ${manifest.version}, ожидалась ${version}`);
  if (manifest.fixture !== 'synthetic-only')
    throw new Error('кандидат не объявляет синтетическую фикстуру: на скриншоты документации '
      + 'не должны попадать чужие данные');
  const fingerprint = expectedFingerprint ?? visualFingerprint(root);
  if (manifest.sourceFingerprint !== fingerprint)
    throw new Error('кандидат снят не с текущего дерева: отпечаток не совпадает');
  const scriptSha = captureScript ?? sha256(readBytes(resolve(root, 'demo/docs/capture.mjs')));
  if (manifest.captureScriptSha256 !== scriptSha)
    throw new Error('кандидат снят другой версией demo/docs/capture.mjs');
  // Кто снимал — часть доказательства, а не украшение: именно смена браузера
  // и переписывает все девять файлов без содержательных изменений.
  if (typeof manifest.chromium !== 'string' || !manifest.chromium.trim())
    throw new Error('кандидат не называет свой Chromium');

  const ids = Object.keys(manifest.scenarios || {}).sort();
  const expected = scenarios.map((scenario) => scenario.id).sort();
  if (JSON.stringify(ids) !== JSON.stringify(expected))
    throw new Error(`набор сценариев неполный: ${ids.length} против ${expected.length}`);

  const files = [];
  for (const scenario of scenarios) {
    const entry = manifest.scenarios[scenario.id];
    if (entry.sourceSha256 !== manifest.sourceFingerprint)
      throw new Error(`${scenario.id}: отпечаток сценария не совпадает с манифестом`);
    const candidate = resolve(from, entry.file || '');
    if (!entry.file || !exists(candidate))
      throw new Error(`${scenario.id}: в артефакте нет файла ${entry.file || '(без имени)'}`);
    if (sha256(readBytes(candidate)) !== entry.imageSha256)
      throw new Error(`${scenario.id}: файл изменился после съёмки`);
    files.push({ from: candidate, to: resolve(root, 'docs/images', entry.file) });
  }
  return { manifest, files };
}

function main(argv) {
  if (!argv.includes('--reviewed')) {
    console.error('отказ: замена скриншотов без явного --reviewed');
    return 2;
  }
  const fromArg = argv.find((arg) => arg.startsWith('--from='));
  const from = resolve(fromArg ? fromArg.slice('--from='.length) : resolve(ROOT, 'artifacts/docs'));
  const manifestPath = resolve(from, 'screenshots.json');
  if (!existsSync(manifestPath)) {
    console.error(`манифест кандидата не найден: ${manifestPath}`);
    return 2;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const plan = verifyDocsCandidate({ root: ROOT, from, manifest });
  for (const file of plan.files) copyFileSync(file.from, file.to);
  writeFileSync(
    resolve(ROOT, 'docs/images/screenshots.json'),
    `${JSON.stringify(plan.manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(`Принято ${plan.files.length} скриншотов, снятых ${plan.manifest.chromium}.`);
  console.log('Коммит — за вами: приёмка ничего не коммитит.');
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`отказ: ${error.message}`);
    process.exit(1);
  }
}
