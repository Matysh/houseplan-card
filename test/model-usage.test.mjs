import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  USAGE_KEYS, USAGE_REASONS, formatUsage, lastUsageIn, parseUsageLine, publishedUsageLine,
  usageFromExecutionFile, usageFromMessages,
} from '../scripts/model-usage.mjs';
import { REQUIRED_FILES } from '../scripts/review-result-gate.mjs';

// #737: расход сессии модели — одной машинной строкой в документе ревью.
// Шаг `Review` (claude-code-action) отдаёт `execution_file` — все сообщения
// сессии SDK, включая результаты инструментов. Из них берётся только последнее
// `result`; остальное — возможные секреты, и ни одна их буква не выходит наружу.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = join(ROOT, 'scripts', 'model-usage.mjs');
const TOKEN = 'ghs_' + 'Z9y8X7w6V5u4T3s2R1q0P9o8N7m6L5k4J3i2';
const DATA = '<!-- hp:usage input_tokens=97209 output_tokens=55524 cache_creation_input_tokens=149047 cache_read_input_tokens=1135731 num_turns=42 -->';

const tempDir = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-737-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

/** Сессия так, как её пишет action: init, ход модели, результат инструмента с секретом, result. */
const session = (result) => [
  { type: 'system', subtype: 'init', session_id: 'session-123', model: 'claude-opus-5' },
  { type: 'assistant', message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'env' } }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: `GH_TOKEN=${TOKEN}\n<!-- hp:usage input_tokens=1 -->` }] } },
  ...(result ? [result] : []),
];
// Поля `modelUsage` — как в фикстуре action на пине (base-action/test/run-claude-sdk.test.ts).
const RESULT = {
  type: 'result', subtype: 'success', is_error: false, duration_ms: 434, num_turns: 42, total_cost_usd: 1.23,
  // `usage` при непустом `modelUsage` не читается: суммы — по моделям.
  usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 1, cache_read_input_tokens: 1 },
  modelUsage: {
    'claude-opus-5': {
      inputTokens: 96209, outputTokens: 55324, cacheReadInputTokens: 1135701, cacheCreationInputTokens: 149043,
      webSearchRequests: 0, costUSD: 1.23, contextWindow: 200000, maxOutputTokens: 64000,
    },
    'claude-haiku-4-5': {
      inputTokens: 1000, outputTokens: 200, cacheReadInputTokens: 30, cacheCreationInputTokens: 4,
      webSearchRequests: 0, costUSD: 0.01, contextWindow: 200000, maxOutputTokens: 8192,
    },
  },
};
const USAGE_ONLY = {
  type: 'result', subtype: 'success', num_turns: 7,
  usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 30, cache_read_input_tokens: 40, server_tool_use: { web_search_requests: 0 } },
};

function cli(t, content, { raw = false, path = null } = {}) {
  let file = path;
  if (content !== undefined) {
    file = join(tempDir(t), 'claude-execution-output.json');
    writeFileSync(file, raw ? content : JSON.stringify(content, null, 2));
  }
  const args = file === null ? [CLI] : [CLI, `--execution-file=${file}`];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(r.status, 0, `код выхода CLI — 0: ${r.stderr}`);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(TOKEN), 'строки токена из файла в выводе нет');
  assert.ok(!`${r.stdout}${r.stderr}`.includes('GH_TOKEN'), 'ничего из результатов инструментов в выводе нет');
  assert.equal(r.stderr, '');
  return r.stdout;
}

test('#737 AC1: суммы по моделям из последнего result и num_turns; секрет из tool_result в вывод не попадает', (t) => {
  assert.equal(cli(t, session(RESULT)), `${DATA}\n`);
  assert.deepEqual(usageFromMessages(session(RESULT)), parseUsageLine(DATA));
  // Последний result, а не первый.
  const earlier = { ...USAGE_ONLY, num_turns: 1 };
  assert.equal(cli(t, [...session(earlier), RESULT]), `${DATA}\n`);
  // Упавшая сессия (max-turns, is_error) расход тоже несёт.
  assert.equal(cli(t, session({ ...RESULT, subtype: 'error_max_turns', is_error: true })), `${DATA}\n`);
});

