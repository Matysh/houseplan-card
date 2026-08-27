#!/usr/bin/env node
/**
 * Приёмка эталонов с объявлением намерения (#334).
 *
 *   node scripts/golden-accept.mjs --reviewed --expect-change=<id,id>
 *   node scripts/golden-accept.mjs --reviewed --expect-change=<id> --from=<распакованный артефакт>
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
const declared = value('expect-change').split(',').map((id) => id.trim()).filter(Boolean);

const reportPath = resolve(from, 'golden-report.json');
if (!existsSync(reportPath)) {
  console.error(`отчёт кандидатов не найден: ${reportPath}`);
  process.exit(2);
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));

const refusal = goldenAcceptanceRefusal(report.results, declared);
if (refusal) {
  console.error(refusal);
  process.exit(1);
}

const silent = goldenSilentDeclarations(report.results, declared);
if (silent.length) {
  console.log(`Объявлены как изменённые, но совпали с эталоном: ${silent.join(', ')}.`);
}
const changed = (report.results || []).filter((result) => result.status !== 'passed')
  .map((result) => `${result.id} (${result.status})`).sort();
console.log(changed.length
  ? `Будут заменены: ${changed.join(', ')}.`
  : 'Ни один эталон не изменился — будет перезаписан только манифест.');
console.log(`Съёмка: chromium ${report.chromium || '?'}, матрица ${report.matrixVersion}.`);

const accept = spawnSync(process.execPath, [
  resolve(ROOT, 'demo/golden/accept.mjs'), '--reviewed', `--from=${from}`,
], { cwd: ROOT, stdio: 'inherit' });
process.exit(accept.status ?? 1);
