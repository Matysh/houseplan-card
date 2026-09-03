#!/usr/bin/env node
/**
 * Сборка страницы /convert в один самодостаточный файл (#446).
 *
 * Артефакт один: `dist/index.html`. Так же устроен лендинг, и так же его
 * раскладывают на хост — копированием, без сборщиков и без CDN.
 *
 * Модули склеиваются, а не грузятся по относительным путям: страница обязана
 * работать из любого каталога и без сети. Склейка нарочно тупая — снимаются
 * строки `import ... from '...'` и префикс `export `. Многострочный импорт
 * ломает такую склейку молча, поэтому он ОТКАЗ, а не предупреждение.
 *
 *   node scripts/sh3d-convert/build-page.mjs [--check]
 *
 * `--check` не пишет файл, а сверяет закоммиченный артефакт с пересборкой:
 * этим тест ловит правку страницы или модулей без пересборки.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORDER = ['xml.mjs', 'zip.mjs', 'convert.mjs', 'sh3d.mjs', 'page/app.mjs'];
const MARKER = '/* <!--BUNDLE--> */';

const stripModuleSyntax = (source, name) => {
  const lines = source.split('\n');
  const out = [];
  for (const [index, line] of lines.entries()) {
    if (/^\s*import\s/.test(line)) {
      if (!/;\s*$/.test(line)) {
        throw new Error(
          `${name}:${index + 1}: многострочный import ломает склейку — запишите его в одну строку`);
      }
      continue;
    }
    out.push(line.replace(/^export\s+(?=const|function|class|async|let)/, ''));
  }
  const remaining = out.find((line) => /^\s*export\s/.test(line));
  if (remaining) throw new Error(`${name}: не снят export: ${remaining.trim()}`);
  return out.join('\n');
};

export function buildPage() {
  const shell = readFileSync(join(HERE, 'page/shell.html'), 'utf8');
  if (!shell.includes(MARKER)) throw new Error('в shell.html нет метки вставки');
  const bundle = ORDER
    .map((name) => `// --- ${name} ---\n${stripModuleSyntax(readFileSync(join(HERE, name), 'utf8'), name)}`)
    .join('\n');
  return shell.replace(MARKER, `${bundle}\nmount();`);
}

const page = buildPage();
const target = join(HERE, 'dist', 'index.html');
if (process.argv.includes('--check')) {
  const committed = readFileSync(target, 'utf8');
  if (committed !== page) {
    console.error('FAILED: dist/index.html отстал от исходников —'
      + ' пересоберите: node scripts/sh3d-convert/build-page.mjs');
    process.exit(1);
  }
  console.log('ok: dist/index.html совпадает с пересборкой');
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, page);
  console.log(`dist/index.html: ${page.length} Б`);
}
