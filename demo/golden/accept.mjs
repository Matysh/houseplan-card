#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../../scripts/source-fingerprint.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from './matrix.mjs';
import { GOLDEN_BASELINE_MANIFEST, GOLDEN_INDEX_SCHEMA, indexCapturedOn } from './policy.mjs';
import {
  goldenAcceptancePlan, goldenAcceptanceRefusal, goldenSilentDeclarations,
  goldenWitnessRefusal,
} from '../../scripts/golden-acceptance.mjs';
import {
  CAPTURE_CANON_PLATFORM, captureEnvironment, environmentNote,
  foreignCaptureAllowance, foreignCaptureRefusal, reportCaptureProvenance,
} from '../../scripts/capture-environment.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const reviewed = process.argv.includes('--reviewed');
const fromArg = process.argv.find((arg) => arg.startsWith('--from='));
const from = resolve(fromArg ? fromArg.slice('--from='.length) : resolve(ROOT, 'artifacts/golden'));
const list = (name) => {
  const found = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return (found ? found.slice(name.length + 3) : '')
    .split(',').map((id) => id.trim()).filter(Boolean);
};
const declared = list('expect-change');
const declaredNew = list('expect-new');
const skipWitnesses = process.argv.includes('--no-witnesses');
const reasonArg = process.argv.find((arg) => arg.startsWith('--reason='));
const skipReason = reasonArg ? reasonArg.slice('--reason='.length) : '';
if (!reviewed) throw new Error('refusing to replace baselines without explicit --reviewed');

const reportPath = resolve(from, 'golden-report.json');
if (!existsSync(reportPath)) throw new Error(`candidate report not found: ${reportPath}`);
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
if (report.matrixVersion !== GOLDEN_MATRIX_VERSION)
  throw new Error(`candidate matrix ${report.matrixVersion} != current ${GOLDEN_MATRIX_VERSION}`);
if (report.buildFingerprint !== sourceFingerprint(ROOT))
  throw new Error('candidate screenshots were not captured from the current frontend source');
if (typeof report.chromium !== 'string' || !report.chromium)
  throw new Error('candidate report does not identify its Chromium build');
if (!Array.isArray(report.results)) throw new Error('candidate report has no scenario results');

// Провенанс съёмки и приёмки — две разные вещи, и до #571 их путали.
//
// Прежняя редакция знала только свою платформу и записывала её в индекс как
// платформу КАДРОВ: артефакт Linux-прогона 34853080375, принятый на Windows,
// дал на `ad4000f9` запись `"platform": "win32"` у кадров, которых Windows не
// снимала. Причина осознанного обхода при этом осталась в stdout и в индекс не
// попала, хотя `AGENTS.md` обещает след в обоих местах.
//
// Теперь среда съёмки читается из отчёта, среда приёмки остаётся своей, и обе
// уезжают в индекс под разными именами. Гейт чужой среды стоит на обеих:
// съёмка вне канона — то, ради чего правило вообще есть; приёмка вне канона
// остаётся осознанным решением с записанной причиной.
const acceptance = captureEnvironment();
const { provenance, legacy } = reportCaptureProvenance(report);
const capturedOn = provenance?.platform || null;
const allowance = foreignCaptureAllowance();
for (const [platform, stageNote] of [
  // Схема 1 платформы съёмки не несёт физически: судить нечего, и подставлять
  // свою — ровно та ошибка, которую чинит задача. Такой отчёт принимается, но
  // в индекс уедет `capturedOn: null`.
  [capturedOn, 'съёмки'],
  [acceptance.platform, 'приёмки'],
]) {
  if (!platform) continue;
  const { refusal } = foreignCaptureRefusal({
    platform, kind: 'golden', stage: 'accept', allowance,
  });
  if (refusal) throw new Error(`${refusal}\n(среда ${stageNote}: ${platform})`);
}
const foreignAllowed = (capturedOn && capturedOn !== CAPTURE_CANON_PLATFORM)
  || acceptance.platform !== CAPTURE_CANON_PLATFORM
  ? allowance
  : null;
if (legacy) {
  console.log('Отчёт старой схемы: провенанса съёмки нет, в индекс уедет capturedOn=null (#571).');
}
if (foreignAllowed) {
  console.log(`Чужая среда разрешена осознанно: ${foreignAllowed}`);
}

const refusal = goldenAcceptanceRefusal(report.results, declared, declaredNew);
if (refusal) throw new Error(refusal);

const byId = new Map(report.results.map((result) => [result.id, result]));
/**
 * Куда писать эталоны. По умолчанию — каталог репозитория; `--baselines=<dir>`
 * нужен свидетелям (#571): иначе проверить «отказ произошёл ДО записи» можно
 * было бы только порчей рабочего дерева, а значит никак. Тот же довод вынес
 * разбор вердикта ревью в отдельный скрипт (#556): враждебные случаи должны
 * быть исполнимы.
 */
const baselinesArg = process.argv.find((arg) => arg.startsWith('--baselines='));
const baselineRoot = baselinesArg
  ? resolve(baselinesArg.slice('--baselines='.length))
  : resolve(ROOT, 'demo/golden/baselines');
