#!/usr/bin/env node
/**
 * Приёмка скриншотов документации (#246, правило среды переписано в #401).
 *
 *   npm run docs:accept -- --reviewed --from=artifacts/docs
 *   npm run docs:accept -- --reviewed --from=… --expect-change=device-editor
 *
 * Съёмка в другом окружении даёт байтово разный PNG при том же содержимом
 * кадра: сглаживание и хинтинг зависят от шрифтового стека, а не только от
 * браузера. Измерено — пересъёмка в #231 изменила два файла из девяти на 7–8
 * байт, а набор, приехавший с бетой, все девять целиком.
 *
 * Раньше отсюда следовало правило про МЕСТО: снимать только в CI. Оно держалось
 * на этом комментарии, а не на механизме, и стоило прогона workflow даже там,
 * где пиксель измениться не мог (#390).
 *
 * Теперь правило про ДОКАЗАТЕЛЬСТВО, и оно то же, что у golden с #334: среда
 * доказана, если каждый кадр, который менять не собирались, совпал с
 * закоммиченным байт-в-байт. Разбор правила и его границ — в
 * scripts/docs-acceptance.mjs. Снимать можно где угодно; принять получится
 * только оттуда, где кадры воспроизводятся.
 *
 * Что здесь НЕ делается: коммит. Файлы заменяются, коммит делает человек —
 * приёмка не должна быть способом протащить картинки мимо чужих глаз.
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { assertCaptureEnvironment, captureEnvironment } from './capture-environment.mjs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOC_SCREENSHOT_VERSION, DOC_SCREENSHOTS } from '../demo/docs/screenshots.mjs';
import { docsAcceptancePlan } from './docs-acceptance.mjs';
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

/** Build the manifest written by the CLI without erasing an earlier review trace. */
export function acceptedDocsManifest({
  manifest, previousAcceptance, decision, skipWitnesses = false, skipReason = '',
  platform = null,
}) {
  return {
    ...manifest,
    // Провенанс среды приёмки (#455): рядом с версией браузера, чтобы у
    // следующего разбора «почему кадры разошлись» была не только догадка.
    ...(platform ? { acceptedOn: platform } : {}),
    acceptance: decision.replace.length
      ? {
        declared: [...decision.replace],
        witnesses: decision.witnesses.length,
        floor: decision.floor,
        ...(skipWitnesses ? { witnessesSkippedBecause: skipReason } : {}),
      }
      : { ...(previousAcceptance || {}), lastWriteWasFingerprintOnly: true },
  };
}

const list = (argv, name) => argv
  .filter((arg) => arg.startsWith(`--${name}=`))
  .map((arg) => arg.slice(name.length + 3))
  .filter(Boolean);

function main(argv) {
  // Среда приёмки (#455). Платформу съёмки манифест не несёт и не может:
  // добавить поле — значит править `demo/docs/capture.mjs`, чей sha записан в
  // индексе скриншотов, то есть платить пересъёмкой десяти картинок за
  // проверку. Приёмка идёт там, где лежат артефакты, поэтому её платформа —
  // достаточный признак среды кадров.
  const allowed = assertCaptureEnvironment({ kind: 'docs', stage: 'accept' });
  if (allowed) console.log(`Чужая среда приёмки разрешена осознанно: ${allowed}`);
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

  // Хеши закоммиченного считаются по файлам на диске, а не по закоммиченному
  // манифесту: манифест — утверждение о файлах, а сравнивать надо сами файлы.
  const ids = DOC_SCREENSHOTS.map((scenario) => scenario.id);
  const committed = {};
  const candidate = {};
  for (const scenario of DOC_SCREENSHOTS) {
    const entry = manifest.scenarios[scenario.id];
    candidate[scenario.id] = entry.imageSha256;
    const onDisk = resolve(ROOT, 'docs/images', entry.file);
    if (existsSync(onDisk)) committed[scenario.id] = sha256(readFileSync(onDisk));
  }

  const declared = list(argv, 'expect-change');
  const skipWitnesses = argv.includes('--no-witnesses');
  const skipReason = (list(argv, 'reason')[0] || '').trim();
  const decision = docsAcceptancePlan({
    ids, committed, candidate, declared, skipWitnesses, skipReason,
  });
  if (decision.refusal) {
    console.error(`отказ: ${decision.refusal}`);
    return 1;
  }

  const byId = new Map(plan.files.map((file, index) => [ids[index], file]));
  for (const id of decision.replace) {
    const file = byId.get(id);
    copyFileSync(file.from, file.to);
  }
  // След приёмки отвечает на вопрос «когда эти пиксели приняли и что тогда
  // объявляли». Обновление отпечатка пикселей не меняет — значит и стирать
  // ответ не должно (#409, Low из #405): прежняя редакция затирала `declared`
  // пустым списком, и история терялась при первом же refresh.
  const previous = JSON.parse(readFileSync(resolve(ROOT, 'docs/images/screenshots.json'), 'utf8'))
    .acceptance;
  const accepted = acceptedDocsManifest({
    manifest,
    previousAcceptance: previous,
    decision,
    platform: captureEnvironment().platform,
    skipWitnesses,
    skipReason,
  });
  writeFileSync(
    resolve(ROOT, 'docs/images/screenshots.json'),
    `${JSON.stringify(accepted, null, 2)}\n`,
    'utf8',
  );
  if (!decision.replace.length) {
    console.log('Кадры не менялись: принят только манифест'
      + ` (отпечаток исходников ${manifest.sourceFingerprint.slice(0, 8)}).`);
  } else {
    console.log(`Принято кадров: ${decision.replace.length}`
      + ` (${decision.replace.join(', ')}), снято ${manifest.chromium}.`);
  }
  console.log(`Сохранено без изменений: ${decision.keep.length}.`);
  if (skipWitnesses) {
    console.log(`Свидетели пропущены осознанно: ${skipReason}`);
  } else {
    console.log(`Кадров-свидетелей среды: ${decision.witnesses.length} (порог ${decision.floor}).`);
  }
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
