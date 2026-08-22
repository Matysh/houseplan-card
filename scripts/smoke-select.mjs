#!/usr/bin/env node
/**
 * Какие существующие browser-smoke относятся к этому диффу (#241).
 *
 *   node scripts/smoke-select.mjs --base origin/dev --head HEAD
 *   node scripts/smoke-select.mjs --diff patch.diff        (или `-` для stdin)
 *   node scripts/smoke-select.mjs --base A --head B --json
 *
 * Инструмент отвечает на один вопрос: какие из уже написанных смоков исполняют
 * или проверяют то, что тронул дифф. Он НЕ решает, достаточно ли этих смоков,
 * не заменяет AC задачи и не отменяет полный предрелизный прогон.
 *
 * Почему не граф импортов. Смоки не импортируют `src/**`: они грузят собранный
 * бандл и работают через DOM и приватные поля в `page.evaluate`. Единственный
 * доказуемый след связи — упоминание символа в тексте смока; всё остальное
 * идёт через явный реестр `scripts/smoke-links.mjs`.
 *
 * Три вида ответа, и они не смешиваются:
 *   1. прямое совпадение — смок называет изменённый символ;
 *   2. зарегистрированная связь — смок проверяет следствие контракта, не
 *      называя ни одного изменённого символа (реестр);
 *   3. неопределённость — дифф исполняемый, но связь не доказана. Это НЕ
 *      «проверять нечего»: молчание здесь стоило #234 бета-блокирующего
 *      регресса, и молчать инструмент не имеет права.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registeredSmokes } from './smoke-links.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Символ, который встречается больше чем в этой доле смоков, ничего не
 * различает: `_serverCfg` есть в 112 из 167, `_setMode` в 101. Такой символ не
 * повод рекомендовать смок — иначе любая правка карточки предлагает всю
 * матрицу, а это ровно то, чего задача просила не делать. Порог измерен по
 * фактическому распределению, а не выбран на глаз.
 */
export const BROAD_SHARE = 0.2;

/** Файлы, чей дифф способен что-то сломать в браузере. */
const isExecutableFrontend = (file) => file.startsWith('src/')
  && file.endsWith('.ts') && !file.endsWith('.d.ts');

/**
 * Объявления, дающие таблицу символов проекта. Смысл таблицы — отсечь общие
 * слова: `length`, `value` и `return` встречаются и в диффе, и в смоках, но
 * символами продукта не являются.
 */
const DECLARATIONS = [
  // Модульная область: объявления без отступа. Локальные переменные внутри
  // функций сюда не попадают намеренно — их имена не образуют контракт.
  /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm,
  /^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm,
  /^(?:export\s+)?(?:abstract\s+)?(?:class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
  // Члены класса: либо с явным модификатором, либо с приватным подчёркиванием
  // (карточка держит всё внутреннее на `_`).
  /^\s+(?:private|protected|public)\s+(?:static\s+|readonly\s+|async\s+)?(?:get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*[(=:<]/gm,
  /^\s+(?:static\s+|readonly\s+|async\s+|get\s+|set\s+)*(_[A-Za-z][\w$]*)\s*[(=:<]/gm,
];

/**
 * Имя, по которому связь вообще можно приписать. Одиночное строчное слово —
 * `floor`, `gap`, `own`, `edit` — это английский, а не идентификатор: такие
 * слова встречаются и в диффе, и в половине смоков, и первая же версия этого
 * инструмента из-за них рекомендовала 130 смоков из 167. Различают связь
 * только `_приватные`, camelCase из двух слов и Прописные.
 */
const isDistinctive = (name) => /^_/.test(name)
  || /[a-z][A-Z]/.test(name) || /^[A-Z]/.test(name);

/**
 * Символы масштаба пространства. Они попадают в дифф любой геометрической
 * правки и упоминаются любым геометрическим смоком, поэтому отвечают на вопрос
 * «это про геометрию?», а не «какой контракт затронут». Оставленные в выборке,
 * они приводили дюжину смоков без единого содержательного основания.
 *
 * Список именно списком, а не порогом по частоте: `_cellCm` встречается всего в
 * пяти смоках, то есть по частоте он редкий — а различает всё равно ничего.
 */
const GENERIC_SYMBOLS = new Set(['_cellCm', '_gridPitch', '_wallKeyPitch']);

const IDENTIFIER = /[A-Za-z_$][\w$]{2,}/g;

export function symbolTable(root = repoRoot) {
  const table = new Set();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) { walk(path); continue; }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
      const text = readFileSync(path, 'utf8');
      for (const pattern of DECLARATIONS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text))) {
          if (match[1].length >= 4 && isDistinctive(match[1])) table.add(match[1]);
        }
      }
    }
  };
  walk(join(root, 'src'));
  return table;
}

