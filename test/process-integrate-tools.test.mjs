// #749: job `integrate` исполняет скрипты конвейера одним снимком `dev`.
//
// Тело `_process.yml` читается из `dev` (`@dev`, #623), значит, и флаги с
// форматами, с которыми оно зовёт скрипты, — версии `dev`. Рабочая копия после
// публикации документа — ветка задачи, а ветка show/ship с чистым слиянием до
// ревью не ребейзится (§10.4) и может нести `scripts/`, отставшие на дни.
// Здесь — контракт job: ни один шаг не зовёт скрипт из рабочей копии, каждый
// вызов идёт через каталог снимка, снимок берётся из `origin/dev` и несёт
// `validate.yml`, без которого `ci-proof.mjs` отвечает `failed (#622)` на
// каждом слиянии. Самодостаточность снимка проверяется исполнением: шаг как
// есть, настоящим bash и git, на временном origin с нынешними `scripts/`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { findStep, runStep } from './helpers/workflow-step.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOW = join(ROOT, '.github', 'workflows', '_process.yml');
const TOOLS_STEP = 'Скрипты конвейера — из dev (#749)';
const TOOLS_ENV = 'TOOLS: ${{ steps.tools.outputs.dir }}';

/** Блок job: от `  <id>:` до следующей job на том же отступе. */
function jobBlock(text, id) {
  const start = text.indexOf(`\n  ${id}:\n`);
  assert.ok(start >= 0, `job ${id}`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 2);
}

/**
 * Шаги job: имя, id, if, env и тело `run` так, как его прочтёт YAML (блок
 * кончается на первой непустой строке с отступом меньше тела). Комментарии
 * тела отброшены: судится то, что исполняется.
 */
