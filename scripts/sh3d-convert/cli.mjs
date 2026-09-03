#!/usr/bin/env node
/**
 * CLI конвертера (#446): нужен гейтам и фикстурам, не пользователю.
 *
 *   node scripts/sh3d-convert/cli.mjs <файл.sh3d> [--out <каталог>] [--report]
 *
 * Пользовательский путь — страница /convert на houseplan.tech, где та же
 * конверсия идёт в браузере. Один и тот же код в двух средах: расхождение
 * между тем, что проверяет CI, и тем, что получает человек, — то, ради чего
 * инструмент вообще живёт в этом репозитории.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { readSh3d } from './sh3d.mjs';
import { convertHome } from './convert.mjs';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const outIndex = args.indexOf('--out');
const outDir = outIndex >= 0 ? args[outIndex + 1] : null;
const now = args.includes('--now') ? args[args.indexOf('--now') + 1] : undefined;

if (!input) {
  console.error('использование: cli.mjs <файл.sh3d> [--out <каталог>] [--report] [--now <iso>]');
  process.exit(2);
}

try {
  const home = await readSh3d(new Uint8Array(readFileSync(input)));
  const { documents, report } = convertHome(home, {
    now: now || '1970-01-01T00:00:00Z',
    toolVersion: 'sh3d-convert 0.1',
  });
  const stem = basename(input).replace(/\.sh3d$/i, '');
  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    for (const [index, document] of documents.entries()) {
      const name = `${stem}.space-${index + 1}.json`;
      writeFileSync(join(outDir, name), `${JSON.stringify(document, null, 2)}\n`);
      console.log(name);
    }
    writeFileSync(join(outDir, `${stem}.report.json`), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`${stem}.report.json`);
  } else {
    process.stdout.write(`${JSON.stringify(args.includes('--report') ? report : documents, null, 2)}\n`);
  }
} catch (error) {
  console.error(`FAILED ${error.code || 'error'}: ${error.message}`);
  process.exit(1);
}