/** Изменённые файлы и символы на изменённых строках. */
export function parseDiff(diffText, table) {
  const files = new Set();
  const executable = new Set();
  const symbols = new Set();
  let current = null;
  let currentExecutable = false;
  for (const line of diffText.split('\n')) {
    const header = /^\+\+\+ b\/(.+)$/.exec(line) || /^diff --git a\/\S+ b\/(.+)$/.exec(line);
    if (header) {
      current = header[1] === '/dev/null' ? null : header[1];
      currentExecutable = !!current && isExecutableFrontend(current);
      if (current) {
        files.add(current);
        if (currentExecutable) executable.add(current);
      }
      continue;
    }
    if (!currentExecutable) continue;
    if (!/^[+-]/.test(line) || /^(\+\+\+|---)/.test(line)) continue;
    IDENTIFIER.lastIndex = 0;
    let match;
    while ((match = IDENTIFIER.exec(line))) {
      if (table.has(match[0])) symbols.add(match[0]);
    }
  }
  return {
    files: [...files].sort(),
    executable: [...executable].sort(),
    symbols: [...symbols].sort(),
  };
}

/** Тексты смоков: имя файла → содержимое. */
export function smokeCorpus(root = repoRoot) {
  const dir = join(root, 'demo');
  const corpus = new Map();
  for (const name of readdirSync(dir).filter((f) => /^smoke_.*\.mjs$/.test(f)).sort()) {
    corpus.set(name, readFileSync(join(dir, name), 'utf8'));
  }
  return corpus;
}

const mentions = (text, symbol) =>
  new RegExp(`(?<![\\w$])${symbol.replace(/\$/g, '\\$')}(?![\\w$])`).test(text);

/**
 * Ядро выборки. Возвращает данные, а не текст: печать и коды выхода — дело
 * вызывающего, а тест сравнивает структуру.
 */
export function selectSmokes(diffText, { root = repoRoot, table, corpus } = {}) {
  const symbols = table || symbolTable(root);
  const smokes = corpus || smokeCorpus(root);
  const parsed = parseDiff(diffText, symbols);
  const broadLimit = Math.max(1, Math.floor(smokes.size * BROAD_SHARE));

  const spread = new Map();
  for (const symbol of parsed.symbols) {
    let count = 0;
    for (const text of smokes.values()) if (mentions(text, symbol)) count++;
    spread.set(symbol, count);
  }
  const broad = parsed.symbols.filter(
    (s) => spread.get(s) > broadLimit || (GENERIC_SYMBOLS.has(s) && spread.get(s) > 0),
  );
  const narrow = parsed.symbols.filter(
    (s) => spread.get(s) > 0 && spread.get(s) <= broadLimit && !GENERIC_SYMBOLS.has(s),
  );
  const unseen = parsed.symbols.filter((s) => spread.get(s) === 0);

  // Одно распространённое имя — повод посмотреть, а не вывод. Сильной связь
  // считается либо по двум и более совпадениям, либо по одному редкому символу:
  // `_draftSegmentCms` есть в восьми смоках и сам по себе адресует контракт,
  // `_path` — в восемнадцати и адресует «здесь рисуют».
  const rareLimit = Math.max(1, Math.floor(smokes.size * 0.05));
  const direct = [];
  for (const [smoke, text] of smokes) {
    const hit = narrow.filter((symbol) => mentions(text, symbol));
    if (!hit.length) continue;
    const strong = hit.length > 1 || spread.get(hit[0]) <= rareLimit;
    direct.push({ smoke, symbols: hit, count: hit.length, strong });
  }
  direct.sort((a, b) => Number(b.strong) - Number(a.strong)
    || b.count - a.count || a.smoke.localeCompare(b.smoke));

  const directNames = new Set(direct.map((entry) => entry.smoke));
  const registered = registeredSmokes(parsed.symbols)
    .filter((entry) => !directNames.has(entry.smoke));

  return {
    files: parsed.files,
    executable: parsed.executable,
    symbols: parsed.symbols,
    broad,
    unseen,
    direct,
    registered,
    smokeCount: smokes.size,
    broadLimit,
    // Дифф исполняемый, а связь не доказана — единственное состояние, о котором
    // нельзя молчать. `noExecutableDiff` от него отличается: там и правда
    // нечего проверять (docs, i18n-строки без кода, чистая инфраструктура).
    noExecutableDiff: parsed.executable.length === 0,
    unproven: parsed.executable.length > 0
      && !direct.some((entry) => entry.strong) && !registered.length,
  };
}

