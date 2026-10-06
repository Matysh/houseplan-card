// Шаг workflow — так, как его исполняет раннер GitHub Actions (#766).
//
// Обвязки тестов гоняли тела `run:` под `bash -eo pipefail` «как у Actions»,
// а раннер исполняет шаг без `shell:` под `bash -e {0}`: пропущенный в шаге
// `set -o pipefail` тест не видел — защиту давала сама обвязка (#729, #737,
// #751). Здесь shell выбирается так же, как у раннера, и флагов от себя
// обвязка не добавляет. Порядок выбора:
//
//   1. `shell:` шага;
//   2. `jobs.<job_id>.defaults.run.shell`;
//   3. `defaults.run.shell` workflow;
//   4. не задан.
//
// Команды — таблица `jobs.<job_id>.steps[*].shell` синтаксиса workflow
// (https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsshell)
// и `_defaultArguments` раннера (https://github.com/actions/runner,
// src/Runner.Worker/Handlers/ScriptHandlerHelpers.cs); не Windows:
//
//   не задан → bash -e {0}       журнал шага: `shell: /usr/bin/bash -e {0}`
//   bash     → bash --noprofile --norc -e -o pipefail {0}
//   sh       → sh -e {0}
//   python   → python {0}
//   иначе    → «команда [опции] {0} [опции]» как написано: первое слово —
//              команда, `{0}` — путь файла; строку без `{0}` раннер отвергает.
//
// `pipefail` даёт только явный `shell: bash` — либо `set -o pipefail` в теле.
// Тело пишется во временный файл и исполняется по пути: раннер тоже пишет
// `$RUNNER_TEMP/<uuid>.sh`, а не передаёт текст через `-c`.
//
// YAML разбирается построчно, как в соседних тестах: блочные отображения и
// списки, скаляры в строку и блочные `|`/`>`. Чего разбор не понимает
// (потоковые `{…}`/`[…]`, якоря, кавычки на несколько строк), то он
// отвергает с номером строки, а не угадывает.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Встроенные shell раннера; ключ — значение `shell:`. */
export const RUNNER_SHELLS = Object.freeze({
  bash: 'bash --noprofile --norc -e -o pipefail {0}',
  sh: 'sh -e {0}',
  python: 'python {0}',
});
/** Шаг без `shell:` на Linux (bash найден в PATH). */
export const RUNNER_DEFAULT_SHELL = 'bash -e {0}';
/** Встроенные PowerShell и cmd: обвязка их не исполняет — отказ, а не подмена bash. */
const FOREIGN_SHELLS = new Set(['pwsh', 'powershell', 'cmd']);

