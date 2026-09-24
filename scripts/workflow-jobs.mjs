// #622: имена и размеры матриц job Validate — из самого `validate.yml`.
//
// Ревью, слияние и релиз (ci-proof.mjs) опознают исполненную проверку по
// имени job в ответе API: это единственное, что GitHub отдаёт о job, кроме
// исхода. Имена жили строками в скриптах и тестах, а число шардов — константой
// `count: 6`; переименование job или смена матрицы давали
// `claimed execution is absent` у всех трёх потребителей без единого красного
// теста. Теперь число экземпляров матричной job читается отсюда, а имена
// сверяет контрактный тест (test/workflow-jobs.test.mjs) в обе стороны.
//
// Полноценного YAML-парсера в зависимостях нет, и заводить его ради одного
// файла незачем: разбирается ровно та структура, которую пишет validate.yml —
// `jobs:` на нулевом отступе, id job на двух пробелах, `name:` на четырёх,
// `strategy.matrix` со списками в строку (`shard: [1, 2, 3]`). Всё прочее
// (`include`, `fromJSON`, блочные списки) — громкая ошибка, а не догадка:
// разбор, который молча вернёт не то, повторил бы ровно ту беду, что чинится.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const VALIDATE_WORKFLOW_PATH = resolve(HERE, '..', '.github', 'workflows', 'validate.yml');

const indentOf = (line) => line.length - line.trimStart().length;
const isBlank = (line) => !line.trim() || line.trimStart().startsWith('#');

function unquote(raw, where) {
  const text = raw.trim();
  const quote = text[0];
  if (quote === '"' || quote === "'") {
    // Закрывающая кавычка ищется до комментария: `#` внутри кавычек — часть имени.
    let value = '';
    let i = 1;
    for (; i < text.length; i += 1) {
      const ch = text[i];
      if (quote === '"' && ch === '\\') { value += text[i + 1] ?? ''; i += 1; continue; }
      if (ch === quote) {
        if (quote === "'" && text[i + 1] === "'") { value += "'"; i += 1; continue; }
        break;
      }
      value += ch;
    }
    const rest = text.slice(i + 1).trim();
    if (i >= text.length || (rest && !rest.startsWith('#'))) throw new Error(`${where}: malformed quoted name ${JSON.stringify(text)}`);
    return value;
  }
  if (/^[|>]/.test(text)) throw new Error(`${where}: block scalar names are not supported`);
  return text.replace(/\s+#.*$/, '').trim();
}

function flowList(raw, where) {
  const value = raw.replace(/\s+#.*$/, '').trim();
  const match = value.match(/^\[(.*)\]$/);
  if (!match) throw new Error(`${where}: only inline lists like [1, 2, 3] are supported, got ${JSON.stringify(value)}`);
  const items = match[1].split(',').map((item) => item.trim()).filter(Boolean);
  if (!items.length) throw new Error(`${where}: empty matrix axis`);
  return items;
}

/**
 * Job-уровень workflow: id → { name, matrix: { axis: [values] } | null, size }.
 * `size` — сколько job GitHub развернёт из матрицы (произведение осей), 1 без неё.
 */
export function parseWorkflowJobs(text, file = 'workflow') {
  const lines = String(text).split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:\s*(#.*)?$/.test(line));
  if (start < 0) throw new Error(`${file}: no top-level "jobs:" key`);
  const jobs = new Map();
  let job = null;
  let section = null; // 'strategy' | 'matrix' | null
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (isBlank(line)) continue;
    const indent = indentOf(line);
    const where = `${file}:${i + 1}`;
    if (indent === 0) break; // следующий ключ верхнего уровня
    const key = line.trim().match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (indent === 2) {
      if (!key || key[2].trim()) throw new Error(`${where}: expected a job id, got ${JSON.stringify(line.trim())}`);
      if (jobs.has(key[1])) throw new Error(`${where}: duplicate job id ${key[1]}`);
      job = { id: key[1], name: null, matrix: null };
      jobs.set(job.id, job);
      section = null;
      continue;
    }
    if (!job) throw new Error(`${where}: content before the first job id`);
    if (indent === 4) {
      section = null;
      if (!key) continue;
      if (key[1] === 'name') {
        if (job.name !== null) throw new Error(`${where}: job ${job.id} has two names`);
        job.name = unquote(key[2], where);
        if (!job.name) throw new Error(`${where}: job ${job.id} has an empty name`);
      } else if (key[1] === 'strategy') {
        section = 'strategy';
      }
      continue;
    }
    if (section === 'strategy' && indent === 6) {
      if (key?.[1] === 'matrix') {
        if (key[2].trim()) throw new Error(`${where}: job ${job.id}: matrix expressions are not supported, list the axes explicitly`);
        section = 'matrix';
        job.matrix = {};
      }
      continue;
    }
    if (section === 'matrix') {
      if (indent === 6) { section = 'strategy'; if (key?.[1] === 'matrix') throw new Error(`${where}: duplicate matrix`); continue; }
      if (indent === 8) {
        if (!key) throw new Error(`${where}: unsupported matrix entry ${JSON.stringify(line.trim())}`);
        if (key[1] === 'include' || key[1] === 'exclude') throw new Error(`${where}: job ${job.id}: matrix ${key[1]} is not supported`);
        job.matrix[key[1]] = flowList(key[2], where);
        continue;
      }
      throw new Error(`${where}: unsupported matrix layout in job ${job.id}`);
    }
  }
  if (!jobs.size) throw new Error(`${file}: "jobs:" has no jobs`);
  for (const entry of jobs.values()) {
    if (!entry.name) throw new Error(`${file}: job ${entry.id} has no name — API would report the id, and consumers match by name`);
    if (entry.matrix && !Object.keys(entry.matrix).length) throw new Error(`${file}: job ${entry.id} has an empty matrix`);
    entry.size = entry.matrix ? Object.values(entry.matrix).reduce((n, axis) => n * axis.length, 1) : 1;
  }
  return jobs;
}

/** Неизменная часть имени: всё до первого `${{`. У матричной job это общий префикс её экземпляров. */
export const staticNamePrefix = (name) => String(name).split('${{')[0];

/**
 * Имена, под которыми GitHub покажет экземпляры job: шаблон `${{ matrix.<ось> }}`
 * раскрывается по всем сочетаниям осей в порядке их объявления. Другие
 * выражения в имени не раскрываются — громкая ошибка: угадать их значение
 * по файлу нельзя, а потребитель сверяет имя точно.
 */
export function jobInstanceNames(job) {
  const axes = Object.entries(job.matrix || {});
  let combos = [{}];
  for (const [axis, values] of axes) combos = combos.flatMap((combo) => values.map((value) => ({ ...combo, [axis]: value })));
  return combos.map((combo) => job.name.replace(/\$\{\{\s*([^}]*?)\s*\}\}/g, (whole, expr) => {
    const axis = expr.match(/^matrix\.([A-Za-z0-9_-]+)$/)?.[1];
    if (!axis || !(axis in combo)) throw new Error(`job ${job.id}: name expression ${whole} is not a declared matrix axis`);
    return combo[axis];
  }));
}

let cached = null;
/** Job-уровень `validate.yml` этого checkout; читается один раз на процесс. */
export function validateJobs(path = VALIDATE_WORKFLOW_PATH) {
  if (path !== VALIDATE_WORKFLOW_PATH) return parseWorkflowJobs(readFileSync(path, 'utf8'), path);
  if (!cached) cached = parseWorkflowJobs(readFileSync(path, 'utf8'), '.github/workflows/validate.yml');
  return cached;
}
