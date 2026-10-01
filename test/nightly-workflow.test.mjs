import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// #492 §7: ночной workflow обязан ждать дочерний Validate и наследовать его
// исход — успешный dispatch не равен успешной проверке.

const read = (name) => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

test('nightly ждёт запущенный Validate и падает вместе с ним (#492 §7)', () => {
  const nightly = read('_nightly.yml');
  assert.match(nightly, /gh workflow run validate\.yml --repo "\$REPO" --ref dev -f full=true/);
  // найти именно свой прогон: dispatch на dev, созданный не раньше запуска
  assert.match(nightly, /gh run list --repo "\$REPO" --workflow validate\.yml --branch dev/);
  assert.match(nightly, /--event workflow_dispatch/);
  assert.match(nightly, /createdAt >= /);
  // отсутствие прогона — ошибка, не тихий успех
  assert.match(nightly, /прогон Validate не появился[^\n]*\n\s+exit 1/);
  // ждать с наследованием кода возврата
  assert.match(nightly, /gh run watch "\$run_id" --repo "\$REPO" --exit-status/);
  assert.match(nightly, /timeout-minutes: 90/);
  assert.match(nightly, /set -euo pipefail/);
});

test('ночная job носит русское имя и не выдаёт очередь за результат (#327, #492)', () => {
  const nightly = read('_nightly.yml');
  assert.match(nightly, /name: "Запустить Validate на dev с полным набором и дождаться результата"/);
  assert.ok(!/поставлен в очередь[^\n]*\n\s*$/.test(nightly), 'echo про очередь не может быть последним шагом');
});

// ---------- #727 К6: ночное пакетное ревью ship после Validate ----------

/** Блок job верхнего уровня `jobs:` по имени. */
function job(text, name) {
  const start = text.indexOf(`\n  ${name}:\n`);
  assert.ok(start >= 0, `job ${name}`);
  const rest = text.slice(start + 1);
  const end = rest.slice(1).search(/\n  [a-z_]+:\n/);
  return end < 0 ? rest : rest.slice(0, end + 1);
}

/** Тело `run:` шага, как его прочтёт YAML (блок кончается на строке с отступом меньше десяти). */
function stepRun(text, name) {
  const start = text.indexOf(`      - name: "${name}"\n`);
  assert.ok(start >= 0, `шаг «${name}»`);
  const lines = text.slice(start).split('\n');
  const from = lines.indexOf('        run: |');
  assert.ok(from > 0, `у шага «${name}» есть run: |`);
  const body = [];
  for (const line of lines.slice(from + 1)) {
    if (line.trim() && !/^ {10}/.test(line)) break;
    body.push(line.replace(/^ {10}/, ''));
  }
  return body.join('\n').replace(/\$\{\{ github\.server_url \}\}/g, 'https://github.com');
}

const hasBash = () => process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0;

/**
 * Шаг на настоящем bash с подменённым `gh`: `workflow run` — в журнал (или отказ
 * при FAKE_DISPATCH=fail), `run list --jq …` — FAKE_RUN_ID (то, что вернул бы
 * фильтр), `run view --jq .headSha` — FAKE_HEAD, `run watch` — код FAKE_WATCH.
 */
function runStep(t, script, env = {}) {
  const root = mkdtempSync(join(tmpdir(), 'hp-727-night-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  writeFileSync(join(bin, 'gh'), [
    '#!/usr/bin/env bash',
    'echo "gh $*" >> "$FAKE_LOG"',
    'case "$1 $2" in',
    '  "workflow run") [ "${FAKE_DISPATCH:-ok}" = ok ] || { echo "HTTP 403" >&2; exit 1; } ;;',
    '  "run list") printf "%s\\n" "${FAKE_RUN_ID:-}" ;;',
    '  "run view") printf "%s\\n" "$FAKE_HEAD" ;;',
    '  "run watch") exit "${FAKE_WATCH:-0}" ;;',
    '  *) echo "unexpected gh $*" >&2; exit 1 ;;',
    'esac',
    '',
  ].join('\n'), { mode: 0o755 });
  writeFileSync(join(bin, 'sleep'), '#!/bin/sh\necho "sleep $*" >> "$FAKE_LOG"\n', { mode: 0o755 });
  const files = { log: join(root, 'log'), output: join(root, 'output'), summary: join(root, 'summary.md') };
  const r = spawnSync('bash', ['--noprofile', '--norc', '-e', '-c', script], {
    encoding: 'utf8',
    env: {
      ...process.env, PATH: `${bin}:${process.env.PATH}`, REPO: 'o/r', GH_TOKEN: 'x',
      FAKE_LOG: files.log, GITHUB_OUTPUT: files.output, GITHUB_STEP_SUMMARY: files.summary, ...env,
    },
  });
  const text = (path) => { try { return readFileSync(path, 'utf8'); } catch { return ''; } };
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, log: text(files.log).split('\n').filter(Boolean), output: text(files.output), summary: text(files.summary) };
}

