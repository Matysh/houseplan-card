// #751: у каждого `| tee` в workflow — pipefail.
//
// Шаг без собственного или наследуемого `shell:` GitHub на Linux исполняет
// как `bash -e {0}` — без pipefail (`-eo pipefail` даёт выбранный `shell: bash`).
// Код выхода `… | tee` — код tee, и падение левой части
// проходило молча: `_process-resume.yml` терял событие возобновления,
// `release-review.yml` шёл дальше с неполным GITHUB_OUTPUT и `proceed=true`,
// `validate.yml` оставлял `heavy` пустым, и тяжёлые job пропускались. Образец —
// #727 (`_ship-review.yml`) и #472 (`_mutation-gate.yml`). Контракт обходит все
// `.github/workflows/*.yml`: строка с `| tee` в `run` либо идёт после
// `set -o pipefail` (`set -[a-z]*o pipefail`), либо выбран `shell: bash`.
// Shell и тело шага читает общая обвязка: step → job → workflow → default (#812).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findStep, runStep, workflowSteps } from './helpers/workflow-step.mjs';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

const TEE = /(?<!\|)\|(?!\|)\s*tee\b/;
const PIPEFAIL = /\bset\s+-[A-Za-z]*o\s+pipefail\b/;

/** Незащищённые `| tee`; диагностика указывает начало фактического шага. */
function teeWithoutPipefail(text) {
  const found = [];
  for (const step of workflowSteps(text)) {
    if (step.run === null || /^bash\s*$/.test(step.shell) || /pipefail/.test(step.shell)) continue;
    let guarded = false;
    step.run.split('\n').forEach((raw) => {
      const code = raw.trimStart().startsWith('#') ? '' : raw;
      const tee = code.search(TEE);
      if (tee >= 0 && !guarded && !PIPEFAIL.test(code.slice(0, tee))) {
        found.push({ line: step.line, text: raw.trim() });
      }
      if (PIPEFAIL.test(code)) guarded = true;
    });
  }
  return found;
}

const workflowFiles = () => readdirSync(WORKFLOWS).filter((name) => /\.ya?ml$/.test(name)).sort();

test('#751 AC1: разбор находит | tee без pipefail и пропускает защищённые', () => {
  const step = (run, extra = '') => `jobs:\n  a:\n    steps:\n      - name: x\n${extra}        run: ${run}\n`;
  const block = (...lines) => `|\n${lines.map((l) => `          ${l}`).join('\n')}`;
  assert.equal(teeWithoutPipefail(step('node a.mjs | tee -a "$GITHUB_OUTPUT"')).length, 1, 'строка в одну строку');
  assert.equal(teeWithoutPipefail(step(block('node a.mjs \\', '  --x=1 | tee out.txt'))).length, 1, 'блок без pipefail');
  assert.equal(teeWithoutPipefail(step(block('set -o pipefail', 'node a.mjs | tee out.txt'))).length, 0);
  assert.equal(teeWithoutPipefail(step(block('set -euo pipefail', 'node a.mjs | tee out.txt'))).length, 0, 'set -euo pipefail');
  assert.equal(teeWithoutPipefail(step(block('node a.mjs | tee out.txt', 'set -o pipefail'))).length, 1, 'pipefail после tee не защищает');
  assert.equal(teeWithoutPipefail(step(block('# set -o pipefail', 'node a.mjs | tee out.txt'))).length, 1, 'комментарий не защищает');
  assert.equal(teeWithoutPipefail(step(block('# вывод идёт | tee в сводку', 'echo ok'))).length, 0, 'комментарий с | tee — не конвейер');
  assert.equal(teeWithoutPipefail(step(block('a || tee x'))).length, 0, '|| — не конвейер');
  assert.equal(teeWithoutPipefail(step(block('tee -a "$GITHUB_OUTPUT" < /tmp/x'))).length, 0, 'tee без конвейера');
  assert.equal(teeWithoutPipefail(step('node a.mjs | tee out.txt', '        shell: bash\n')).length, 0, 'shell: bash даёт -eo pipefail');
  assert.equal(teeWithoutPipefail(step('node a.mjs | tee out.txt', '        shell: bash -e {0}\n')).length, 1, 'свой shell без pipefail');
  // shell соседнего шага — не этого.
  const two = 'jobs:\n  a:\n    steps:\n      - name: x\n        shell: bash\n        run: echo\n      - name: y\n        run: node a.mjs | tee out.txt\n';
  assert.deepEqual(teeWithoutPipefail(two).map((f) => f.text), ['node a.mjs | tee out.txt']);
});

