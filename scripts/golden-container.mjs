#!/usr/bin/env node
/**
 * Съёмка golden-кандидатов в пиновом образе Playwright (#334).
 *
 *   node scripts/golden-container.mjs                 # capture
 *   node scripts/golden-container.mjs --mode=verify
 *   node scripts/golden-container.mjs --image=mcr.microsoft.com/playwright:v1.62.0-jammy
 *   node scripts/golden-container.mjs --dry-run       # только напечатать команду
 *
 * Зачем. Прежде эталон принимался только из артефакта CI, и каждый визуальный
 * фикс стоил двух полных прогонов: пуш, ожидание, скачивание артефакта,
 * приёмка, второй пуш. Здесь картинки снимаются локально в том же образе, что
 * стоит на раннере, — одинаковый Chromium и одинаковые шрифты.
 *
 * Гарантия при этом не на слове. `accept.mjs` принимает съёмку только если
 * разошлись РОВНО объявленные сцены (`--expect-change`), а всё остальное
 * совпало с принятыми эталонами. Если растеризация в образе всё-таки другая,
 * разойдутся посторонние сцены с текстом — и приёмка будет запрещена с их
 * перечислением. Поэтому даже неверно угаданный тег образа не может испортить
 * эталоны: он может только не сработать.
 *
 * Почему node_modules прячется анонимным томом: в репозитории владельца он
 * собран под Windows, а `npm ci` внутри контейнера поставил бы туда
 * linux-бинарники и сломал бы хозяйское дерево. Том перекрывает каталог, и
 * установка живёт только внутри контейнера.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = '') => {
  const found = process.argv.find((item) => item.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
};

const lock = JSON.parse(readFileSync(resolve(ROOT, 'package-lock.json'), 'utf8'));
const pinned = lock.packages?.['node_modules/playwright']?.version;
if (!pinned) throw new Error('в package-lock.json не найдена залоченная версия playwright');

const image = arg('image', `mcr.microsoft.com/playwright:v${pinned}`);
const mode = arg('mode', 'capture');
if (!['capture', 'verify'].includes(mode)) throw new Error(`неизвестный режим: ${mode}`);
const dryRun = process.argv.includes('--dry-run');

// `CI=` пустой намеренно: отчёт должен честно говорить, что съёмка локальная.
const inner = [
  'set -eu',
  'npm ci --no-audit --no-fund',
  'npm run bundle:sync',
  `npm run golden:${mode}`,
].join(' && ');

const args = [
  'run', '--rm', '--ipc=host',
  '-v', `${ROOT}:/work`,
  // Анонимный том перекрывает хозяйский node_modules — см. комментарий выше.
  '-v', '/work/node_modules',
  '-w', '/work',
  '-e', 'CI=',
  image, 'bash', '-lc', inner,
];

console.log(`Залоченный playwright: ${pinned}`);
console.log(`Образ: ${image}`);
console.log(`docker ${args.slice(0, -1).join(' ')} '${inner}'`);
if (dryRun) process.exit(0);

const docker = spawnSync('docker', ['--version'], { encoding: 'utf8' });
if (docker.status !== 0) {
  console.error('docker недоступен. Съёмка возможна и без контейнера — в любой Linux-среде,'
    + ' включая WSL: правило приёмки одинаково и само отвергнет съёмку, если растеризация'
    + ' разойдётся с раннером. См. demo/golden/README.md.');
  process.exit(2);
}

const run = spawnSync('docker', args, { stdio: 'inherit' });
if (run.status !== 0) {
  console.error(`\nСъёмка в контейнере не удалась (код ${run.status}).`
    + ' Если docker не смог получить образ — укажите тег дистрибутива:'
    + ` --image=mcr.microsoft.com/playwright:v${pinned}-jammy`);
}
process.exit(run.status ?? 1);