function gitDiff(base, head) {
  const result = spawnSync('git', ['-C', repoRoot, 'diff', '--unified=0', `${base}...${head}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (result.status !== 0) {
    // `A...B` не работает без общего предка — тогда честнее прямой диапазон,
    // чем молча вернуть пустоту и «смоки не нужны».
    const plain = spawnSync('git', ['-C', repoRoot, 'diff', '--unified=0', base, head],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (plain.status !== 0) throw new Error(`git diff: ${plain.stderr || result.stderr}`);
    return plain.stdout;
  }
  return result.stdout;
}

function report(selection) {
  const lines = [];
  if (selection.noExecutableDiff) {
    lines.push('Исполняемого frontend-диффа нет (src/**/*.ts не тронут).');
    lines.push('Browser-smoke этим диффом не выбираются — это не «пропустить проверки»,');
    lines.push('а «выбирать нечего»: смоки проверяют собранную карточку.');
    if (selection.files.length) lines.push(`Тронуто файлов: ${selection.files.length}.`);
    return lines.join('\n');
  }
  lines.push(`Изменено файлов src/**: ${selection.executable.length}`
    + ` · символов проекта на изменённых строках: ${selection.symbols.length}`);
  lines.push(`Матрица: ${selection.smokeCount} смоков · порог «широкого» символа:`
    + ` больше ${selection.broadLimit} смоков`);
  lines.push('');

  const strong = selection.direct.filter((entry) => entry.strong);
  const weak = selection.direct.filter((entry) => !entry.strong);
  const listing = (entries) => {
    for (const entry of entries) {
      lines.push(`  demo/${entry.smoke}`);
      lines.push(`    ← ${entry.symbols.slice(0, 6).join(', ')}`
        + (entry.symbols.length > 6 ? ` и ещё ${entry.symbols.length - 6}` : ''));
    }
  };
  if (strong.length) {
    lines.push(`Прямое совпадение (${strong.length}):`);
    listing(strong);
    lines.push('');
  }
  if (weak.length) {
    lines.push(`Слабая связь — одно распространённое имя, решает ревьюер`
      + ` (${weak.length}):`);
    listing(weak);
    lines.push('');
  }

  if (selection.registered.length) {
    lines.push(`Зарегистрированная связь (${selection.registered.length}):`);
    for (const entry of selection.registered) {
      lines.push(`  demo/${entry.smoke}`);
      lines.push(`    ← ${entry.symbols.join(', ')}`);
      for (const because of entry.because) lines.push(`    ${because}`);
    }
    lines.push('');
  }

  if (selection.unproven) {
    lines.push('НЕОПРЕДЕЛЁННОСТЬ: дифф исполняемый, но ни один смок не связан'
      + ' доказуемо.');
    lines.push('Это не значит «смоки не нужны»: значит, что связь не доказана'
      + ' и решает ревьюер.');
    if (selection.broad.length) {
      lines.push(`Широкие символы (есть почти везде, ничего не различают):`
        + ` ${selection.broad.slice(0, 10).join(', ')}`);
    }
    if (selection.unseen.length) {
      lines.push('Символы, которых нет ни в одном смоке:'
        + ` ${selection.unseen.slice(0, 10).join(', ')}`
        + (selection.unseen.length > 10 ? ` и ещё ${selection.unseen.length - 10}` : ''));
      lines.push('Если один из них — новый контракт, ему нужен новый смок либо'
        + ' запись в scripts/smoke-links.mjs.');
    }
    lines.push('');
  } else if (selection.broad.length) {
    lines.push(`Не учитывались как широкие: ${selection.broad.slice(0, 10).join(', ')}`);
    lines.push('');
  }

  lines.push('Выборка дополняет AC задачи и суждение ревьюера, а не заменяет их.');
  lines.push('Полный прогон матрицы остаётся предрелизной обязанностью на точном SHA.');
  return lines.join('\n');
}

function main(argv) {
  const arg = (name) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const diffPath = arg('--diff');
  const base = arg('--base');
  const head = arg('--head') || 'HEAD';
  let diffText;
  if (diffPath) {
    diffText = diffPath === '-' ? readFileSync(0, 'utf8') : readFileSync(diffPath, 'utf8');
  } else if (base) {
    diffText = gitDiff(base, head);
  } else {
    console.error('использование: smoke-select.mjs --base <ref> [--head <ref>] | --diff <файл|->');
    return 2;
  }
  const selection = selectSmokes(diffText);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(selection, null, 2));
  } else {
    console.log(report(selection));
  }
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main(process.argv.slice(2)));
}
