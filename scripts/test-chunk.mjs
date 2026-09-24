#!/usr/bin/env node
// Полный набор юнитов частями (#633): `npm run test:chunk -- N/M`.
//
// Зачем. Одна bash-команда песочницы агента живёт ≈ 3 минуты, а `npm test`
// идёт около 2,5 — под нагрузкой параллельных сессий больше. Раньше набор резали
// руками (`ls | split -n l/6`), и каждая сессия изобретала своё деление.
// Здесь оно одно и детерминированное: одинаковые N/M на любой машине дают один и
// тот же список файлов, а M частей вместе — каждый файл ровно по одному разу.
//
// Правило деления — round-robin по отсортированному имени: файл с индексом i
// (0-based, сортировка по коду символов, не по локали) попадает в часть i % M + 1.
// Выбрано против деления по суммарному размеру: размер меняется с каждой
// правкой теста, и файл кочевал бы между частями — «упало в 3/6» переставало бы
// означать одно и то же вчера и сегодня. Round-robin сдвигает файлы только при
// добавлении или удалении теста, а части и так выходят близкими по длине, потому
// что соседние по имени тесты одной подсистемы разносятся по разным частям.
//
//   npm run test:chunk -- 2/6              # сборка тестов + вторая шестая
//   npm run test:chunk -- 2/6 --no-build   # сборка уже сделана (прошлой частью)
//   npm run test:chunk -- 2/6 --list       # только напечатать файлы
//
// Сборка тестов (`tsc -p tsconfig.test.json && fix-test-build`) по умолчанию
// идёт в каждой части: часть обязана быть самодостаточной, иначе 3/6 после
// перезапуска песочницы читает несуществующий test-build/ и падает не по делу.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule, portableCommand } from './spawn-portable.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** `"N/M"` → `{ index, total }`; бросает на неверном вводе, а не угадывает. */
export function parseChunk(spec) {
  const match = /^(\d+)\/(\d+)$/.exec(String(spec ?? '').trim());
  if (!match) throw new Error(`ожидается N/M (например 2/6), получено «${spec ?? ''}»`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (total < 1 || index < 1 || index > total) {
    throw new Error(`часть ${index} из ${total} не существует: нужно 1 ≤ N ≤ M`);
  }
  return { index, total };
}

/** Тестовые файлы набора `npm test` (`test/*.test.mjs`), отсортированные по коду символов. */
export function listTestFiles(dir = join(ROOT, 'test')) {
  return readdirSync(dir).filter((name) => name.endsWith('.test.mjs'))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => `test/${name}`);
}

/** Часть `index` из `total`: round-robin по отсортированному списку. */
export function chunkFiles(files, index, total) {
  const sorted = [...files].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.filter((_, i) => i % total === index - 1);
}

function main(argv) {
  const spec = argv.find((arg) => !arg.startsWith('--'));
  let chunk;
  try {
    chunk = parseChunk(spec);
  } catch (error) {
    console.error(`test:chunk: ${error.message}\n  npm run test:chunk -- 2/6 [--no-build] [--list]`);
    return 2;
  }
  const files = chunkFiles(listTestFiles(), chunk.index, chunk.total);
  console.log(`test:chunk ${chunk.index}/${chunk.total}: файлов ${files.length}`);
  if (argv.includes('--list')) {
    for (const file of files) console.log(`  ${file}`);
    return 0;
  }
  if (!files.length) return 0;
  const run = (command, args) => {
    const { cmd, shell } = portableCommand(command);
    return spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell }).status ?? 1;
  };
  if (!argv.includes('--no-build')) {
    const built = run('npx', ['tsc', '-p', 'tsconfig.test.json']);
    if (built !== 0) return built;
    const fixed = run(process.execPath, ['scripts/fix-test-build.mjs']);
    if (fixed !== 0) return fixed;
  }
  return run(process.execPath, ['--test', ...files]);
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
