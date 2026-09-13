#!/usr/bin/env node
/**
 * Граница доверия между стадией модели и привилегированной публикацией (#556).
 *
 * `model_review` — единственная недоверенная стадия конвейера: там исполняется
 * чужой код с Read/Write/Bash. Всё, что она может передать дальше, — один
 * artifact. Публикация разбора, перестановка метки и слияние в `dev` идут в
 * другой job, на чистом checkout `dev`, и обязаны принимать этот artifact как
 * недоверенный ввод: полный набор файлов, сходящиеся контрольные суммы и
 * совпадение КАЖДОГО поля паспорта с тем, что посчитала детерминированная
 * стадия `prepare`. Подменённый, неполный, устаревший или чужой результат
 * отвергается fail-closed.
 *
 * Проверка вынесена из inline-shell в функцию именно ради враждебных фикстур:
 * в YAML её нельзя прогнать ни одним отрицательным случаем.
 *
 *   node scripts/review-result-gate.mjs --dir=<путь>   # поля ожидания из env
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Ровно эти файлы и ни одного больше: лишний файл — это уже чужой artifact. */
export const REQUIRED_FILES = ['manifest.sha256', 'prepared.json', 'review-document.md', 'verdict.json'];
/** Паспорт материала. Каждое поле сверяется с outputs стадии `prepare`. */
export const PASSPORT_FIELDS = [
  'run_id', 'run_attempt', 'issue', 'stage', 'cycle', 'branch',
  'material_sha', 'material_tree', 'material_specs', 'material_issue_body',
  'validate_result', 'validate_url', 'rebase_note', 'validated_note',
  'spec_body_changed', 'spec_body_doc', 'spec_body_recorded',
];
export const VERDICTS = ['green', 'yellow', 'red'];

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Разбор строки `sha256sum`: «<hex>  <имя>». */
export function parseManifest(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim()) continue;
    const match = /^([0-9a-f]{64})\s[\s*](.+)$/.exec(line);
    if (!match) return null;
    rows.push({ hash: match[1], name: match[2].trim() });
  }
  return rows;
}

/**
 * @param {object} p
 * @param {string[]} p.files   имена файлов в каталоге artifact
 * @param {(name:string)=>string} p.read  содержимое файла
 * @param {Record<string,string>} p.expected  паспорт, посчитанный `prepare`
 * @returns {string[]} причины отказа; пустой массив — принять
 */
export function reviewResultProblems({ files, read, expected }) {
  const problems = [];
  const actual = [...files].sort();
  const wanted = [...REQUIRED_FILES].sort();
  if (actual.join(',') !== wanted.join(',')) {
    return [`набор файлов не тот: ожидалось ${wanted.join(', ')}, получено ${actual.join(', ') || '(пусто)'}`];
  }

  const manifest = parseManifest(read('manifest.sha256'));
  if (!manifest) return ['manifest.sha256 не разобран'];
  const covered = manifest.map((row) => row.name).sort();
  const mustCover = REQUIRED_FILES.filter((name) => name !== 'manifest.sha256').sort();
  if (covered.join(',') !== mustCover.join(',')) {
    problems.push(`manifest покрывает не те файлы: ${covered.join(', ') || '(пусто)'}`);
  }
  for (const row of manifest) {
    if (!REQUIRED_FILES.includes(row.name)) continue;
    const digest = sha256(read(row.name));
    if (digest !== row.hash) problems.push(`контрольная сумма не сходится: ${row.name}`);
  }

  if (!String(read('review-document.md')).trim()) problems.push('документ ревью пуст');

  let prepared;
  try {
    prepared = JSON.parse(read('prepared.json'));
  } catch (error) {
    return [...problems, `prepared.json не разобран: ${error.message}`];
  }
  if (prepared?.schema !== 1) problems.push('prepared.json: не та схема');
  for (const field of PASSPORT_FIELDS) {
    const want = expected[field] ?? '';
    const got = prepared?.[field] ?? '';
    if (String(got) !== String(want)) {
      problems.push(`паспорт не совпал: ${field} = «${got}», ожидалось «${want}»`);
    }
  }

  let verdict;
  try {
    verdict = JSON.parse(read('verdict.json'));
  } catch (error) {
    return [...problems, `verdict.json не разобран: ${error.message}`];
  }
  if (!VERDICTS.includes(verdict?.verdict)) problems.push(`verdict вне словаря: ${JSON.stringify(verdict?.verdict)}`);
  if (typeof verdict?.high !== 'number') problems.push('verdict.high не число');
  if (typeof verdict?.medium !== 'number') problems.push('verdict.medium не число');
  if (typeof verdict?.summary !== 'string') problems.push('verdict.summary не строка');
  return problems;
}

const invokedDirectly = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  const dir = process.argv.find((a) => a.startsWith('--dir='))?.slice(6);
  if (!dir) { console.error('usage: review-result-gate.mjs --dir=<путь>'); process.exit(2); }
  const env = (name) => process.env[name.toUpperCase()] ?? '';
  const expected = Object.fromEntries(PASSPORT_FIELDS.map((field) => [field, env(field)]));
  expected.run_id = process.env.GITHUB_RUN_ID ?? '';
  expected.run_attempt = process.env.GITHUB_RUN_ATTEMPT ?? '';
  const problems = reviewResultProblems({
    files: readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name),
    read: (name) => readFileSync(resolve(dir, name), 'utf8'),
    expected,
  });
  if (problems.length) {
    for (const problem of problems) console.error(`::error::результат модели отвергнут — ${problem}`);
    process.exit(1);
  }
  console.log('результат модели полон, суммы сходятся, паспорт совпал');
}