test('#737 AC1: без modelUsage (или с пустым) — те же ключи из result.usage', (t) => {
  const expected = '<!-- hp:usage input_tokens=10 output_tokens=20 cache_creation_input_tokens=30 cache_read_input_tokens=40 num_turns=7 -->\n';
  assert.equal(cli(t, session(USAGE_ONLY)), expected);
  assert.equal(cli(t, session({ ...USAGE_ONLY, modelUsage: {} })), expected);
});

test('#737 AC1: нет данных — причина вместо чисел, код выхода 0', (t) => {
  const none = (reason) => `<!-- hp:usage-none reason=${reason} -->\n`;
  assert.equal(cli(t, session(null)), none('no-result'), 'сообщения result нет');
  assert.equal(cli(t, []), none('no-result'));
  assert.equal(cli(t, undefined, { path: join(tempDir(t), 'absent.json') }), none('no-execution-file'), 'файла нет');
  assert.equal(cli(t, undefined, { path: '' }), none('no-execution-file'), 'выход execution_file пуст');
  assert.equal(cli(t, undefined), none('no-execution-file'), 'флага нет');
  assert.equal(cli(t, `GH_TOKEN=${TOKEN} — не JSON {`, { raw: true }), none('unreadable'), 'не JSON — без цитаты текста');
  assert.equal(cli(t, '', { raw: true }), none('unreadable'), 'пустой файл');
  assert.equal(cli(t, { type: 'result', ...USAGE_ONLY }), none('unreadable'), 'не массив');
  assert.equal(cli(t, undefined, { path: tempDir(t) }), none('unreadable'), 'вместо файла каталог');
  assert.equal(cli(t, session({ type: 'result', subtype: 'success', num_turns: 3 })), none('no-usage'));
  const model = RESULT.modelUsage['claude-opus-5'];
  for (const [label, result] of [
    ['дробное значение', { ...RESULT, modelUsage: { m: { ...model, inputTokens: 1.5 } } }],
    ['отрицательное', { ...RESULT, modelUsage: { m: { ...model, outputTokens: -1 } } }],
    ['строка вместо числа', { ...USAGE_ONLY, usage: { ...USAGE_ONLY.usage, cache_read_input_tokens: '40' } }],
    ['поле модели пропущено', { ...RESULT, modelUsage: { m: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 1 } } }],
    ['num_turns нет', { ...USAGE_ONLY, num_turns: undefined }],
    ['13 цифр', { ...USAGE_ONLY, num_turns: 1e12 }],
  ]) assert.equal(cli(t, session(result)), none('unreadable'), label);
});

test('#737 AC1: usageFromExecutionFile не читает путь, которого нет, и терпит любой сбой чтения', () => {
  assert.deepEqual(usageFromExecutionFile(''), { reason: 'no-execution-file' });
  assert.deepEqual(usageFromExecutionFile('x', () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }); }), { reason: 'no-execution-file' });
  assert.deepEqual(usageFromExecutionFile('x', () => { throw Object.assign(new Error('x'), { code: 'EACCES' }); }), { reason: 'unreadable' });
  assert.deepEqual(usageFromExecutionFile('x', () => JSON.stringify(session(USAGE_ONLY))).num_turns, 7);
  assert.deepEqual(usageFromMessages('[]'), { reason: 'unreadable' });
});

// ---------- К2: формат строки ----------

