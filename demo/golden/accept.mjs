#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from '../../scripts/source-fingerprint.mjs';
import { GOLDEN_MATRIX_VERSION, GOLDEN_SCENARIOS } from './matrix.mjs';
import { GOLDEN_BASELINE_MANIFEST } from './policy.mjs';
import {
  goldenAcceptancePlan, goldenAcceptanceRefusal, goldenSilentDeclarations,
} from '../../scripts/golden-acceptance.mjs';

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

const refusal = goldenAcceptanceRefusal(report.results, declared, declaredNew);
if (refusal) throw new Error(refusal);

const byId = new Map(report.results.map((result) => [result.id, result]));
const baselineRoot = resolve(ROOT, 'demo/golden/baselines');
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
  schema: 1,
  matrixVersion: GOLDEN_MATRIX_VERSION,
  acceptedAt: new Date().toISOString(),
  sourceFingerprint: report.buildFingerprint,
  chromium: report.chromium,
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