function stepsOf(job) {
  const lines = job.slice(job.indexOf('\n    steps:\n') + 1).split('\n').slice(1);
  const steps = [];
  for (const line of lines) {
    if (/^ {6}- /.test(line)) steps.push([line]);
    else if (steps.length) steps.at(-1).push(line);
  }
  return steps.map((stepLines) => {
    const text = stepLines.join('\n');
    const field = (key) => text.match(new RegExp(`^ {6}(?:- | {2})${key}: (.+)$`, 'm'))?.[1];
    const env = [];
    const envAt = stepLines.indexOf('        env:');
    if (envAt >= 0) {
      for (const line of stepLines.slice(envAt + 1)) {
        if (/^ {10}#/.test(line)) continue;
        if (!/^ {10}\S/.test(line)) break;
        env.push(line.trim());
      }
    }
    let run = '';
    const runAt = stepLines.indexOf('        run: |');
    if (runAt >= 0) {
      const body = [];
      for (const line of stepLines.slice(runAt + 1)) {
        if (line.trim() && !/^ {10}/.test(line)) break;
        body.push(line.slice(10));
      }
      run = body.join('\n');
    } else {
      run = field('run') ?? '';
    }
    const code = run.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
    return { text, name: field('name') ?? field('uses'), id: field('id'), if: field('if'), env, run, code };
  });
}

const integrateSteps = () => stepsOf(jobBlock(readFileSync(WORKFLOW, 'utf8'), 'integrate'));

test('#749 AC2: в job integrate ни один шаг не зовёт скрипт из рабочей копии — только из снимка dev', () => {
  const steps = integrateSteps();
  const calls = [];
  for (const step of steps) {
    assert.doesNotMatch(step.code, /(?<!\$TOOLS\/)\bscripts\/[\w.-]+/,
      `«${step.name}»: repo-скрипт мимо снимка — рабочая копия здесь ветка задачи`);
    assert.doesNotMatch(step.code, /import\(\s*['"`]\.{0,2}\/?scripts\//, `«${step.name}»: import() скрипта рабочей копии`);
    if (step.name !== TOOLS_STEP) {
      assert.doesNotMatch(step.code, /\$tools\b|publish-tools|route-tools/, `«${step.name}»: своё извлечение скриптов вместо снимка job`);
    }
    const used = [...step.code.matchAll(/node "\$TOOLS\/scripts\/([\w.-]+\.mjs)"/g)].map((m) => m[1]);
    if (used.length || /\$TOOLS\b/.test(step.code)) {
      assert.ok(step.env.includes(TOOLS_ENV), `«${step.name}»: каталог снимка — из выхода шага tools`);
    }
    for (const script of used) calls.push(`${step.name}: ${script}`);
  }
  // Все вызовы, которые issue называет, — через снимок (#749 К2).
  const byScript = (name) => calls.filter((call) => call.endsWith(`: ${name}`)).length;
  assert.deepEqual(
    Object.fromEntries(['review-result-gate.mjs', 'review-doc-guard.mjs', 'reviews-index.mjs', 'merge-candidate.mjs', 'process-track.mjs', 'status-label.mjs']
      .map((name) => [name, byScript(name)])),
    // review-doc-guard: якорь, рубеж индекса, два рубежа диапазона (до и после
    // ребейза) и --doc=- шага #413; merge-candidate: два разбора отказа push и слияние.
    { 'review-result-gate.mjs': 1, 'review-doc-guard.mjs': 5, 'reviews-index.mjs': 1, 'merge-candidate.mjs': 3, 'process-track.mjs': 1, 'status-label.mjs': 1 },
    calls.join('\n'),
  );
});

test('#749 AC2: снимок — один на job, из origin/dev, с validate.yml, до первого шага со скриптом', () => {
  const steps = integrateSteps();
  const at = steps.findIndex((step) => step.name === TOOLS_STEP);
  assert.ok(at >= 0, `шаг «${TOOLS_STEP}»`);
  const snapshot = steps[at];
  assert.equal(snapshot.id, 'tools');
  const checkout = steps.find((step) => /^actions\/checkout@/.test(step.name));
  assert.equal(snapshot.if, checkout.if, 'снимок есть всякий раз, когда есть рабочая копия');
  assert.ok(steps.findIndex((step) => /^actions\/setup-node@/.test(step.name)) < at, 'после setup-node');
  const firstUser = steps.findIndex((step) => /\$TOOLS\b/.test(step.code));
  assert.ok(firstUser > at, 'до первого шага, который зовёт скрипт');
  assert.match(snapshot.code, /^set -euo pipefail$/m, 'сбой git archive не проходит молча через | tar');
  assert.match(snapshot.code, /^git fetch -q origin dev$/m);
  assert.match(snapshot.code, /^git archive origin\/dev scripts \.github\/workflows\/validate\.yml \| tar -x -C "\$tools"$/m,
    'снимок из origin/dev; validate.yml читает workflow-jobs.mjs по пути от себя');
  assert.match(snapshot.code, /^echo "dir=\$tools" >> "\$GITHUB_OUTPUT"$/m);
  const archives = steps.flatMap((step) => [...step.code.matchAll(/git archive/g)].map(() => step.name));
  assert.deepEqual(archives, [TOOLS_STEP], 'одна версия скриптов на весь заход');
});

const hasTools = () => process.platform !== 'win32'
  && ['bash', 'tar', 'git'].every((tool) => spawnSync(tool, ['--version']).status === 0);

// Окружение git без GIT_* родителя и без глобального конфига (урок #633, #496).
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'init.defaultBranch', GIT_CONFIG_VALUE_0: 'dev',
};

test('#749 AC2: снимок самодостаточен — шаг как есть даёт каталог, из которого ci-proof читает контракт validate.yml', async (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const root = mkdtempSync(join(tmpdir(), 'hp-749-tools-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const temp = join(root, 'runner');
  mkdirSync(temp);
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  // dev временного origin несёт нынешние scripts/ и validate.yml — то, что
  // снимок возьмёт из dev настоящего.
  cpSync(join(ROOT, 'scripts'), join(work, 'scripts'), {
    recursive: true, filter: (src) => !['node_modules', '__pycache__'].includes(basename(src)),
  });
  mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
  cpSync(join(ROOT, '.github', 'workflows', 'validate.yml'), join(work, '.github', 'workflows', 'validate.yml'));
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'dev');
  git(work, 'push', '-q', 'origin', 'dev');
  const snapshot = integrateSteps().find((step) => step.name === TOOLS_STEP);
  assert.ok(snapshot, `шаг «${TOOLS_STEP}»`);
  const output = join(temp, 'output');
  // #766: shell шага — по правилам раннера (без `shell:` — `bash -e {0}`).
  const step = findStep(readFileSync(WORKFLOW, 'utf8'), `      - name: ${TOOLS_STEP}\n`, '_process.yml');
  const r = runStep(step, snapshot.run, {
    cwd: work, encoding: 'utf8', env: { ...GIT_ENV, RUNNER_TEMP: temp, GITHUB_OUTPUT: output },
  });
  assert.equal(r.status, 0, r.stderr);
  const dir = readFileSync(output, 'utf8').match(/^dir=(.+)$/m)?.[1];
  assert.ok(dir, 'шаг назвал каталог снимка');
  assert.ok(!dir.startsWith(work), 'снимок — вне рабочей копии');
  assert.ok(existsSync(join(dir, '.github', 'workflows', 'validate.yml')), 'validate.yml в снимке');
  const { resolveJobRules } = await import(pathToFileURL(join(dir, 'scripts', 'ci-proof.mjs')).href);
  assert.doesNotThrow(() => resolveJobRules(), 'контракт имён job читается из validate.yml снимка (#622)');
  // Каждый скрипт, который зовут шаги, импортируется из снимка без node_modules.
  for (const name of ['review-result-gate', 'review-doc-guard', 'reviews-index', 'merge-candidate', 'process-track', 'status-label']) {
    await import(pathToFileURL(join(dir, 'scripts', `${name}.mjs`)).href);
  }
});