test('#737 AC2: разбор и сборка взаимно обратны; ровно пять ключей и шесть причин', () => {
  assert.deepEqual(USAGE_KEYS, ['input_tokens', 'output_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'num_turns']);
  assert.deepEqual(USAGE_REASONS, ['no-execution-file', 'unreadable', 'no-result', 'no-usage', 'missing', 'invalid']);
  const zero = '<!-- hp:usage input_tokens=0 output_tokens=0 cache_creation_input_tokens=0 cache_read_input_tokens=0 num_turns=0 -->';
  const max = '<!-- hp:usage input_tokens=999999999999 output_tokens=1 cache_creation_input_tokens=2 cache_read_input_tokens=3 num_turns=4 -->';
  for (const line of [DATA, zero, max, ...USAGE_REASONS.map((reason) => `<!-- hp:usage-none reason=${reason} -->`)]) {
    const parsed = parseUsageLine(line);
    assert.ok(parsed, line);
    assert.equal(formatUsage(parsed), line);
    assert.deepEqual(parseUsageLine(formatUsage(parsed)), parsed);
    assert.equal(publishedUsageLine(line), line, 'публикация пропускает строку по формату как есть');
    assert.equal(publishedUsageLine(` ${line}\n`), line, 'пробелы по краям выхода job не в счёт');
  }
  assert.throws(() => formatUsage({ ...parseUsageLine(DATA), num_turns: 1.5 }), TypeError);
  assert.throws(() => formatUsage({ reason: 'later' }), TypeError);
});

test('#737 AC2: отвергается всё не по формату — публикация пишет invalid, пусто — missing', () => {
  const swap = (from, to) => DATA.replace(from, to);
  const hex40 = 'a'.repeat(40);
  for (const [label, line] of [
    ['лишний ключ', swap(' num_turns=42', ' num_turns=42 total_cost_usd=1')],
    ['пропущенный ключ', swap(' num_turns=42', '')],
    ['другой порядок', swap('input_tokens=97209 output_tokens=55524', 'output_tokens=55524 input_tokens=97209')],
    ['знак +', swap('=97209', '=+97209')],
    ['знак −', swap('=97209', '=-97209')],
    ['дробь', swap('=97209', '=97209.5')],
    ['13 цифр', swap('=97209', '=1234567890123')],
    ['ведущий ноль', swap('=97209', '=097209')],
    ['--> внутри', swap('=97209', '=97209 -->')],
    ['перевод строки внутри', swap(' output_tokens', '\noutput_tokens')],
    ['40 hex-символов', swap('=97209', `=${hex40}`)],
    ['40 hex-символов в причине', `<!-- hp:usage-none reason=${hex40} -->`],
    ['неизвестная причина', '<!-- hp:usage-none reason=later -->'],
    ['причина без пробела', '<!-- hp:usage-none reason=missing-->'],
    ['двойной пробел', swap(' output_tokens', '  output_tokens')],
    ['без пробела после hp:usage', swap('hp:usage ', 'hp:usage')],
    ['ключ в верхнем регистре', swap('input_tokens', 'INPUT_TOKENS')],
    ['проза вокруг', `см. ${DATA}`],
  ]) {
    assert.equal(parseUsageLine(line), null, label);
    assert.equal(publishedUsageLine(line), '<!-- hp:usage-none reason=invalid -->', label);
    assert.doesNotMatch(publishedUsageLine(line), /[0-9a-f]{40}/, label);
  }
  for (const empty of ['', '  ', '\n', null, undefined]) {
    assert.equal(publishedUsageLine(empty), '<!-- hp:usage-none reason=missing -->', JSON.stringify(empty));
  }
});

test('#737 AC2: строку данных читает предварительный разбор #728, hp:usage-none — нет', () => {
  // Разбор #728 вписан буквально: откат читателя не сломает чтение данных и не
  // превратит «нет данных» в документ с пустой суммой.
  const usageRe = /<!--\s*hp:usage\s+([^>]*?)\s*-->/g;
  const read728 = (text) => {
    const totals = {};
    let found = 0;
    for (const match of text.matchAll(usageRe)) {
      found += 1;
      for (const [, key, value] of match[1].matchAll(/([a-z_]+)=(\d+)/g)) totals[key] = (totals[key] || 0) + Number(value);
    }
    return { found, totals };
  };
  assert.deepEqual(read728(`текст\n${DATA}\n`), { found: 1, totals: parseUsageLine(DATA) });
  for (const reason of USAGE_REASONS) {
    assert.deepEqual(read728(`текст\n${formatUsage({ reason })}\n`), { found: 0, totals: {} }, reason);
  }
});

test('#737 lastUsageIn: последняя строка формата в тексте блока; строка не по формату не в счёт', () => {
  const other = '<!-- hp:usage-none reason=missing -->';
  assert.deepEqual(lastUsageIn(`a\n${DATA}\n${other}\n`), { reason: 'missing' });
  assert.deepEqual(lastUsageIn(`a\n${other}\n  ${DATA}  \nb`), parseUsageLine(DATA));
  assert.equal(lastUsageIn(`a\n<!-- hp:usage input_tokens=1 -->\nтекст ${DATA}`), null);
  assert.equal(lastUsageIn(''), null);
});

// ---------- К3: проводка в обоих workflow ----------

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
// #765: в _process.yml рабочая копия model_review — материал ревью (ветка задачи
// может отставать от dev или подменять скрипт), поэтому скрипт берётся снимком
// того коммита dev, что закрепила подготовка (`tools_sha`). В _ship-review.yml
// рабочая копия — кандидат линии dev, и скрипт зовётся из неё.
const PIPELINES = [
  {
    file: '_process.yml', publishJob: 'integrate', publishStep: 'Опубликовать документ ревью', consumes: /^ +--usage="\$USAGE" \\$/m,
    call: /^line=\$\(node "\$tools\/scripts\/model-usage\.mjs" --execution-file="\$EXEC"\)$/m, snapshot: true,
  },
  {
    file: '_ship-review.yml', publishJob: 'publish', publishStep: 'Опубликовать документ', consumes: /^ +usage: process\.env\.USAGE \?\? "",$/m,
    call: /^line=\$\(node scripts\/model-usage\.mjs --execution-file="\$EXEC"\)$/m, snapshot: false,
  },
];

/** Блок job верхнего уровня `jobs:` — до следующего id на двух пробелах. */
function jobBlock(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `job ${name}`);
  const rest = text.slice(start + 1);
  const end = rest.slice(1).search(/\n {2}[a-z_]+:\n/);
  return end < 0 ? rest : rest.slice(0, end + 2);
}
/** Шаги job: куски от `      - ` до следующего такого же. */
const stepsOf = (job) => job.slice(job.indexOf('\n    steps:\n')).split(/\n {6}- /).slice(1).map((step) => `      - ${step}`);
/** Тело `run: |` шага, как его прочтёт YAML (блок кончается на строке с отступом меньше десяти). */
function runOf(step) {
  const lines = step.split('\n');
  const from = lines.indexOf('        run: |');
  assert.ok(from > 0, `у шага есть run: |\n${step.slice(0, 200)}`);
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !/^ {10}/.test(line)) break;
    body.push(line.replace(/^ {10}/, ''));
  }
  return body.join('\n').replace(/\$\{\{ github\.repository \}\}/g, 'o/r');
}
const named = (steps, name) => {
  const step = steps.find((item) => item.startsWith(`      - name: ${name}\n`));
  assert.ok(step, `шаг «${name}»`);
  return step;
};
const hasBash = () => process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0;

