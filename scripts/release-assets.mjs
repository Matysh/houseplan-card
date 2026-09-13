#!/usr/bin/env node
/**
 * Хеши установочных ассетов релиза (#540).
 *
 * Релиз ставится из `houseplan.zip` (HACS) и `houseplan-card.js` (ручная
 * установка). Раз проверив кандидата, публиковать надо ровно те байты, что
 * проверены, — поэтому у ассетов есть паспорт `SHA256SUMS`, который считается
 * на этапе сборки, кладётся в релиз рядом с ассетами и сверяется с тем, что
 * реально скачивается после публикации или при ремонте существующего релиза.
 *
 *   node scripts/release-assets.mjs sums <dir> [--out=<file>]
 *       посчитать sha256 установочных ассетов в <dir>, записать SHA256SUMS
 *   node scripts/release-assets.mjs check <dir> <SHA256SUMS> [--allow-missing]
 *       сверить файлы в <dir> с паспортом; расхождение — код выхода 1
 *
 * Логика — чистые функции, чтобы контракт проверялся юнитами без диска.
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

/** Установочные ассеты — то, что скачивает HACS и человек. Ровно эти два. */
export const INSTALLABLE_ASSETS = ['houseplan-card.js', 'houseplan.zip'];
export const SUMS_FILE = 'SHA256SUMS';

export const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Формат `sha256sum`: `<hex>  <name>` по строке, детерминированный порядок. */
export function formatSums(entries) {
  const names = Object.keys(entries).sort();
  if (!names.length) throw new Error('SHA256SUMS: нет ни одного ассета');
  return `${names.map((name) => `${entries[name]}  ${name}`).join('\n')}\n`;
}

export function parseSums(text) {
  const entries = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = /^([0-9a-f]{64})\s+\*?(\S+)$/.exec(line);
    if (!match) throw new Error(`SHA256SUMS: непонятная строка «${raw}»`);
    if (entries[match[2]]) throw new Error(`SHA256SUMS: ${match[2]} встречается дважды`);
    entries[match[2]] = match[1];
  }
  if (!Object.keys(entries).length) throw new Error('SHA256SUMS: пустой паспорт');
  return entries;
}

/**
 * Сравнить паспорт с фактическими хешами. `actual` может не содержать файла —
 * это «missing» (при ремонте такой ассет догружается), а вот присутствующий
 * файл с другим хешем — «mismatched», и это всегда отказ: публичные байты не
 * подменяются молча.
 */
export function compareSums(expected, actual) {
  const missing = [];
  const mismatched = [];
  for (const name of Object.keys(expected).sort()) {
    if (!(name in actual)) missing.push(name);
    else if (actual[name] !== expected[name]) mismatched.push(name);
  }
  const extra = Object.keys(actual).filter((name) => !(name in expected)).sort();
  return { ok: !missing.length && !mismatched.length, missing, mismatched, extra };
}

export function sumsOfDirectory(dir, names = INSTALLABLE_ASSETS) {
  const entries = {};
  for (const name of names) {
    const path = resolve(dir, name);
    if (!existsSync(path)) continue;
    entries[name] = sha256Hex(readFileSync(path));
  }
  return entries;
}

if (isMainModule(import.meta.url)) { // #496: переносимо для Windows
  try {
    const args = process.argv.slice(2);
    const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
    const value = (name) => flag(name)?.split('=').slice(1).join('=') || '';
    const positionals = args.filter((a) => !a.startsWith('--'));
    const [command, dir, sumsPath] = positionals;
    if (command === 'sums') {
      if (!dir) throw new Error('usage: release-assets.mjs sums <dir> [--out=<file>]');
      const entries = sumsOfDirectory(dir);
      for (const name of INSTALLABLE_ASSETS) {
        if (!entries[name]) throw new Error(`${name} отсутствует в ${dir} — паспорт не выписывается на неполный набор`);
      }
      const out = value('out') || resolve(dir, SUMS_FILE);
      writeFileSync(out, formatSums(entries));
      console.log(formatSums(entries).trimEnd());
      console.log(`→ ${out}`);
    } else if (command === 'check') {
      if (!dir || !sumsPath) throw new Error('usage: release-assets.mjs check <dir> <SHA256SUMS> [--allow-missing]');
      const expected = parseSums(readFileSync(sumsPath, 'utf8'));
      const actual = sumsOfDirectory(dir, Object.keys(expected));
      const result = compareSums(expected, actual);
      for (const name of Object.keys(expected).sort()) {
        const state = result.mismatched.includes(name) ? 'MISMATCH'
          : result.missing.includes(name) ? 'missing' : 'ok';
        console.log(`${state.padEnd(8)} ${name}`);
      }
      if (result.mismatched.length) {
        throw new Error(`хеш расходится: ${result.mismatched.join(', ')} — байты не те, что проверены`);
      }
      if (result.missing.length && !flag('allow-missing')) {
        throw new Error(`ассетов нет на месте: ${result.missing.join(', ')}`);
      }
      if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `missing=${result.missing.join(' ')}\n`);
      }
    } else {
      throw new Error('usage: release-assets.mjs sums|check …');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