const HEAD = 'abcdef0123456789abcdef0123456789abcdef01';

test('#727 AC6 К6: ночь после Validate при любом его исходе запускает ship-ревью на SHA прогона Validate', () => {
  const nightly = read('_nightly.yml');
  const dispatch = job(nightly, 'dispatch');
  const ship = job(nightly, 'ship_review');
  assert.match(ship, /\n    needs: dispatch\n/);
  assert.match(ship, /\n    if: always\(\)\n/, 'при любом исходе Validate');
  assert.match(ship, /\n    continue-on-error: true\n/, 'цвет ночи — цвет Validate');
  assert.match(ship, /gh workflow run ship-review\.yml --ref dev -f tag=nightly -f candidate="\$CANDIDATE"/);
  assert.match(ship, /CANDIDATE: \$\{\{ needs\.dispatch\.outputs\.head_sha \}\}/, 'SHA — из прогона Validate');
  assert.doesNotMatch(ship, /gh run watch/, 'ждёт только появления прогона, не конца');
  assert.match(ship, /for _ in \$\(seq 1 18\); do\n\s+sleep 10/, 'до трёх минут, как у Validate');
  assert.doesNotMatch(ship, /permissions:/, 'права — ночи (actions: write), тонкий файл не меняется');
  // SHA прогона Validate выводится отдельным шагом до ожидания.
  assert.match(dispatch, /head_sha: \$\{\{ steps\.validate\.outputs\.head_sha \}\}/);
  const found = dispatch.indexOf('      - name: "Запустить Validate и найти его прогон"\n        id: validate\n');
  const watch = dispatch.indexOf('      - name: "Дождаться Validate"');
  assert.ok(found > 0 && watch > found, 'вывод SHA — до шага ожидания');
  assert.match(stepRun(nightly, 'Запустить Validate и найти его прогон'), /head_sha=\$\(gh run view "\$run_id" --repo "\$REPO" --json headSha --jq \.headSha\)\necho "run_id=\$run_id" >> "\$GITHUB_OUTPUT"\necho "head_sha=\$head_sha" >> "\$GITHUB_OUTPUT"/);
  assert.doesNotMatch(stepRun(nightly, 'Запустить Validate и найти его прогон'), /gh run watch/);
  for (const name of ['Запустить Validate и найти его прогон', 'Дождаться Validate', 'Запустить ship-ревью и дождаться появления прогона']) {
    const body = stepRun(nightly, name);
    assert.equal(spawnSync('bash', ['-n', '-c', body]).status, 0, `bash -n: ${name}`);
    assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, `${name}: heredoc в run`);
  }
});

test('#727 AC6 на настоящем bash: SHA прогона Validate — в выходах до ожидания; красный Validate — красная job ожидания', (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const nightly = read('_nightly.yml');
  const found = runStep(t, stepRun(nightly, 'Запустить Validate и найти его прогон'), { FAKE_RUN_ID: '42', FAKE_HEAD: HEAD });
  assert.equal(found.status, 0, found.stderr);
  assert.match(found.output, /^run_id=42$/m);
  assert.match(found.output, new RegExp(`^head_sha=${HEAD}$`, 'm'));
  assert.ok(found.log.includes('gh workflow run validate.yml --repo o/r --ref dev -f full=true'));
  assert.ok(!found.log.some((call) => call.startsWith('gh run watch')), 'шаг вывода не ждёт');
  const red = runStep(t, stepRun(nightly, 'Дождаться Validate'), { RUN_ID: '42', FAKE_WATCH: '1' });
  assert.equal(red.status, 1, 'красный Validate — красная ночь');
  assert.ok(red.log.includes('gh run watch 42 --repo o/r --exit-status --interval 30'));
  const lost = runStep(t, stepRun(nightly, 'Запустить Validate и найти его прогон'), { FAKE_RUN_ID: '' });
  assert.equal(lost.status, 1);
  assert.match(lost.stdout, /::error::прогон Validate не появился за 3 минуты/);
});

