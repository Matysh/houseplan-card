// #751: у каждого `| tee` в workflow — pipefail.
//
// Ни один workflow не задаёт `shell:`, а шаг без него GitHub на Linux
// исполняет как `bash -e {0}` — без pipefail (`-eo pipefail` даёт только явный
// `shell: bash`). Код выхода `… | tee` — код tee, и падение левой части
// проходило молча: `_process-resume.yml` терял событие возобновления,
// `release-review.yml` шёл дальше с неполным GITHUB_OUTPUT и `proceed=true`,
// `validate.yml` оставлял `heavy` пустым, и тяжёлые job пропускались. Образец —
// #727 (`_ship-review.yml`) и #472 (`_mutation-gate.yml`). Контракт обходит все
// `.github/workflows/*.yml`: строка с `| tee` в `run` либо идёт после
// `set -o pipefail` (`set -[a-z]*o pipefail`), либо у шага стоит `shell: bash`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findStep, runStep } from './helpers/workflow-step.mjs';

const WORKFLOWS = fileURLToPath(new URL('../.github/workflows/', import.meta.url));

const indentOf = (line) => line.length - line.trimStart().length;
const TEE = /(?<!\|)\|(?!\|)\s*tee\b/;
const PIPEFAIL = /\bset\s+-[A-Za-z]*o\s+pipefail\b/;

/**
 * Все `run` файла: тело так, как его прочтёт YAML (блок `|`/`>` кончается на
 * первой непустой строке с отступом не больше ключа), строка начала и `shell:`
 * того же шага — ключ на том же отступе, что и `run`, в пределах элемента `- `.
 */
function runBlocks(text) {
  const lines = text.split('\n');
  const blocks = [];
  lines.forEach((line, at) => {
    const m = /^(\s*)(- )?run:\s*(.*)$/.exec(line);
    if (!m) return;
    const keyIndent = m[1].length + (m[2] ? 2 : 0);
    const inline = !/^[|>][-+]?\s*(#.*)?$/.test(m[3]);
    const body = [];
    if (inline) body.push(m[3].replace(/^(['"])(.*)\1$/, '$2'));
    else {
      for (const next of lines.slice(at + 1)) {
        if (next.trim() && indentOf(next) <= keyIndent) break;
        body.push(next.trim() ? next.slice(keyIndent + 2) : '');
      }
    }
    // Шаг — от своего `- ` (отступ ключа минус два) до первой строки левее ключей.
    let start = at;
    const item = new RegExp(`^ {${keyIndent - 2}}- `);
    while (start > 0 && !item.test(lines[start])) start -= 1;
    let end = at + 1;
    while (end < lines.length && !(lines[end].trim() && indentOf(lines[end]) < keyIndent)) end += 1;
    const keys = lines.slice(start, end).map((l, i) => (i === 0 ? l.replace(/^(\s*)- /, '$1  ') : l));
    const shell = keys.find((l) => indentOf(l) === keyIndent && /^\s*shell:/.test(l))?.trim().slice('shell:'.length).trim() ?? '';
    blocks.push({ line: at + 1, inline, body, shell });
  });
  return blocks;
}

/** Строки с `| tee`, перед которыми в том же `run` нет pipefail, а у шага — `shell: bash`. */
function teeWithoutPipefail(text) {
  const found = [];
  for (const block of runBlocks(text)) {
    if (/^bash\s*$/.test(block.shell) || /pipefail/.test(block.shell)) continue;
    let guarded = false;
    block.body.forEach((raw, i) => {
      const code = raw.trimStart().startsWith('#') ? '' : raw;
      const tee = code.search(TEE);
      if (tee >= 0 && !guarded && !PIPEFAIL.test(code.slice(0, tee))) {
        found.push({ line: block.inline ? block.line : block.line + 1 + i, text: raw.trim() });
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

test('#751 AC1: у каждого | tee во всех workflow — pipefail; пять известных мест видны разбору', () => {
  const tees = new Set();
  const offenders = [];
  for (const name of workflowFiles()) {
    const text = readFileSync(join(WORKFLOWS, name), 'utf8');
    if (runBlocks(text).some((block) => block.body.some((line) => !line.trimStart().startsWith('#') && TEE.test(line)))) tees.add(name);
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
  const lines = text.split('\n');
  const at = lines.findIndex((line) => line === `      - name: ${name}` || line === `      - id: ${name}`);
  assert.ok(at >= 0, `шаг «${name}» в ${file}`);
  const block = runBlocks(text).find((b) => b.line > at + 1);
  assert.ok(block, `у шага «${name}» есть run`);
  return { step: findStep(text, `${lines[at]}\n`, file), script: block.body.join('\n') };
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