test('#737 AC5: шаг снятия расхода сразу после Review — always, continue-on-error, выход job usage; публикация его берёт', () => {
  for (const { file, publishJob, publishStep, consumes, call } of PIPELINES) {
    const text = readFileSync(join(WORKFLOWS, file), 'utf8');
    const model = jobBlock(text, 'model_review');
    const steps = stepsOf(model);
    const review = steps.findIndex((step) => /^ {8}id: review$/m.test(step));
    assert.ok(review >= 0, `${file}: шаг id: review`);
    const usage = steps[review + 1];
    assert.ok(usage.startsWith('      - name: Снять расход модели\n'), `${file}: следующий за Review шаг — снятие расхода`);
    assert.match(usage, /^ {8}id: usage$/m, file);
    assert.match(usage, /^ {8}if: always\(\)$/m, `${file}: расход упавшей сессии тоже в сводке`);
    assert.match(usage, /^ {8}continue-on-error: true$/m, `${file}: сбой снятия не роняет стадию`);
    assert.match(usage, /^ {10}EXEC: \$\{\{ steps\.review\.outputs\.execution_file \}\}$/m, file);
    const run = runOf(usage);
    assert.match(run, call, file);
    assert.match(run, /^echo "line=\$line" >> "\$GITHUB_OUTPUT"$/m, file);
    assert.match(run, /"\$GITHUB_STEP_SUMMARY"$/m, `${file}: строка — в сводку шага`);
    const head = model.slice(0, model.indexOf('\n    steps:\n'));
    assert.match(head, /^ {4}outputs:\n(?: {6}[^\n]*\n)*? {6}usage: \$\{\{ steps\.usage\.outputs\.line \}\}$/m, `${file}: выход job usage`);
    const publish = named(stepsOf(jobBlock(text, publishJob)), publishStep);
    assert.match(publish, /^ {10}USAGE: \$\{\{ needs\.model_review\.outputs\.usage \}\}$/m, `${file}: публикация берёт выход job`);
    assert.match(runOf(publish), consumes, file);
  }
  if (!hasBash()) return;
  // Изменённые тела проходят bash -n.
  for (const { file, publishJob, publishStep } of PIPELINES) {
    const text = readFileSync(join(WORKFLOWS, file), 'utf8');
    for (const body of [runOf(named(stepsOf(jobBlock(text, 'model_review')), 'Снять расход модели')),
      runOf(named(stepsOf(jobBlock(text, publishJob)), publishStep))]) {
      const r = spawnSync('bash', ['-n'], { input: body, encoding: 'utf8' });
      assert.equal(r.status, 0, `${file}: bash -n\n${r.stderr}`);
    }
  }
});