test('#727 AC6 на настоящем bash: ship-ревью ночью — dispatch с tag=nightly, ждёт только появления; сбой — предупреждение', (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const step = stepRun(read('_nightly.yml'), 'Запустить ship-ревью и дождаться появления прогона');
  const ok = runStep(t, step, { CANDIDATE: HEAD, FAKE_RUN_ID: '77' });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.log[0], `gh workflow run ship-review.yml --ref dev -f tag=nightly -f candidate=${HEAD} --repo o/r`);
  assert.ok(ok.log.some((call) => call.startsWith('gh run list --repo o/r --workflow ship-review.yml --branch dev --event workflow_dispatch')));
  assert.ok(!ok.log.some((call) => call.startsWith('gh run watch')), 'конца прогона не ждёт');
  assert.equal(ok.summary, `- Ship-ревью ночью (\`${HEAD}\`): https://github.com/o/r/actions/runs/77\n`);
  // Прогон не появился за три минуты — предупреждение, не красная ночь.
  const late = runStep(t, step, { CANDIDATE: HEAD, FAKE_RUN_ID: '' });
  assert.equal(late.status, 0);
  assert.equal(late.log.filter((call) => call === 'sleep 10').length, 18);
  assert.match(late.stdout, /::warning::прогон ship-ревью не появился за 3 минуты — ночь не красится/);
  // Dispatch отклонён — предупреждение; SHA нет (Validate не появился) — dispatch не делается.
  const refused = runStep(t, step, { CANDIDATE: HEAD, FAKE_DISPATCH: 'fail' });
  assert.equal(refused.status, 0);
  assert.match(refused.stdout, /::warning::ship-ревью ночью не запущено: dispatch отклонён/);
  const empty = runStep(t, step, { CANDIDATE: '' });
  assert.equal(empty.status, 0);
  assert.deepEqual(empty.log, []);
  assert.match(empty.stdout, /::warning::нет SHA прогона Validate — ночное ship-ревью не запущено/);
});

// ---------- #736: красная ночь — комментарий в задачи диапазона ----------

test('#736 AC3: night_red после dispatch только при красном Validate с прогоном; права — чтение, issue — HP_PROCESS_TOKEN', () => {
  const nightly = read('_nightly.yml');
  const dispatch = job(nightly, 'dispatch');
  const red = job(nightly, 'night_red');
  // Прогон Validate — выход dispatch тем же шагом, что SHA, до ожидания.
  assert.match(dispatch, /\n      run_id: \$\{\{ steps\.validate\.outputs\.run_id \}\}\n/);
  assert.match(red, /\n    needs: dispatch\n/);
  assert.match(red, /\n    if: always\(\) && needs\.dispatch\.result == 'failure' && needs\.dispatch\.outputs\.run_id != ''\n/,
    'только красный dispatch с найденным прогоном');
  assert.match(red, /\n    continue-on-error: true\n/, 'цвет ночи — цвет Validate');
  assert.match(red, /\n    permissions:\n      actions: read\n      contents: read\n    steps:\n/, 'права job — только чтение');
  assert.equal((red.match(/permissions:/g) || []).length, 1);
  // Checkout dev со всей историей без блобов; скрипту npm ci не нужен.
  assert.match(red, /uses: actions\/checkout@[0-9a-f]{40} # v\d+\n        with:\n          ref: dev\n          fetch-depth: 0\n          filter: blob:none\n          persist-credentials: false\n/);
  assert.match(red, /uses: actions\/setup-node@[0-9a-f]{40} # v\d+\n        with:\n          node-version: 22\n/);
  assert.doesNotMatch(red.replace(/^\s*#.*$/gm, ''), /npm (ci|install)/);
  // Actions — токеном ночи, issue — токеном процесса.
  assert.match(red, /\n          ACTIONS_TOKEN: \$\{\{ github\.token \}\}\n/);
  assert.match(red, /\n          GH_TOKEN: \$\{\{ secrets\.HP_PROCESS_TOKEN \}\}\n/);
  assert.match(red, /\n          RED_RUN: \$\{\{ needs\.dispatch\.outputs\.run_id \}\}\n/);
  const body = stepRun(nightly, 'Комментарий в задачи диапазона от последней зелёной ночи до красной');
  assert.match(body, /node scripts\/night-red\.mjs --repo="\$REPO" --red-run="\$RED_RUN"/);
  assert.equal(spawnSync('bash', ['-n', '-c', body]).status, 0, 'bash -n');
  assert.doesNotMatch(body, /<<-?\s*['"]?[A-Za-z_]/, 'heredoc в run');
  // Канон: адресат сигнала в шапке и абзац в PROCESS.md §10.4.
  assert.match(nightly.slice(0, nightly.indexOf('\nname:')), /Адресат сигнала \(#736\)[\s\S]*night_red/);
  const canon = readFileSync(new URL('../PROCESS.md', import.meta.url), 'utf8');
  const section = canon.slice(canon.indexOf('### 10.4 '), canon.indexOf('\n## 11. '));
  const paragraph = section.slice(section.indexOf('**Красная ночь** (#736)'));
  assert.ok(section.includes('**Красная ночь** (#736)'), 'абзац в §10.4');
  for (const key of ['`night_red`', '`scripts/night-red.mjs`', 'conclusion: failure', '`ci-proof`', '`release`', '--no-merges',
    '`Release:`', '`hp:night-red', '`HP_PROCESS_TOKEN`', 'серия']) {
    assert.ok(paragraph.slice(0, paragraph.indexOf('\n\n')).includes(key), `абзац называет ${key}`);
  }
});
