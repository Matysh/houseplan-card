import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  MAX_CANDIDATES, MAX_BASE_PROOFS, baseSummary, greenShas, judgedShas, pickBase, pickRangeBase, integrationBases,
} from '../scripts/classify-base.mjs';
import { buildCiProof, JOB_RULES } from '../scripts/ci-proof.mjs';
import { jobInstanceNames, validateJobs } from '../scripts/workflow-jobs.mjs';
import { importClosure } from './helpers/import-closure.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/classify-base.mjs', import.meta.url));

test('зелёными считаются только успешно завершённые прогоны (#387)', () => {
  const green = greenShas({
    workflow_runs: [
      { head_sha: 'aaa', conclusion: 'success' },
      // Ровно тот случай, из-за которого заведён #387: прогон предыдущего
      // пуша отменён следующим пушем.
      { head_sha: 'bbb', conclusion: 'cancelled' },
      { head_sha: 'ccc', conclusion: 'failure' },
      { head_sha: 'ddd', conclusion: null, status: 'in_progress' },
      { head_sha: 'eee', conclusion: 'skipped' },
    ],
  });
  assert.deepEqual([...green], ['aaa']);
});

test('недоступный или битый ответ API даёт пустой список, а не падение (#387)', () => {
  for (const payload of [null, undefined, {}, { workflow_runs: null }, 'мусор', 42]) {
    assert.equal(greenShas(payload).size, 0, `${JSON.stringify(payload)}`);
  }
});

test('база — самый новый зелёный предок (#387)', () => {
  const choice = pickBase({
    candidates: ['c3', 'c2', 'c1'],
    green: new Set(['c2', 'c1']),
    mergeBase: 'mb',
  });
  assert.equal(choice.base, 'c2', 'из двух зелёных берётся более новый');
  assert.equal(choice.proven, true);
  assert.equal(choice.skipped, 1);
});

