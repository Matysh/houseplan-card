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
import { readFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseArgs } from 'node:util';
import { readSh3d } from './sh3d.mjs';
import { convertHome } from './convert.mjs';
import { convertEasy, TOOL_VERSION } from './easy.mjs';

let args;
try { args = parseArgs({ allowPositionals: true, options: {
  out: { type: 'string' }, format: { type: 'string' }, now: { type: 'string' }, report: { type: 'boolean' },
} }); } catch (error) { console.error(error.message); process.exit(2); }
const input = args.positionals[0], outDir = args.values.out, now = args.values.now;

if (!input || args.positionals.length !== 1) {
  console.error('использование: cli.mjs <файл.sh3d|yaml|json> [--format sh3d|easy] [--out <каталог>] [--report] [--now <iso>]');
  process.exit(2);
}

try {
  const format = args.values.format || (/\.sh3d$/i.test(input) ? 'sh3d' : 'easy');
  if (!['sh3d', 'easy'].includes(format)) throw new Error('format: sh3d | easy');
  if (statSync(input).size > (format === 'easy' ? 8 : 64) * 1024 * 1024)
    throw Object.assign(new Error('Input file exceeds the size limit'), { code: 'file_too_large' });
  const source = readFileSync(input);
  const options = {
    now: now || '1970-01-01T00:00:00Z',
    toolVersion: TOOL_VERSION,
  };
  const { documents, report } = format === 'sh3d'
    ? convertHome(await readSh3d(new Uint8Array(source)), options) : convertEasy(source.toString('utf8'), options);
  const stem = basename(input).replace(/\.(sh3d|json|ya?ml)$/i, '');
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
    process.stdout.write(`${JSON.stringify(args.values.report ? report : documents, null, 2)}\n`);
  }
} catch (error) {
  console.error(`FAILED ${error.code || 'error'}: ${error.message}`);
  process.exit(1);
}