test('#737 AC5: execution_file никуда не выгружается, граница доверия #556 не изменилась', () => {
  for (const { file } of PIPELINES) {
    const code = readFileSync(join(WORKFLOWS, file), 'utf8').split('\n').filter((line) => !/^\s*#/.test(line));
    assert.ok(!code.some((line) => line.includes('claude-execution-output')), `${file}: файл сессии по имени не упоминается`);
    assert.deepEqual(code.filter((line) => line.includes('execution_file')),
      ['          EXEC: ${{ steps.review.outputs.execution_file }}'], `${file}: execution_file — только вход шага снятия`);
  }
  assert.deepEqual(REQUIRED_FILES, ['manifest.sha256', 'prepared.json', 'review-document.md', 'verdict.json'],
    'расход не входит в запечатанный artifact');
});

test('#737 AC5: шаг снятия расхода на настоящем bash — выход line и строка в сводке, секрета нет', (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  // #765: снимок — коммит HEAD этого дерева (скрипт расхода в нём тот же).
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
  for (const { file, snapshot } of PIPELINES) {
    const text = readFileSync(join(WORKFLOWS, file), 'utf8');
    const body = runOf(named(stepsOf(jobBlock(text, 'model_review')), 'Снять расход модели'));
    const dir = tempDir(t);
    const exec = join(dir, 'claude-execution-output.json');
    writeFileSync(exec, JSON.stringify(session(RESULT), null, 2));
    for (const [EXEC, line] of [[exec, DATA], ['', '<!-- hp:usage-none reason=no-execution-file -->']]) {
      const output = join(dir, 'output');
      const summary = join(dir, 'summary.md');
      rmSync(output, { force: true });
      rmSync(summary, { force: true });
      const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', body], {
        cwd: ROOT, encoding: 'utf8',
        env: { ...process.env, EXEC, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...(snapshot ? { TOOLS_SHA: head, RUNNER_TEMP: dir } : {}) },
      });
      assert.equal(r.status, 0, `${file}: ${r.stderr}`);
      assert.equal(readFileSync(output, 'utf8'), `line=${line}\n`, file);
      const printed = readFileSync(summary, 'utf8');
      assert.ok(printed.includes(line), `${file}: строка в сводке`);
      assert.equal(printed.split('\n').filter(Boolean).length, 1, `${file}: одна строка сводки`);
      for (const where of [r.stdout, r.stderr, printed]) assert.ok(!where.includes(TOKEN), `${file}: секрета нет`);
    }
  }
});