test('цепочка отменённых прогонов расширяет диапазон до merge-base (#387)', () => {
  // Сценарий #86 r5: у предыдущего пуша прогон cancelled, зелёных предков нет.
  const choice = pickBase({ candidates: ['fa146fb1', '04da7eb1'], green: new Set(), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
  assert.equal(choice.proven, false);
  assert.match(baseSummary(choice, { head: 'head1234', mergeBase: 'mb345678' }).join('\n'),
    /расширен до/);
});

test('ветка без собственных коммитов не ломает выбор (#387)', () => {
  const choice = pickBase({ candidates: [], green: new Set(['x']), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
  assert.equal(choice.skipped, 0);
});

test('обход кандидатов ограничен сверху (#387)', () => {
  const many = Array.from({ length: MAX_CANDIDATES + 5 }, (_, i) => `c${i}`);
  // Зелёный есть, но лежит за пределом обхода: ответ обязан быть безопасным,
  // то есть более широким, а не «ничего не нашли — берём последний».
  const choice = pickBase({ candidates: many, green: new Set([`c${MAX_CANDIDATES + 2}`]), mergeBase: 'mb' });
  assert.equal(choice.base, 'mb');
});

test('CLI считает базу по настоящей истории git (#387)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-classify-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'main');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    const commit = (text) => {
      writeFileSync(join(dir, 'file.txt'), text);
      git('add', '-A');
      git('commit', '-qm', text);
      return git('rev-parse', 'HEAD');
    };
    const root = commit('root');
    const green = commit('проверенный');
    const cancelled = commit('прогон отменён');
    const head = commit('текущий пуш');

    const runsFile = join(dir, 'runs.json');
    const out = join(dir, 'out.txt');
    const run = (runs) => {
      writeFileSync(runsFile, JSON.stringify(runs));
      writeFileSync(out, '');
      const result = spawnSync(process.execPath, [
        SCRIPT, `--head=${head}`, `--merge-base=${root}`, `--runs=${runsFile}`,
      ], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
      assert.equal(result.status, 0, result.stderr);
      return { stdout: result.stdout, output: readFileSync(out, 'utf8') };
    };

    const withGreen = run({
      workflow_runs: [
        { head_sha: green, conclusion: 'success' },
        { head_sha: cancelled, conclusion: 'cancelled' },
        // HEAD в списке зелёных быть не может, но даже если API его вернёт,
        // сам себя коммит проверенным не объявляет.
        { head_sha: head, conclusion: 'success' },
      ],
    });
    assert.match(withGreen.output, new RegExp(`base=${green}\\n`));
    assert.match(withGreen.output, /proven=true/);

    const noGreen = run({ workflow_runs: [{ head_sha: cancelled, conclusion: 'cancelled' }] });
    assert.match(noGreen.output, new RegExp(`base=${root}\\n`));
    assert.match(noGreen.output, /proven=false/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- база гейтов диапазона (#388) ------------------------------------------

test('гейты диапазона берут тот же зелёный предок (#388)', () => {
  const choice = pickRangeBase({
    candidates: ['отменён2', 'отменён1', 'зелёный'],
    green: new Set(['зелёный']),
    fallback: 'before',
  });
  assert.equal(choice.base, 'зелёный');
  assert.equal(choice.proven, true);
  // Ровно те два коммита, которые до #388 не судил никто.
  assert.equal(choice.skipped, 2);
});

test('без зелёного предка база остаётся прежней, но помечается недоказанной (#388)', () => {
  // Расширять диапазон здесь нельзя: гейт, который сам красит прогон, лишил бы
  // следующий пуш зелёного предка и запер dev в красноте навсегда. Фолбэк
  // обязан не зависеть от собственного успеха гейта.
  const choice = pickRangeBase({ candidates: ['a', 'b'], green: new Set(), fallback: 'before' });
  assert.equal(choice.base, 'before');
  assert.equal(choice.proven, false);
  const summary = baseSummary(choice, { head: 'head1234', mergeBase: '' }).join('\n');
  assert.match(summary, /НЕ доказательство/);
  assert.match(summary, /могли не пройти ни одного гейта/);
});

test('пустой фолбэк не выдаёт мусор за базу (#388)', () => {
  const choice = pickRangeBase({ candidates: [], green: new Set(), fallback: undefined });
  assert.equal(choice.base, '');
  assert.equal(choice.proven, false);
});

test('CLI режима range считает базу по истории и пишет своё имя выхода (#388)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-range-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'dev');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    const commit = (text) => {
      writeFileSync(join(dir, 'file.txt'), text);
      git('add', '-A');
      git('commit', '-qm', text);
      return git('rev-parse', 'HEAD');
    };
    commit('корень');
    const green = commit('прогон зелёный');
    const cancelled = commit('прогон отменён');
    const head = commit('текущий пуш');
    const runsFile = join(dir, 'runs.json');
    const out = join(dir, 'out.txt');
    writeFileSync(runsFile, JSON.stringify({
      workflow_runs: [
        { head_sha: green, status: 'completed', conclusion: 'success' },
        { head_sha: cancelled, status: 'completed', conclusion: 'cancelled' },
      ],
    }));
    writeFileSync(out, '');
    const result = spawnSync(process.execPath, [
      SCRIPT, `--head=${head}`, '--mode=range', '--name=range_base',
      `--fallback=${cancelled}`, `--runs=${runsFile}`,
    ], { cwd: dir, encoding: 'utf8', env: { ...process.env, GITHUB_OUTPUT: out } });
    assert.equal(result.status, 0, result.stderr);
    const output = readFileSync(out, 'utf8');
    // Имя выхода своё: общее `base` однажды подсунуло бы потребителю чужую базу.
    assert.match(output, new RegExp(`range_base=${green}\\n`));
    assert.match(output, /range_base_proven=true/);
    assert.equal(output.includes('\nbase='), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('судимость и успех — разные предикаты, и путать их дорого (#388)', () => {
  const payload = {
    workflow_runs: [
      { head_sha: 'зелёный', status: 'completed', conclusion: 'success' },
      // Прогон упал по своей причине — backend на dev был красным несколько
      // дней. Коммит при этом СУДИЛИ: вердикт вынесен, автор его видел.
      { head_sha: 'красный', status: 'completed', conclusion: 'failure' },
      // Отменён следующим пушем — вот этот коммит не судил никто.
      { head_sha: 'отменён', status: 'completed', conclusion: 'cancelled' },
      { head_sha: 'идёт', status: 'in_progress', conclusion: null },
    ],
  };
  assert.deepEqual([...greenShas(payload)], ['зелёный'],
    'классификации нужен доказанный успех тяжёлых гейтов (#387)');
  assert.deepEqual([...judgedShas(payload)].sort(), ['зелёный', 'красный'],
    'гейтам диапазона нужен факт суда, а не оправдательный вердикт (#388)');
});

test('красный прогон не переоткрывает уже осуждённые коммиты (#388)', () => {
  // Если бы база уезжала за каждый упавший прогон, гейт предъявлял бы текущему
  // пушу чужой долг — ровно это и уронило dev 30 августа.
  const judged = judgedShas({
    workflow_runs: [{ head_sha: 'предыдущий', status: 'completed', conclusion: 'failure' }],
  });
  const choice = pickRangeBase({
    candidates: ['предыдущий', 'давний'],
    green: judged,
    fallback: 'before',
  });
  assert.equal(choice.base, 'предыдущий');
  assert.equal(choice.skipped, 0);
});

test('заголовок summary называет задачу потребителя, а не режим кода (#388)', () => {
  // На живом прогоне #2157 база диапазона представилась «классификацией» и
  // отправила читателя не в тот issue. Заголовок обязан следовать режиму.
  const green = { base: 'aaaaaaaa', reason: 'green-ancestor', proven: true, skipped: 1 };
  const fallback = { base: 'bbbbbbbb', reason: 'fallback', proven: false, skipped: 2 };
  const head = { head: 'cccccccc', mergeBase: 'dddddddd' };
  assert.match(baseSummary(green, { ...head, mode: 'range' })[0], /#388/);
  assert.match(baseSummary(fallback, { ...head, mode: 'range' })[0], /#388/);
  assert.match(baseSummary(green, head)[0], /#387/, 'по умолчанию — классификация');
  assert.match(
    baseSummary({ base: 'e', reason: 'merge-base', proven: false, skipped: 0 }, head)[0],
    /#387/,
  );
});

const TREE = 'a'.repeat(40), OLDER = 'b'.repeat(40), PREVIOUS = 'c'.repeat(40), HEAD = 'd'.repeat(40);
function profileFixture(sha = PREVIOUS, id = 20) {
  const run = { id, run_attempt: 2, head_sha: sha, status: 'completed', conclusion: 'success', event: 'push',
    path: '.github/workflows/validate-product.yml', repository: { full_name: 'x/y' }, head_repository: { full_name: 'x/y' } };
  const needs = { preflight: { result: 'success' }, changes: { result: 'success', outputs: { frontend: 'true' } },
    reuse: { result: 'success', outputs: {} }, frontend: { result: 'success' } };
  const workflow = validateJobs();
  const proof = buildCiProof({ candidateSha: sha, candidateTree: TREE, runId: id, attempt: 2, event: 'push', needs,
    workflow: 'validate-product.yml', requiredProfiles: ['product', 'tooling', 'docs'] });
  const jobs = ['preflight', 'changes', 'reuse', 'frontend'].flatMap(name => jobInstanceNames(workflow.get(name))
    .map(name => ({ name, conclusion: 'success' })));
  const profileRuns = new Map(['docs', 'tooling'].map((profile, index) => [profile, {
    run: { ...run, id: id + index + 1, path: `.github/workflows/validate-${profile}.yml` },
    proof: { schema: proof.schema, candidate: proof.candidate,
      run: { ...proof.run, id: id + index + 1, workflow: `validate-${profile}.yml` }, checks: { preflight: proof.checks.preflight } },
    jobs: [{ name: JOB_RULES.preflight[0].name, conclusion: 'success' },
      ...(profile === 'tooling' ? [{ name: JOB_RULES.frontend[1].name, conclusion: 'success' }] : [])],
  }]));
  return { run, context: { proof, jobs, profileRuns } };
}
const chooseIntegration = (fixtures, options = {}) => integrationBases({
  head: HEAD, candidates: [PREVIOUS, OLDER], fallback: PREVIOUS, repo: 'x/y',
  payload: { workflow_runs: fixtures.map(f => f.run) },
  ops: { candidateTree: async () => TREE, proof: async run => fixtures.find(f => f.run.id === run.id).context },
  ...options,
});

test('#1060 sequential accepted split merges advance the green base using complete immutable proof', async () => {
  const previous = profileFixture(), older = profileFixture(OLDER, 10); let reads = 0;
  const { base, range } = await chooseIntegration([previous, older], { ops: {
    candidateTree: async sha => { assert.equal(sha, PREVIOUS); return TREE; },
    proof: async run => { reads++; assert.equal(run.id, 20); return previous.context; },
  } });
  assert.equal(base.base, PREVIOUS); assert.equal(base.proven, true);
  assert.equal(range.base, PREVIOUS); assert.equal(reads, 1, 'older accepted neighbours need no repeated artifact reads');
  const promoted = await chooseIntegration([profileFixture(HEAD)], { candidates: [PREVIOUS, OLDER] });
  assert.equal(promoted.base.base, HEAD); assert.equal(promoted.base.reason, 'head-proven');
});

test('#1060 split status cannot replace missing, red, foreign or partial proof and companions', async t => {
  const changes = {
    'missing artifact': f => { f.context.proof = null; },
    'foreign proof SHA': f => { f.context.proof.candidate.sha = HEAD; },
    'foreign tree': f => { f.context.proof.candidate.tree = HEAD; },
    'foreign attempt': f => { f.context.proof.run.attempt = 1; },
    'unexecuted frontend': f => { f.context.jobs.pop(); },
    'missing companion': f => { f.context.profileRuns.delete('tooling'); },
    'running companion': f => { f.context.profileRuns.get('tooling').run.status = 'in_progress'; },
    'red companion': f => { f.context.profileRuns.get('tooling').run.conclusion = 'failure'; },
    'cancelled companion': f => { f.context.profileRuns.get('tooling').run.conclusion = 'cancelled'; },
    'foreign companion SHA': f => { f.context.profileRuns.get('docs').run.head_sha = HEAD; },
    'foreign companion repo': f => { f.context.profileRuns.get('docs').run.head_repository = { full_name: 'fork/foreign' }; },
    'missing companion job': f => { f.context.profileRuns.get('tooling').jobs.pop(); },
    'missing companion artifact': f => { delete f.context.profileRuns.get('tooling').proof; },
    'foreign companion artifact': f => { f.context.profileRuns.get('tooling').proof.run.attempt = 9; },
    'foreign producer': f => { f.run.head_repository = { full_name: 'fork/foreign' }; },
    'foreign workflow': f => { f.run.path = '.github/workflows/evil.yml'; },
    'red product': f => { f.run.conclusion = 'failure'; },
    'cancelled product': f => { f.run.conclusion = 'cancelled'; },
    'running product': f => { f.run.status = 'in_progress'; },
  };
  for (const [name, change] of Object.entries(changes)) await t.test(name, async () => {
    const candidate = profileFixture(); change(candidate);
    const result = await chooseIntegration([candidate]);
    assert.equal(result.base.proven, false); assert.equal(result.base.base, '', 'caller must classify all families');
  });
});

test('#1060 latest red product cannot hide behind an earlier green run on the same SHA', async () => {
  const valid = profileFixture(), newer = profileFixture(PREVIOUS, 30), older = profileFixture(OLDER, 10);
  newer.run.conclusion = 'failure';
  const result = await chooseIntegration([valid, newer, older]);
  assert.equal(result.base.base, OLDER);
});

test('#1060 judged failed canonical is a range base, never successful product coverage', async () => {
  const failed = profileFixture(); failed.run.path = '.github/workflows/validate.yml'; failed.run.conclusion = 'failure';
  const result = await chooseIntegration([failed, profileFixture(OLDER, 10)]);
  assert.equal(result.range.base, PREVIOUS); assert.equal(result.range.proven, true);
  assert.equal(result.base.base, OLDER); assert.equal(result.base.proven, true);
  const unavailable = await chooseIntegration([profileFixture()], { ops: {
    candidateTree: async () => TREE, proof: async () => { throw Error('artifact unavailable'); },
  } });
  assert.equal(unavailable.base.base, ''); assert.equal(unavailable.base.proven, false);
});

test('#1060 unavailable long-history proofs have bounded discovery and never optimistic coverage', async () => {
  const fixtures = Array.from({ length: 20 }, (_, i) => profileFixture((i + 20).toString(16).padStart(40, '0'), i + 100));
  let calls = 0;
  const result = await chooseIntegration(fixtures, { candidates: fixtures.map(f => f.run.head_sha), ops: {
    candidateTree: async () => TREE, proof: async () => { calls++; throw Error('unavailable'); },
  } });
  assert.equal(calls, MAX_BASE_PROOFS); assert.equal(result.base.base, ''); assert.equal(result.base.proven, false);
  let aborted = 0;
  const slow = await chooseIntegration(fixtures, { candidates: fixtures.map(f => f.run.head_sha), maxProofs: 2, proofMs: 5,
    ops: { candidateTree: async () => TREE, proof: (_run, { signal }) => new Promise(() => {
      signal.addEventListener('abort', () => { aborted++; });
    }) } });
  assert.equal(aborted, 2); assert.equal(slow.base.base, ''); assert.equal(slow.base.proven, false);
  let elapsed = 0, timedCalls = 0;
  const expired = await chooseIntegration(fixtures, { candidates: fixtures.map(f => f.run.head_sha), totalMs: 30,
    ops: { candidateTree: async () => TREE, now: () => elapsed, proof: async () => {
      timedCalls++; elapsed = 31; throw Error('slow unavailable source');
    } } });
  assert.equal(timedCalls, 1); assert.equal(expired.base.proven, false, 'one exhausted shared deadline ends discovery');
});

test('#1060 cold integration CLI emits separate unproven green and judged range outputs without npm', () => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-integration-base-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
  try {
    git('init', '-q', '-b', 'dev'); git('config', 'user.email', 'test@example.com'); git('config', 'user.name', 'test');
    writeFileSync(join(dir, 'file.txt'), 'before'); git('add', '.'); git('commit', '-qm', 'before');
    const before = git('rev-parse', 'HEAD');
    writeFileSync(join(dir, 'file.txt'), 'after'); git('add', '.'); git('commit', '-qm', 'after');
    const head = git('rev-parse', 'HEAD'), out = join(dir, 'output'), runs = join(dir, 'runs.json');
    const root = dirname(dirname(SCRIPT));
    for (const source of importClosure(SCRIPT)) {
      const target = join(dir, relative(root, source)); mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, readFileSync(source));
    }
    writeFileSync(runs, JSON.stringify({ workflow_runs: [{ id: 1, head_sha: before,
      path: '.github/workflows/validate.yml', status: 'completed', conclusion: 'failure', event: 'push' }] }));
    const result = spawnSync(process.execPath, [join(dir, 'scripts/classify-base.mjs'), '--mode=integration', '--repo=x/y', `--head=${head}`,
      `--fallback=${before}`, `--runs=${runs}`], { cwd: dir, encoding: 'utf8',
      env: { ...process.env, GITHUB_OUTPUT: out, GITHUB_STEP_SUMMARY: join(dir, 'summary') } });
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(out, 'utf8'), /^base=\nbase_proven=false\n/);
    assert.match(readFileSync(out, 'utf8'), new RegExp(`range_base=${before}\\nrange_base_proven=true`));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
