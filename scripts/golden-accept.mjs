#!/usr/bin/env node
/**
 * Приёмка эталонов с объявлением намерения (#334).
 *
 *   node scripts/golden-accept.mjs --reviewed --expect-change=<id,id>
 *   node scripts/golden-accept.mjs --reviewed --expect-new=<id,id>
 *   node scripts/golden-accept.mjs --reviewed --expect-change=<id> --from=<распакованный артефакт>
 *
 * Два флага утверждают разное: `--expect-change` — «я знаю, почему старый кадр
 * изменился», `--expect-new` — «я посмотрел на новый кадр». Путаница между ними
 * останавливает приёмку (#350).
 *
 * Обёртка над `demo/golden/accept.mjs`, а не правка его самого: любой `.mjs` из
 * `demo/golden` входит в `sourceFingerprint`, поэтому его правка объявляет
 * устаревшими бандл и оба манифеста — см. `scripts/golden-acceptance.mjs`.
 *
 * Проверка идёт ДО делегирования: `accept.mjs` копирует картинки целым набором,
 * и запрет обязан сработать раньше, чем каталог эталонов будет тронут.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { goldenAcceptanceRefusal, goldenSilentDeclarations } from './golden-acceptance.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const value = (name) => {
  const found = argv.find((item) => item.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : '';
};

if (!argv.includes('--reviewed')) {
  console.error('приёмка требует явного --reviewed');
  process.exit(2);
}
const from = resolve(value('from') || resolve(ROOT, 'artifacts/golden'));
const list = (name) => value(name).split(',').map((id) => id.trim()).filter(Boolean);
const declared = list('expect-change');
const declaredNew = list('expect-new');

const reportPath = resolve(from, 'golden-report.json');
if (!existsSync(reportPath)) {
  console.error(`отчёт кандидатов не найден: ${reportPath}`);
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const refusal = goldenAcceptanceRefusal(report.results, declared, declaredNew);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const silent = goldenSilentDeclarations(report.results, declared);
if (silent.length) {
  console.log(`Объявлены как изменённые, но совпали с эталоном: ${silent.join(', ')}.`);
}
// Новые эталоны печатаются отдельной строкой, а не в общем списке: раньше они
// растворялись среди изменившихся, и три кадра каталога устройств уехали в
// контракт незамеченными (#350).
const fresh = (report.results || []).filter((result) => result.status === 'missing-baseline')
  .map((result) => result.id).sort();
const changed = (report.results || []).filter((result) => result.status === 'different')
  .map((result) => result.id).sort();
console.log(changed.length
  ? `Будут заменены эталоны: ${changed.join(', ')}.`
  : 'Ни один существующий эталон не изменился.');
if (fresh.length) console.log(`СТАНУТ КОНТРАКТОМ ВПЕРВЫЕ: ${fresh.join(', ')}.`);
if (!changed.length && !fresh.length) console.log('Будет перезаписан только манифест.');
console.log(`Съёмка: chromium ${report.chromium || '?'}, матрица ${report.matrixVersion}.`);

const accept = spawnSync(process.execPath, [
  resolve(ROOT, 'demo/golden/accept.mjs'), '--reviewed', `--from=${from}`,
], { cwd: ROOT, stdio: 'inherit' });
process.exit(accept.status ?? 1);
