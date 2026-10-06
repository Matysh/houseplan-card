// #765: подготовка и снятие расхода исполняют скрипты конвейера из снимка `dev`.
//
// Продолжение #749 (там — job `integrate`). Тело `_process.yml` читается из
// `dev` (`@dev`, #623), а рабочая копия `prepare` после «Перейти на ветку
// задачи» — материал: ветка show/ship с чистым слиянием до ревью не ребейзится
// (§10.4) и может нести `scripts/`, отставшие на дни или подменённые. Раньше
// якорь тела issue, reuse (#499), Validate-gate (#510) и проверка ТЗ (#517)
// исполняли скрипты ветки, а `model_review` снимал расход (#737) скриптом из
// материала: на отставшей ветке его нет, и публикация молча писала
// `reason=missing`.
//
// Здесь — контракт двух job (ни одного вызова `scripts/` из рабочей копии, один
// снимок на заход, SHA закреплён и передан в `model_review`) и исполнение
// шагов как есть, настоящим bash и git: ветка задачи отстала от dev (скрипта
// расхода нет) и подменяет review-doc-guard.mjs и model-usage.mjs; подмена не
// исполняется, а вывод привязан к материалу.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { formatUsage } from '../scripts/model-usage.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKFLOW = join(ROOT, '.github', 'workflows', '_process.yml');
const TOOLS_STEP = 'Скрипты конвейера — из dev (#765)';
const TOOLS_ENV = 'TOOLS: ${{ steps.tools.outputs.dir }}';
const USAGE_STEP = 'Снять расход модели';

/** Блок job: от `  <id>:` до следующей job на том же отступе. */
function jobBlock(text, id) {
  const start = text.indexOf(`\n  ${id}:\n`);
  assert.ok(start >= 0, `job ${id}`);
  const rest = text.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[\w-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 2);
}

/** Шаги job: имя, id, env и тело `run` так, как его прочтёт YAML; `code` — без комментариев. */
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
    }
    const code = run.split('\n').filter((line) => !/^\s*#/.test(line)).join('\n');
    return { name: field('name') ?? field('uses'), id: field('id'), env, run, code };
  });
}

const workflow = () => readFileSync(WORKFLOW, 'utf8');
const prepareSteps = () => stepsOf(jobBlock(workflow(), 'prepare'));
const modelSteps = () => stepsOf(jobBlock(workflow(), 'model_review'));
const named = (steps, name) => {
  const step = steps.find((item) => item.name === name || item.name === `"${name}"`);
  assert.ok(step, `шаг «${name}»`);
  return step;
};