test('#812 AC4: tee detector follows step, job, workflow and runner-default shell priority', (t) => {
  const workflow = (workflowShell, jobShell, stepShell) => [
    ...(workflowShell ? ['defaults:', '  run:', `    shell: ${workflowShell}`] : []),
    'jobs:', '  probe:',
    ...(jobShell ? ['    defaults:', '      run:', `        shell: ${jobShell}`] : []),
    '    steps:', '      - name: pipeline',
    ...(stepShell ? [`        shell: ${stepShell}`] : []),
    '        run: |', '          false | tee /dev/null', '          echo reached-end', '',
  ].join('\n');
  const cases = [
    [null, null, null, null, null, false],
    ['bash', null, null, 'bash', 'workflow', true],
    ['sh', 'bash', null, 'bash', 'job', true],
    ['bash', 'sh', null, 'sh', 'job', false],
    ['bash', 'bash', 'sh', 'sh', 'step', false],
    ['sh', 'sh', 'bash', 'bash', 'step', true],
    ['bash', null, 'bash -e {0}', 'bash -e {0}', 'step', false],
  ];
  for (const [workflowShell, jobShell, stepShell, shell, source, protectedPipe] of cases) {
    const text = workflow(workflowShell, jobShell, stepShell);
    const [step] = workflowSteps(text);
    const diagnostic = JSON.stringify({ workflowShell, jobShell, stepShell });
    assert.deepEqual([step.shell, step.shellFrom], [shell, source], diagnostic);
    assert.equal(teeWithoutPipefail(text).length, protectedPipe ? 0 : 1, diagnostic);
    if (hasBash()) {
      const result = runStep(step);
      assert.equal(result.status === 0, !protectedPipe, diagnostic);
      assert.equal(result.stdout.includes('reached-end'), !protectedPipe, diagnostic);
    } else t.diagnostic('Bash unavailable: shell selection checked, execution not claimed');
  }
});

test('#751 AC1: у каждого | tee во всех workflow — pipefail; пять известных мест видны разбору', () => {
  const tees = new Set();
  const offenders = [];
  for (const name of workflowFiles()) {
    const text = readFileSync(join(WORKFLOWS, name), 'utf8');
    if (workflowSteps(text).some((step) => step.run?.split('\n').some((line) => !line.trimStart().startsWith('#') && TEE.test(line)))) tees.add(name);
    for (const found of teeWithoutPipefail(text)) offenders.push(`${name}:${found.line}: ${found.text}`);
  }
  for (const name of ['_mutation-gate.yml', '_ship-review.yml', '_process-resume.yml', 'release-review.yml', 'validate.yml']) {
    assert.ok(tees.has(name), `${name}: | tee не найден — разбор ослеп`);
  }
  assert.deepEqual(offenders, [], 'добавить `set -o pipefail` первой строкой run (образец #727, #472)');
});

const hasBash = () => process.platform !== 'win32' && spawnSync('bash', ['--version']).status === 0;

/** Шаг `name` файла `file`: разобранный шаг (shell раннера, #766) и тело `run`. */
function stepRun(file, name) {
  const text = readFileSync(join(WORKFLOWS, file), 'utf8');
  const key = workflowSteps(text, file).some((step) => step.name === name) ? 'name' : 'id';
  const step = findStep(text, { [key]: name }, file);
  assert.notEqual(step.run, null, `у шага «${name}» есть run`);
  return { step, script: step.run };
}

test('#751 AC1 на настоящем bash: упавший скрипт слева от | tee роняет шаг под bash -e, как у раннера', (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-751-tee-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin');
  mkdirSync(bin);
  // Подменённый node: печатает строку, как скрипт до исключения, и выходит 1.
  writeFileSync(join(bin, 'node'), '#!/bin/sh\necho "action=partial"\necho "boom: $*" >&2\nexit 1\n', { mode: 0o755 });
  for (const [file, name] of [['_process-resume.yml', 'Решить по маркеру ожидания и переставить S7'], ['validate.yml', 'heavy']]) {
    const out = join(root, `${file}.out`);
    writeFileSync(out, '');
    // Шаг без `shell:` GitHub исполняет как `bash -e {0}` — обвязка тоже (#766).
    const { step, script } = stepRun(file, name);
    assert.equal(step.shell, null, `${file} «${name}»: shell не задан — pipefail только из тела`);
    const run = (body) => {
      writeFileSync(out, '');
      return runStep(step, body, {
        cwd: root, encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, GITHUB_STEP_SUMMARY: out, GITHUB_OUTPUT: out },
      });
    };
    const r = run(script);
    assert.notEqual(r.status, 0, `${file} «${name}»: падение скрипта прошло зелёным шагом`);
    assert.match(r.stderr, /boom: scripts\//, `${file}: упал именно скрипт шага`);
    assert.equal(readFileSync(out, 'utf8'), 'action=partial\n', `${file}: tee по-прежнему пишет вывод`);
    // #766: без строки pipefail тот же шаг зелёный — обвязка своей защиты не
    // добавляет, и убранный из шага pipefail этот тест видит.
    const bare = script.split('\n').filter((line) => !PIPEFAIL.test(line)).join('\n');
    assert.notEqual(bare, script, `${file}: строка pipefail найдена`);
    assert.equal(run(bare).status, 0, `${file} «${name}»: без pipefail обвязка обязана показать зелёный шаг`);
  }
});