const indentOf = (line) => line.length - line.trimStart().length;
const blank = (line) => line.trim() === '';
const comment = (line) => line.trimStart().startsWith('#');
const meaningful = (line) => !blank(line) && !comment(line) && line.trim() !== '---';
const KEY = /^(\s*)([A-Za-z_][\w.-]*):(?:\s+(.*))?$/;
const BLOCK_HEADER = /^([|>])(?:([1-9])([-+])?|([-+])([1-9])?)?\s*(?:#.*)?$/;

/** Скаляр в строку: простой, '…' или "…"; блочный `|`/`>` — `null` (читает blockScalar). */
function inlineScalar(raw, where) {
  const text = String(raw ?? '').trim();
  if (text === '' || text.startsWith('#')) return '';
  if (BLOCK_HEADER.test(text)) return null;
  if (text.startsWith("'")) {
    const m = /^'((?:[^']|'')*)'\s*(?:#.*)?$/.exec(text);
    assert.ok(m, `${where}: строка в одинарных кавычках не закрыта`);
    return m[1].replaceAll("''", "'");
  }
  if (text.startsWith('"')) {
    const m = /^"((?:[^"\\]|\\.)*)"\s*(?:#.*)?$/.exec(text);
    assert.ok(m, `${where}: строка в двойных кавычках не закрыта`);
    try { return JSON.parse(`"${m[1]}"`); } catch { assert.fail(`${where}: экранирование не разбираю: ${text}`); }
  }
  assert.ok(!/^[[{&*!%@`]/.test(text), `${where}: потоковый узел, якорь или тег не разбираю: ${text}`);
  return text.replace(/\s+#.*$/, '');
}

/** Блочный скаляр после строки `at` с ключом на отступе `keyIndent`. */
function blockScalar(lines, at, keyIndent, header, where) {
  const m = BLOCK_HEADER.exec(header.trim());
  const style = m[1];
  const explicit = Number(m[2] || m[5] || 0);
  const chomp = m[3] || m[4] || '';
  let content = explicit ? keyIndent + explicit : null;
  let end = at + 1;
  for (; end < lines.length; end += 1) {
    const line = lines[end];
    if (blank(line)) continue;
    const indent = indentOf(line);
    if (content === null) {
      if (indent <= keyIndent) break;
      content = indent;
    }
    if (indent < content) {
      assert.ok(indent <= keyIndent, `${where}: строка ${end + 1} левее тела блока и правее ключа`);
      break;
    }
  }
  const body = lines.slice(at + 1, end).map((line) => (blank(line) ? '' : line.slice(content ?? 0)));
  const kept = [...body];
  while (body.length && body.at(-1) === '') body.pop();
  let text;
  if (style === '|') text = body.join('\n');
  else {
    // `>`: строки абзаца — через пробел, пустая строка — перевод строки;
    // строки с бо́льшим отступом не сворачиваются.
    text = '';
    body.forEach((line, i) => {
      const prev = body[i - 1];
      if (i === 0) text = line;
      else if (line === '' || prev === '' || /^\s/.test(line) || /^\s/.test(prev)) text += `\n${line}`;
      else text += ` ${line}`;
    });
  }
  if (chomp === '-') return { text, end };
  if (chomp === '+') return { text: `${text}\n${kept.slice(body.length).map(() => '\n').join('')}`, end };
  return { text: body.length ? `${text}\n` : '', end };
}

/**
 * Прямые ключи отображения в строках `[from, to)`: отступ — у первой значимой
 * строки. Элементы списка на отступе ключа (`steps:` и `- …` вровень)
 * принадлежат предыдущему ключу.
 */
function mappingKeys(lines, from, to, where) {
  let first = from;
  while (first < to && !meaningful(lines[first])) first += 1;
  if (first >= to) return [];
  const indent = indentOf(lines[first]);
  const keys = [];
  for (let i = first; i < to; i += 1) {
    const line = lines[i];
    if (!meaningful(line) || indentOf(line) !== indent) continue;
    if (/^\s*-(\s|$)/.test(line) && keys.length) continue;
    const m = KEY.exec(line);
    assert.ok(m, `${where}: строка ${i + 1} не разбирается как ключ отображения: ${line.trim()}`);
    keys.push({ key: m[2], value: m[3] ?? '', at: i, indent });
  }
  keys.forEach((key, j) => { key.end = j + 1 < keys.length ? keys[j + 1].at : to; });
  return keys;
}

const childOf = (lines, node, key, where) => mappingKeys(lines, node.at + 1, node.end, where)
  .find((k) => k.key === key) ?? null;

/** Значение ключа: скаляр в строку или блочный скаляр. */
function valueOf(lines, node, where) {
  const inline = inlineScalar(node.value, `${where}, строка ${node.at + 1}`);
  if (inline !== null) return inline;
  return blockScalar(lines, node.at, node.indent, node.value, `${where}, строка ${node.at + 1}`).text;
}

/** `defaults.run.shell` узла (workflow или job) либо `null`. */
function defaultsShell(lines, node, where) {
  const defaults = childOf(lines, node, 'defaults', where);
  if (!defaults) return null;
  const empty = (node) => /^\s*(#.*)?$/.test(node.value);
  assert.ok(empty(defaults), `${where}: defaults в одну строку не разбираю`);
  const run = childOf(lines, defaults, 'run', where);
  if (!run) return null;
  assert.ok(empty(run), `${where}: defaults.run в одну строку не разбираю`);
  const shell = childOf(lines, run, 'shell', where);
  return shell ? valueOf(lines, shell, where) : null;
}

/** Элементы блочного списка в строках `[from, to)`. */
function listItems(lines, from, to, where) {
  let first = from;
  while (first < to && !meaningful(lines[first])) first += 1;
  if (first >= to) return [];
  assert.match(lines[first], /^\s*-(\s|$)/, `${where}: строка ${first + 1} — не элемент списка`);
  const indent = indentOf(lines[first]);
  const starts = [];
  for (let i = first; i < to; i += 1) {
    if (meaningful(lines[i]) && indentOf(lines[i]) === indent && /^\s*-(\s|$)/.test(lines[i])) starts.push(i);
  }
  return starts.map((at, j) => ({ at, end: j + 1 < starts.length ? starts[j + 1] : to, indent }));
}

/**
 * Все шаги workflow: `{ job, line, last, name, id, run, shell, shellFrom }`
 * (`line`…`last` — строки шага, с единицы).
 * `run` — тело так, как его прочтёт YAML (`null` у шага `uses:`); `shell` —
 * значение по правилам раннера (`null` — не задан), `shellFrom` — откуда оно:
 * `step`, `job`, `workflow` или `null`.
 */
export function workflowSteps(text, where = 'workflow') {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const root = { at: -1, end: lines.length };
  const workflowShell = defaultsShell(lines, root, where);
  const jobs = childOf(lines, root, 'jobs', where);
  if (!jobs) return [];
  const steps = [];
  for (const job of mappingKeys(lines, jobs.at + 1, jobs.end, where)) {
    const jobWhere = `${where}, job ${job.key}`;
    const jobShell = defaultsShell(lines, job, jobWhere);
    const list = childOf(lines, job, 'steps', jobWhere);
    if (!list) continue;
    for (const item of listItems(lines, list.at + 1, list.end, jobWhere)) {
      // Первый ключ шага стоит на строке `- `: для разбора тире — пробелы.
      const view = [...lines];
      view[item.at] = lines[item.at].replace(/-(\s|$)/, ' $1');
      const keys = mappingKeys(view, item.at, item.end, jobWhere);
      const field = (name) => keys.find((k) => k.key === name) ?? null;
      const stepWhere = `${jobWhere}, шаг в строке ${item.at + 1}`;
      const own = field('shell');
      const shell = own ? valueOf(view, own, stepWhere) : jobShell ?? workflowShell;
      const run = field('run');
      steps.push({
        job: job.key,
        line: item.at + 1,
        last: item.end,
        name: field('name') ? valueOf(view, field('name'), stepWhere) : null,
        id: field('id') ? valueOf(view, field('id'), stepWhere) : null,
        run: run ? valueOf(view, run, stepWhere) : null,
        shell,
        shellFrom: own ? 'step' : jobShell !== null ? 'job' : workflowShell !== null ? 'workflow' : null,
      });
    }
  }
  return steps;
}

/**
 * Один шаг: `marker` — подстрока текста workflow (шаг, в строках которого
 * лежит её первое вхождение), либо `{ name }` / `{ id }` — ровно один шаг.
 */
export function findStep(text, marker, where = 'workflow') {
  const steps = workflowSteps(text, where);
  if (typeof marker === 'string') {
    const at = String(text).indexOf(marker);
    assert.ok(at >= 0, `${where}: нет «${marker.trim()}»`);
    const line = String(text).slice(0, at).split('\n').length + (marker.startsWith('\n') ? 1 : 0);
    const step = steps.find((s) => s.line <= line && line <= s.last);
    assert.ok(step, `${where}: «${marker.trim()}» вне шагов`);
    return step;
  }
  const [key, value] = Object.entries(marker)[0] ?? [];
  const found = steps.filter((step) => key && step[key] === value);
  assert.equal(found.length, 1, `${where}: шагов с ${key} «${value}» — ${found.length}`);
  return found[0];
}

/** argv раннера для `shell` (значение шага или `null`) и файла тела `file`. */
export function runnerArgv(shell, file) {
  const value = shell === null || shell === undefined ? null : String(shell).trim();
  assert.ok(value === null || !FOREIGN_SHELLS.has(value), `shell «${value}»: обвязка его не исполняет`);
  const template = value === null ? RUNNER_DEFAULT_SHELL : RUNNER_SHELLS[value] ?? value;
  assert.ok(template.includes('{0}'),
    `shell «${value}»: не встроенный и без {0} — раннер такой шаг отвергает`);
  assert.ok(!/['"\\]/.test(template), `shell «${value}»: кавычки и экранирование обвязка не разбирает`);
  return template.split(/\s+/).filter(Boolean).map((word) => word.replaceAll('{0}', file));
}

/**
 * Команда для тела `script` шага `step` (по умолчанию — его `run`): тело
 * записано в файл во временном каталоге `dir`, который убирает вызывающий.
 */
export function stepCommand(step, script = step?.run) {
  assert.ok(step && 'shell' in step, 'нужен шаг из findStep/workflowSteps (или { shell })');
  assert.equal(typeof script, 'string', 'тело шага — строка');
  const dir = mkdtempSync(join(tmpdir(), 'hp-step-'));
  const file = join(dir, step.shell === 'python' ? 'step.py' : 'step.sh');
  writeFileSync(file, script);
  const [command, ...args] = runnerArgv(step.shell, file);
  return { command, args, dir, file };
}

/** Исполнить тело шага как раннер; результат — spawnSync. */
export function runStep(step, script = step?.run, options = {}) {
  const { command, args, dir } = stepCommand(step, script);
  try {
    return spawnSync(command, args, { encoding: 'utf8', ...options });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
