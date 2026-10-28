// #766: обвязка исполнения шагов workflow — shell как у раннера, без своих флагов.
//
// Тесты исполнения шагов гоняли тела `run:` под `bash -eo pipefail`, а раннер
// исполняет шаг без `shell:` под `bash -e {0}`. Защиту от упавшей левой части
// конвейера давала обвязка, а не шаг, и пропущенный в шаге pipefail тесты не
// видели. Здесь держится сама обвязка (test/helpers/workflow-step.mjs): выбор
// shell (шаг → job → workflow → не задан), команды раннера, исполнение файлом —
// и то, что ни один тест не исполняет шаг своими флагами bash.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findStep, runStep, runnerArgv, workflowSteps } from './helpers/workflow-step.mjs';
import { posixCommand } from './helpers/posix-shell.mjs';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const TESTS = fileURLToPath(new URL('.', import.meta.url));
const hasBash = () => spawnSync(posixCommand('bash'), ['--version']).status === 0;

test('#1109: beta-derived large commit diagnostics drain Git and preserve producer errors', t => {
  if (!hasBash()) { t.skip('bash unavailable'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-1109-stat-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  git('init', '-q');
  const step = findStep(readFileSync(join(WORKFLOWS, '_beta-derived.yml'), 'utf8'), { name: 'Коммит в dev' });
  const lines = step.run.split('\n');
  const diagnostic = lines.filter(line => /^git show --stat\b/.test(line));
  assert.equal(diagnostic.length, 1);
  // Execute the actual guard and diagnostic, stopping before credentials/push.
  // The runner supplies its normal shell; no test-only pipefail is added.
  const body = `${lines[0]}\n${diagnostic[0]}\necho reached-push-boundary\n`;
  const options = { cwd: root, encoding: 'utf8', timeout: 30000 };
  const missingHead = runStep(step, body, options);
  assert.notEqual(missingHead.status, 0, 'real git show error must stop the step');
  assert.doesNotMatch(missingHead.stdout, /reached-push-boundary/);
  assert.match(missingHead.stderr, /HEAD/);

  for (let i = 0; i < 1500; i += 1) {
    writeFileSync(join(root, `scene-${String(i).padStart(4, '0')}-${'x'.repeat(100)}.txt`), 'reviewed artifact\n');
  }
  git('add', '.');
  git('-c', 'user.name=Workflow test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'large derived payload');
  const full = git('show', '--stat', '--format=%H %s', 'HEAD');
  assert.ok(Buffer.byteLength(full) > 65536, 'fixture exceeds a pipe buffer');
  const result = runStep(step, body, options);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${full.split('\n').slice(0, 40).join('\n')}\nreached-push-boundary\n`);
});

const WORKFLOW = [
  'name: x',
  'on: push',
  'defaults:',
  '  run:',
  '    shell: sh',
  'jobs:',
  '  a:',
  '    defaults:',
  '      run:',
  "        shell: 'bash'",
  '    steps:',
  '      - name: own',
  '        shell: bash -x {0}',
  '        run: echo own',
  '      # комментарий между шагами',
  '      - name: from job',
  '        run: |',
  '          echo one',
  '',
  '          echo two',
  '      - uses: actions/checkout@v4',
  '  b:',
  '    steps:',
  '    - id: from-workflow',
  '      run: >-',
  '        echo folded',
  '        line',
  '    - run: "echo \\"quoted\\""',
  '',
].join('\n');

test('#766: shell шага — свой, иначе defaults job, иначе defaults workflow; соседний шаг не влияет', () => {
  const steps = workflowSteps(WORKFLOW, 'синтетика');
  assert.deepEqual(steps.map((s) => [s.job, s.name ?? s.id, s.shell, s.shellFrom]), [
    ['a', 'own', 'bash -x {0}', 'step'],
    ['a', 'from job', 'bash', 'job'],
    ['a', null, 'bash', 'job'],
    ['b', 'from-workflow', 'sh', 'workflow'],
    ['b', null, 'sh', 'workflow'],
  ]);
  assert.deepEqual(steps.map((s) => s.run), ['echo own', 'echo one\n\necho two\n', null, 'echo folded line', 'echo "quoted"']);
  // Без defaults — не задан; `shell:` соседа не переносится.
  const plain = 'jobs:\n  a:\n    steps:\n      - name: x\n        shell: bash\n        run: a\n      - name: y\n        run: b\n';
  assert.deepEqual(workflowSteps(plain).map((s) => [s.name, s.shell, s.shellFrom]), [['x', 'bash', 'step'], ['y', null, null]]);
  // Шаг ищется по подстроке (как маркеры тестов) и по полю.
  assert.equal(findStep(WORKFLOW, '          echo two').name, 'from job');
  assert.equal(findStep(WORKFLOW, { id: 'from-workflow' }).shell, 'sh');
  assert.throws(() => findStep(WORKFLOW, '  b:\n'), /вне шагов/);
  // Чего разбор не понимает — отказ, а не догадка.
  assert.throws(() => workflowSteps('jobs:\n  a:\n    steps:\n      - run: { x: 1 }\n'), /потоковый узел/);
  assert.throws(() => workflowSteps('defaults: { run: { shell: bash } }\njobs: {}\n'), /defaults в одну строку/);
});

test('#766: команды раннера — bash -e без pipefail по умолчанию, pipefail только у shell: bash', () => {
  const f = '/t/step.sh';
  assert.deepEqual(runnerArgv(null, f), ['bash', '-e', f], 'не задан: bash -e {0}');
  assert.deepEqual(runnerArgv('bash', f), ['bash', '--noprofile', '--norc', '-e', '-o', 'pipefail', f]);
  assert.deepEqual(runnerArgv('sh', f), ['sh', '-e', f]);
  assert.deepEqual(runnerArgv('python', f), ['python', f]);
  assert.deepEqual(runnerArgv('bash -e {0}', f), ['bash', '-e', f], 'свой шаблон — как написан');
  assert.deepEqual(runnerArgv('perl -w {0} --x', f), ['perl', '-w', f, '--x']);
  assert.throws(() => runnerArgv('zsh', f), /без \{0\}/, 'не встроенный без {0} раннер отвергает');
  assert.throws(() => runnerArgv('pwsh', f), /обвязка его не исполняет/);
  assert.throws(() => runnerArgv("bash -c '{0}'", f), /кавычки/);
});

test('#766: левая часть конвейера падает — шаг без shell зелёный, как у раннера; pipefail даёт только шаг', (t) => {
  if (!hasBash()) { t.skip('bash недоступен'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'hp-766-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, OUT: join(dir, 'out') };
  const body = 'echo before\nfalse | tee "$OUT"\necho after\n';
  const wf = (stepExtra = '', jobExtra = '') => `jobs:\n  a:\n${jobExtra}    steps:\n      - name: pipe\n${stepExtra}        run: |\n${
    body.trimEnd().split('\n').map((line) => `          ${line}`).join('\n')}\n`;
  const run = (text) => runStep(findStep(text, { name: 'pipe' }), undefined, { env });

  // Отрицательный тест: раннер исполнит это как `bash -e` — код конвейера = код
  // tee, шаг зелёный. Обвязка, добавившая pipefail, покажет здесь красный.
  const silent = run(wf());
  assert.equal(silent.status, 0, `обвязка добавила pipefail к шагу без shell:\n${silent.stderr}`);
  assert.equal(silent.stdout, 'before\nafter\n', 'шаг дошёл до конца');

  for (const [label, text] of [
    ['shell: bash шага', wf('        shell: bash\n')],
    ['defaults.run.shell: bash job', wf('', '    defaults:\n      run:\n        shell: bash\n')],
    ['set -o pipefail в теле', wf().replace('          echo before', '          set -o pipefail\n          echo before')],
  ]) {
    const r = run(text);
    assert.notEqual(r.status, 0, `${label}: упавшая левая часть должна ронять шаг`);
    assert.doesNotMatch(r.stdout, /after/, label);
  }
  // `-e` у шага по умолчанию есть: простая упавшая команда шаг останавливает.
  const errexit = runStep({ shell: null }, 'false\necho after\n', { env });
  assert.notEqual(errexit.status, 0);
  assert.equal(errexit.stdout, '');
  // Тело исполняется файлом, как `{0}` у раннера, а не через -c.
  const file = runStep({ shell: null }, 'echo "$0"\n', { env });
  assert.match(file.stdout, /step\.sh\n$/);
});

test('#766: каждый шаг каждого workflow разбирается и исполним обвязкой', () => {
  let runs = 0;
  for (const name of readdirSync(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file)).sort()) {
    for (const step of workflowSteps(readFileSync(join(WORKFLOWS, name), 'utf8'), name)) {
      if (step.run === null) continue;
      runs += 1;
      assert.doesNotThrow(() => runnerArgv(step.shell, '/t/step.sh'), `${name}:${step.line}`);
    }
  }
  // Свидетель разбора: тел `run:` — сотни, не ноль.
  assert.ok(runs > 150, `тел run: ${runs}`);
});

test('#960: real POSIX step reads paths with spaces, honors fixture PATH and propagates command refusal', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp 960 shell '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const data = join(dir, 'input file.txt');
  writeFileSync(data, 'actual file bytes\n');
  writeFileSync(join(dir, 'hp960-tool'), '#!/usr/bin/env bash\nprintf "fixture tool\\n"\n', { mode: 0o755 });
  const options = { cwd: dir, prependPath: [dir], env: { ...process.env, DATA: data } };
  const green = runStep({ shell: null }, 'cat "$DATA"\nhp960-tool\n', options);
  assert.equal(green.status, 0, green.stderr);
  assert.equal(green.stdout, 'actual file bytes\nfixture tool\n');
  const red = runStep({ shell: null }, 'hp960-missing-command\necho must-not-run\n', options);
  assert.equal(red.status, 127, red.stderr);
  assert.equal(red.stdout, '');
});

/** Вызовы bash в тесте, которые исполняют тело своими флагами, а не обвязкой. */
function ownBashRuns(source) {
  const found = [];
  for (const m of source.matchAll(/\b(?:spawnSync|spawn|execFileSync|execFile)\(\s*'bash',\s*\[([^\]]*)\]/g)) {
    const args = m[1];
    if (/'-n'/.test(args)) continue; // bash -n — проверка синтаксиса, не исполнение
    const flags = /'(?:-e|-eo|-o|--noprofile|--norc|pipefail)'/.test(args);
    const computed = /'-c',\s*(?![\s'])/.test(args); // -c с вычисленным телом, а не литералом
    if (flags || computed) found.push(m[0].replace(/\s+/g, ' '));
  }
  return found;
}

test('#766: ни один тест не исполняет тело своими флагами bash — только через обвязку', () => {
  assert.deepEqual(ownBashRuns("spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script], {"), [
    "spawnSync('bash', ['--noprofile', '--norc', '-eo', 'pipefail', '-c', script]",
  ]);
  assert.equal(ownBashRuns("spawnSync('bash', ['-c', script])").length, 1, 'bash -c без -e — тоже не раннер');
  assert.equal(ownBashRuns("execFileSync('bash', ['-eo', 'pipefail', '-c', `x | y`])").length, 1);
  assert.equal(ownBashRuns("spawnSync('bash', ['-n', '-c', body])").length, 0, 'bash -n — синтаксис');
  assert.equal(ownBashRuns("spawnSync('bash', ['-c', 'command -v git'])").length, 0, 'литерал теста — не шаг');
  assert.equal(ownBashRuns("spawnSync('bash', [STAND, stand])").length, 0, 'скрипт по пути — не шаг');
  // Этот файл несёт образцы нарушений в строках — его не сканируем.
  const offenders = readdirSync(TESTS).filter((name) => name.endsWith('.test.mjs') && name !== 'workflow-step.test.mjs').sort()
    .flatMap((name) => ownBashRuns(readFileSync(join(TESTS, name), 'utf8')).map((call) => `${name}: ${call}`));
  assert.deepEqual(offenders, [], 'шаг исполнять runStep(findStep(…)) из test/helpers/workflow-step.mjs');
});
