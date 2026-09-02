#!/usr/bin/env node
/**
 * Гейт воспроизводимости съёмки документации между прогонами (#422).
 *
 * Зачем отдельный гейт, если есть `--stability`. Тот делает N снимков в одном
 * процессе и одном состоянии страницы — то есть отвечает на вопрос «плавает ли
 * кадр от времени внутри страницы». Дефект #410 был по другой оси: обрезка
 * плавала МЕЖДУ прогонами, и три снимка внутри одного процесса совпали бы
 * всегда. Проверка, объявленная гарантией воспроизводимости, на собственном
 * инциденте промолчала бы; этот гейт закрывает вторую ось.
 *
 * Обе проверки остаются: одна другую не заменяет.
 *
 * Приём простой до скуки: снять набор дважды в разных процессах и сравнить
 * хеши. Ничего не сохраняется между прогонами, кроме самих хешей, поэтому гейт
 * не зависит от того, что лежало в `docs/images` до него.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const IMAGES = resolve(ROOT, 'docs/images');
const CAPTURE = resolve(ROOT, 'demo/docs/capture.mjs');

/** Хеши всех кадров набора: имя → sha256. */
export function frameHashes(directory, read = readFileSync, list = readdirSync) {
  const hashes = {};
  for (const name of list(directory).sort()) {
    if (!name.endsWith('.png')) continue;
    hashes[name] = createHash('sha256').update(read(resolve(directory, name))).digest('hex');
  }
  return hashes;
}

/**
 * Расхождения между двумя прогонами.
 *
 * Пропавший и появившийся кадр — тоже расхождение: набор обязан быть одним и
 * тем же, иначе сравнивать нечего и «совпало» ничего не значит.
 */
export function driftBetweenRuns(first, second) {
  const names = [...new Set([...Object.keys(first), ...Object.keys(second)])].sort();
  return names
    .filter((name) => first[name] !== second[name])
    .map((name) => ({
      name,
      first: first[name] || '(нет кадра)',
      second: second[name] || '(нет кадра)',
    }));
}

function capture(label) {
  const run = spawnSync(process.execPath, [CAPTURE], { cwd: ROOT, stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`::error::съёмка (${label}) завершилась с кодом ${run.status}`);
    process.exit(run.status || 1);
  }
}

function main() {
  capture('прогон 1');
  const first = frameHashes(IMAGES);
  capture('прогон 2');
  const second = frameHashes(IMAGES);

  const drift = driftBetweenRuns(first, second);
  if (!drift.length) {
    console.log(`съёмка воспроизводима: ${Object.keys(first).length} кадров совпали между прогонами`);
    return 0;
  }
  console.error('::error::съёмка недетерминирована между прогонами —'
    + ` разошлись кадры: ${drift.map((item) => item.name).join(', ')}`);
  for (const item of drift) {
    console.error(`  ${item.name}: ${item.first.slice(0, 16)} ≠ ${item.second.slice(0, 16)}`);
  }
  console.error('Кадр, который зависит от прогона, делает приёмку скриншотов бессмысленной:'
    + ' «изменилось десять кадров» перестаёт что-либо означать.');
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