// Вызов repo-скрипта не через снимок: `scripts/` без `$TOOLS/`, `${…TOOLS}/`
// или `$tools/` шага расхода перед ним; import() относительного пути.
const LOCAL_CALL = /(?<!\$TOOLS\/|TOOLS\}\/|\$tools\/)\bscripts\/[\w.-]+\.mjs/;
const LOCAL_IMPORT = /import\(\s*['"`]\.{0,2}\/?scripts\//;

test('#765 AC1: в job prepare ни один шаг не зовёт скрипт из рабочей копии — только из снимка dev', () => {
  const calls = [];
  for (const step of prepareSteps()) {
    assert.doesNotMatch(step.code, LOCAL_CALL, `«${step.name}»: repo-скрипт мимо снимка — рабочая копия здесь ветка задачи`);
    assert.doesNotMatch(step.code, LOCAL_IMPORT, `«${step.name}»: import() скрипта рабочей копии`);
    if (step.name !== TOOLS_STEP) {
      assert.doesNotMatch(step.code, /\$tools\b|git archive/, `«${step.name}»: своё извлечение скриптов вместо снимка захода`);
    }
    const used = [
      ...[...step.code.matchAll(/node "\$TOOLS\/scripts\/([\w.-]+\.mjs)"/g)].map((m) => m[1]),
      ...[...step.code.matchAll(/process\.env\.TOOLS\}\/scripts\/([\w.-]+\.mjs)/g)].map((m) => m[1]),
    ];
    if (used.length) assert.ok(step.env.includes(TOOLS_ENV), `«${step.name}»: каталог снимка — из выхода шага tools`);
    for (const script of used) calls.push(`${step.name}: ${script}`);
  }
  const count = (name) => calls.filter((call) => call.endsWith(`: ${name}`)).length;
  assert.deepEqual(
    Object.fromEntries(['process-track.mjs', 'rebase-generated.mjs', 'merge-candidate.mjs', 'review-doc-guard.mjs', 'validate-gate.mjs']
      .map((name) => [name, count(name)])),
    // review-doc-guard: хеш тела для якоря, --reuse (#499), изменившееся ТЗ (#517).
    { 'process-track.mjs': 1, 'rebase-generated.mjs': 1, 'merge-candidate.mjs': 1, 'review-doc-guard.mjs': 3, 'validate-gate.mjs': 1 },
    calls.join('\n'),
  );
});

test('#765 AC1: снимок — один на заход, SHA dev закреплён до перехода на ветку и передан в model_review', () => {
  const steps = prepareSteps();
  const at = steps.findIndex((step) => step.name === TOOLS_STEP);
  assert.ok(at >= 0, `шаг «${TOOLS_STEP}»`);
  const snapshot = steps[at];
  assert.equal(snapshot.id, 'tools');
  assert.ok(steps.findIndex((step) => /^actions\/setup-node@/.test(step.name)) < at, 'после setup-node');
  assert.ok(at < steps.findIndex((step) => step.name === 'Перейти на ветку задачи'), 'до перехода на материал');
  assert.match(snapshot.code, /^set -euo pipefail$/m, 'сбой git archive не проходит молча через | tar');
  assert.match(snapshot.code, /^git fetch -q origin dev$/m);
  assert.match(snapshot.code, /^sha=\$\(git rev-parse origin\/dev\)$/m, 'SHA закрепляется один раз');
  assert.match(snapshot.code, /^git archive "\$sha" scripts \.github\/workflows\/validate\.yml \| tar -x -C "\$tools"$/m,
    'архив закреплённого SHA, а не движущейся origin/dev; validate.yml читает ci-proof.mjs по пути от себя');
  assert.match(snapshot.code, /^\{ echo "dir=\$tools"; echo "sha=\$sha"; \} >> "\$GITHUB_OUTPUT"$/m);
  const head = jobBlock(workflow(), 'prepare');
  assert.match(head.slice(0, head.indexOf('\n    steps:\n')), /^ {6}tools_sha: \$\{\{ steps\.tools\.outputs\.sha \}\}$/m, 'выход job tools_sha');
  const usage = named(modelSteps(), USAGE_STEP);
  assert.ok(usage.env.includes('TOOLS_SHA: ${{ needs.prepare.outputs.tools_sha }}'), 'расход — из того же коммита dev');
  assert.doesNotMatch(usage.code, LOCAL_CALL, 'model-usage.mjs — не из материала');
  assert.match(usage.code, /^git archive "\$TOOLS_SHA" scripts \| tar -x -C "\$tools"$/m);
  assert.match(usage.code, /^line=\$\(node "\$tools\/scripts\/model-usage\.mjs" --execution-file="\$EXEC"\)$/m);
  for (const step of modelSteps()) {
    assert.doesNotMatch(step.code, LOCAL_CALL, `model_review «${step.name}»: repo-скрипт из материала`);
  }
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

const BODY = '## ТЗ\n\nтело задачи\n';
const USAGE = { input_tokens: 11, output_tokens: 22, cache_creation_input_tokens: 33, cache_read_input_tokens: 44, num_turns: 5 };
const EVIL = "#!/usr/bin/env node\nprocess.stdout.write('reuse=true\\ndoc=CODE-REVIEW-7-r1.md\\nround=1\\ntree=x\\n');\n"
  + 'export const issueBodyDigest = () => "подменено"; export const issueBodyChanged = () => ({ doc: "x", recorded: "y" });\n';

/**
 * Временный origin: dev несёт нынешние scripts/ и validate.yml; ветка задачи
 * ответвлена раньше — model-usage.mjs в ней нет — и подменяет
 * review-doc-guard.mjs скриптом, который выдаёт себе reuse зелёного вердикта.
 */
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'hp-765-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (cwd, ...args) => {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
    assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const origin = join(root, 'origin.git');
  const work = join(root, 'work');
  const temp = join(root, 'runner');
  const bin = join(root, 'bin');
  mkdirSync(temp);
  mkdirSync(bin);
  git(root, 'init', '--bare', '-q', origin);
  git(root, 'clone', '-q', origin, work);
  git(work, 'checkout', '-q', '-b', 'dev');
  writeFileSync(join(work, 'README.md'), 'старый dev\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'старый dev');
  const old = git(work, 'rev-parse', 'HEAD');
  cpSync(join(ROOT, 'scripts'), join(work, 'scripts'), {
    recursive: true, filter: (src) => !['node_modules', '__pycache__'].includes(basename(src)),
  });
  mkdirSync(join(work, '.github', 'workflows'), { recursive: true });
  cpSync(join(ROOT, '.github', 'workflows', 'validate.yml'), join(work, '.github', 'workflows', 'validate.yml'));
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'dev');
  git(work, 'push', '-q', 'origin', 'dev');
  git(work, 'checkout', '-q', '-b', 'issue/7-x', old);
  mkdirSync(join(work, 'scripts'), { recursive: true });
  writeFileSync(join(work, 'scripts', 'review-doc-guard.mjs'), EVIL);
  writeFileSync(join(work, 'src.txt'), 'работа задачи\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-q', '-m', 'ветка задачи');
  git(work, 'push', '-q', 'origin', 'issue/7-x');
  git(work, 'checkout', '-q', 'dev');
  // gh: тело issue — фиксированное, сеть не нужна.
  writeFileSync(join(root, 'body.md'), BODY);
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env bash\ncat '${join(root, 'body.md')}'\n`);
  chmodSync(join(bin, 'gh'), 0o755);
  const env = { ...GIT_ENV, RUNNER_TEMP: temp, PATH: `${bin}:${process.env.PATH}` };
  // Шаг (из stepsOf) — тело как есть, shell — по правилам раннера (#766).
  const run = (step, extra) => {
    const output = join(temp, `output-${Math.random().toString(36).slice(2)}`);
    const summary = join(temp, 'summary.md');
    const r = runStep(findStep(workflow(), `      - name: ${step.name}\n`, '_process.yml'), step.run, {
      cwd: work, encoding: 'utf8', env: { ...env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary, ...extra },
    });
    let out = '';
    try { out = readFileSync(output, 'utf8'); } catch { /* шаг ничего не записал */ }
    return { ...r, out };
  };
  return { root, work, temp, git, run };
}

const outputOf = (out, key) => out.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1];

test('#765 AC2: шаги prepare на ветке, отставшей от dev и подменившей review-doc-guard.mjs, исполняют dev', (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const fx = fixture(t);
  const steps = prepareSteps();
  const tools = fx.run(named(steps, TOOLS_STEP));
  assert.equal(tools.status, 0, tools.stderr);
  const dir = outputOf(tools.out, 'dir');
  const sha = outputOf(tools.out, 'sha');
  assert.equal(sha, fx.git(fx.work, 'rev-parse', 'origin/dev'), 'закреплён SHA dev');
  assert.ok(!dir.startsWith(fx.work), 'снимок вне рабочей копии');
  // «Перейти на ветку задачи»: рабочая копия становится материалом.
  fx.git(fx.work, 'checkout', '-q', 'origin/issue/7-x');
  const env = { TOOLS: dir, NUM: '7', REPO: 'o/r', GH_TOKEN: 'x' };

  const material = fx.run(named(steps, 'Зафиксировать SHA материала ревью'), env);
  assert.equal(material.status, 0, material.stderr);
  assert.equal(outputOf(material.out, 'sha'), fx.git(fx.work, 'rev-parse', 'HEAD'), 'якорь — материал, а не снимок');
  assert.equal(outputOf(material.out, 'issue_body'), issueBodyDigest(BODY), 'хеш тела — функцией dev, не ветки');

  const reuse = fx.run(named(steps, 'Зелёный вердикт прошлого захода применим без ревью (#499)'),
    { ...env, ISSUE_BODY: issueBodyDigest(BODY) });
  assert.equal(reuse.status, 0, reuse.stderr);
  assert.equal(outputOf(reuse.out, 'reuse'), 'false', 'подменённый скрипт выдал бы себе reuse=true — ревью без модели');

  const spec = fx.run(named(steps, 'ТЗ менялось после зелёного ревью ТЗ (#517)'),
    { ...env, DIGEST: issueBodyDigest(BODY) });
  assert.equal(spec.status, 0, spec.stderr);
  assert.equal(outputOf(spec.out, 'changed'), 'false', 'подменённый скрипт объявил бы ТЗ изменившимся');
});

test('#765 AC3: расход снимается скриптом закреплённого SHA — на ветке без model-usage.mjs и после сдвига dev', (t) => {
  if (!hasTools()) { t.skip('bash/tar/git недоступны'); return; }
  const fx = fixture(t);
  const tools = fx.run(named(prepareSteps(), TOOLS_STEP));
  assert.equal(tools.status, 0, tools.stderr);
  const sha = outputOf(tools.out, 'sha');
  // dev двинулся после подготовки: новая версия скрипта расхода печатает чужое.
  fx.git(fx.work, 'checkout', '-q', 'dev');
  writeFileSync(join(fx.work, 'scripts', 'model-usage.mjs'), "process.stdout.write('позже\\n');\n");
  fx.git(fx.work, 'add', '-A');
  fx.git(fx.work, 'commit', '-q', '-m', 'dev позже');
  fx.git(fx.work, 'push', '-q', 'origin', 'dev');
  // model_review: рабочая копия — материал, model-usage.mjs в нём нет.
  fx.git(fx.work, 'checkout', '-q', 'origin/issue/7-x');
  const exec = join(fx.temp, 'execution.json');
  writeFileSync(exec, JSON.stringify([{ type: 'system' }, { type: 'result', usage: USAGE, num_turns: USAGE.num_turns }]));
  const step = named(modelSteps(), USAGE_STEP);
  const usage = fx.run(step, { EXEC: exec, TOOLS_SHA: sha });
  assert.equal(usage.status, 0, usage.stderr);
  assert.equal(outputOf(usage.out, 'line'), formatUsage(USAGE), 'строка данных, а не missing и не версия позже');
  // Нет SHA из prepare — громкий сбой отчётного шага, а не молчаливая строка.
  const lost = fx.run(step, { EXEC: exec, TOOLS_SHA: '' });
  assert.notEqual(lost.status, 0);
  assert.match(lost.stdout + lost.stderr, /нет SHA снимка/);
});