mkdirSync(baselineRoot, { recursive: true });
/**
 * Прежний индекс: источник хешей для сцен, которые остаются как были (#351).
 *
 * `passed` не значит «байт в байт» — он значит «в пределах порога». Прежняя
 * версия копировала кандидата поверх КАЖДОГО эталона, поэтому подпороговый
 * дрейф уезжал в контракт молча, и накапливался: каждая приёмка подтягивала
 * эталон к последней среде, порог не пересекался никогда, а эталон уходил.
 * Так `1e341c60` заменил 22 картинки, объявив четыре. Владелец делал эту работу
 * руками (`ad3f9981`: «nine unrelated baselines … were restored to their
 * reviewed versions»); теперь её делает инструмент.
 */
const manifestPath = resolve(baselineRoot, GOLDEN_BASELINE_MANIFEST);
const previous = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8')).scenarios || {}
  : {};
// #355: floor свидетелей — необъявленные сцены, совпавшие с эталоном
// байт-в-байт, доказывают, что среда съёмки та же, что у принятого эталона.
const witnessCheck = goldenWitnessRefusal({
  results: report.results,
  // #408: от размера матрицы, а не от числа уцелевших эталонов — иначе порог
  // обходится удалением каталога эталонов.
  sceneCount: GOLDEN_SCENARIOS.length,
  declared,
  declaredNew,
  previousHashes: previous,
  skipWitnesses,
  skipReason,
});
if (witnessCheck.refusal) {
  // Приписка про среду — то, чего не хватало отказу: «свидетелей 0 из 10» без
  // неё читается как «объяви больше сцен», и обход в одну команду выглядит
  // решением (#455).
  const previousIndex = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : null;
  const note = environmentNote({
    capturedOn,
    // Индекс схемы 1 хранил платформу приёмщика под именем `platform`; читаем
    // обе, но новую — первой.
    acceptedOn: indexCapturedOn(previousIndex),
  });
  throw new Error(note ? `${witnessCheck.refusal}\n${note}` : witnessCheck.refusal);
}
// Кандидат проверяется целиком, до всякого решения о замене: сломанный отчёт
// не имеет права оставить каталог эталонов половинным.
for (const scenario of GOLDEN_SCENARIOS) {
  const result = byId.get(scenario.id);
  const candidate = resolve(from, 'actual', `${scenario.id}.png`);
  if (result?.error || !['missing-baseline', 'passed', 'different'].includes(result?.status))
    throw new Error(`review candidate has an invalid run status: ${scenario.id} (${result?.status || 'missing'})`);
  if (!result?.actualSha256 || !existsSync(candidate))
    throw new Error(`review candidate missing: ${scenario.id}`);
  const digest = createHash('sha256').update(readFileSync(candidate)).digest('hex');
  if (digest !== result.actualSha256) throw new Error(`candidate changed after capture: ${scenario.id}`);
}
const plan = goldenAcceptancePlan({
  scenarioIds: GOLDEN_SCENARIOS.map((scenario) => scenario.id),
  results: report.results,
  previousHashes: previous,
  declared,
  declaredNew,
});
const hashes = plan.hashes;
for (const id of plan.replace) {
  copyFileSync(resolve(from, 'actual', `${id}.png`), resolve(baselineRoot, `${id}.png`));
}
writeFileSync(resolve(baselineRoot, GOLDEN_BASELINE_MANIFEST), `${JSON.stringify({
  schema: GOLDEN_INDEX_SCHEMA,
  matrixVersion: GOLDEN_MATRIX_VERSION,
  acceptedAt: new Date().toISOString(),
  sourceFingerprint: report.buildFingerprint,
  chromium: report.chromium,
  // #571: две стороны провенанса, а не одна. `capturedOn` — где сняты кадры (из
  // отчёта), `acceptedOn` — где их приняли. Раньше поле было одно, называлось
  // `platform` и заполнялось платформой приёмщика, то есть отвечало на вопрос,
  // которого никто не задавал.
  capturedOn: capturedOn,
  acceptedOn: acceptance.platform,
  capture: provenance,
  // Причина осознанного обхода живёт в индексе, а не только в stdout: через
  // неделю stdout нет ни у кого, а индекс лежит в репозитории.
  foreignCapture: foreignAllowed ? { reason: foreignAllowed } : null,
  // #355: след приёмки в артефакте, не только в истории shell.
  witnesses: skipWitnesses
    ? { skipped: true, reason: skipReason }
    : { count: witnessCheck.witnesses.length, floor: witnessCheck.floor },
  scenarios: hashes,
}, null, 2)}\n`, 'utf8');
const silent = goldenSilentDeclarations(report.results, declared);
if (silent.length) {
  console.log(`Объявлены как изменённые, но совпали с эталоном: ${silent.join(', ')}.`);
}
console.log(`Заменено эталонов: ${plan.replace.length}`
  + `${plan.replace.length ? ` (${[...plan.replace].sort().join(', ')})` : ''}.`);
console.log(`Сохранено без изменений: ${plan.keep.length}.`);
console.log(`Индекс перезаписан на ${GOLDEN_SCENARIOS.length} сцен.`);
if (skipWitnesses) {
  console.log(`Свидетели пропущены осознанно (--no-witnesses): ${skipReason}`);
} else {
  console.log(`Свидетелей среды: ${witnessCheck.witnesses.length} (floor ${witnessCheck.floor}).`);
}
