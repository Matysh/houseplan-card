import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReviewInput, preflightApplies, rejectPreflight } from '../scripts/review-preflight.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(ROOT, '.github/workflows/_process.yml'), 'utf8');
const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
const handoff = 'Сделано: patch · Файлы: scripts/change.mjs · Гейты: node --test PASS · НЕ сделано: none · Риски: none · Следующий статус: S7-code-review';
const ask = '## ТЗ\n' + ['Сценарий', 'Что человек увидит до и после', 'Проблема', 'Скоуп и не-скоуп',
  'Контракт поведения', 'UX', 'Модель данных и миграция', 'i18n', 'Критерии приёмки', 'План автотестов',
  'Риски', 'Откат', 'Release-артефакты'].map((name) => '### ' + name + '\nописание\n').join('\n') + '\n- AC1 — unit\n';
function input(over = {}) {
  const body = over.body ?? '## ТЗ\n- AC1 — unit\n';
  return { issue: 7, stage: 'code', track: 'show', body, bodyDigest: issueBodyDigest(body), sha, tree,
    currentSha: sha, currentTree: tree, infrastructure: false, files: ['src/sample.ts'],
    commits: [{ sha, files: ['src/sample.ts'], message: 'fix\n\nIssue: #7\nUser-Visible: no\n' }], handoff, ...over };
}
const run = (data, options = {}) => checkReviewInput(data, { ledgerReader: () => ({}), ...options });

test('#855 valid spec/code × ask/show/ship/infra matrix has no stage-foreign requirements', () => {
  for (const stage of ['spec', 'code']) for (const track of ['ask', 'show', 'ship']) for (const infrastructure of [false, true]) {
    const body = infrastructure ? 'Voluntary incomplete spec' : track === 'ask' ? ask : track === 'ship' ? '## ТЗ\nCorrect wording; check unit.' : '## ТЗ\n- AC1 — unit\n';
    const data = input({ stage, track, body, infrastructure, files: infrastructure ? ['scripts/change.mjs'] : ['src/sample.ts'] });
    let ledger = 0;
    const result = run(data, { ledgerReader: () => ledger++ });
    assert.deepEqual(result.errors, [], JSON.stringify({ stage, track, infrastructure }));
    assert.equal(ledger, stage === 'code' ? 1 : 0);
    assert.equal(result.semanticApproval, false);
  }
  assert.equal(run(input({ stage: 'spec', sha: undefined, tree: undefined, handoff: '', commits: [] })).ok, true);
});

test('#855 required sections, acceptance numbers and evidence give field-addressed errors', () => {
  const cases = [
    [input({ body: 'No spec' }), 'body.spec'],
    [input({ track: 'ask' }), 'body.spec.scenario'],
    [input({ body: '## ТЗ\nAC2 unit' }), 'body.spec.AC'],
    [input({ body: '## ТЗ\nAC1 nothing' }), 'body.spec.AC1'],
    [input({ body: '## ТЗ\nAC1 unit\nAC2 unit\nAC3 unit\nAC4 unit' }), 'body.spec.AC'],
    [input({ body: '> ## ТЗ\n> AC1 unit' }), 'body.spec'],
    [input({ handoff: '' }), 'handoff.done'],
    [input({ infrastructure: true }), 'infrastructure'],
  ];
  for (const [data, field] of cases) assert.ok(run(data).errors.some((error) => error.field === field), field);
});

test('#855 malformed ledger, terminal trailers and missing linked report are rejected', () => {
  assert.ok(run(input(), { ledgerReader: () => JSON.parse('{bad') }).errors.some((e) => e.field === 'ledger'));
  const wrong = input({ commits: [{ sha, files: ['scripts/change.mjs'], message: 'Issue: #7\n\nprose after trailers' }] });
  assert.ok(run(wrong).errors.some((e) => e.field.startsWith('commit.')));
  const linked = input({ handoff: handoff + ' [report](docs/reviews/missing.md)' });
  assert.ok(run(linked, { readObject: () => { throw new Error('absent'); } }).errors.some((e) => e.field === 'handoff.link'));
});

test('#855 exact identity and known schema only: no stale PASS or semantic auto-approval', () => {
  const data = input(), result = run(data);
  assert.equal(preflightApplies(result, result.identity), true);
  for (const field of ['sha', 'tree', 'bodyDigest', 'track', 'stage', 'issue'])
    assert.equal(preflightApplies(result, { ...result.identity, [field]: 'different' }), false, field);
  assert.equal(preflightApplies({ ...result, schema: 'unknown' }, result.identity), false);
  assert.equal(preflightApplies({ ...result, semanticApproval: true }, result.identity), false);
  for (const over of [{ bodyDigest: 'f'.repeat(64) }, { currentSha: 'f'.repeat(40) }, { currentTree: 'f'.repeat(40) },
    { requestActive: false }, { currentTrack: 'ask' }])
    assert.equal(run(input(over)).ok, false);
  assert.deepEqual(run(data), run(data));
});

test('#855 rejection returns correct stage only while its request is still active', () => {
  for (const stage of ['spec', 'code']) {
    const result = run(input({ stage, bodyDigest: 'f'.repeat(64) }));
    const from = stage === 'spec' ? 'S4-spec-review' : 'S7-code-review';
    const to = stage === 'spec' ? 'S3-spec' : 'S6-in-progress';
    const moves = [], comments = [];
    assert.equal(rejectPreflight(result, { current: { state: 'open', labels: [from] }, move: (...args) => moves.push(args), comment: (text) => comments.push(text) }), true);
    assert.deepEqual(moves, [[from, to]]);
    assert.match(comments[0], /модель не вызывалась/);
    for (const current of [{ state: 'closed', labels: [from] }, { state: 'open', labels: [from, 'blocked'] },
      { state: 'open', labels: ['S5-ready'] }, { state: 'open', labels: [from, 'S1-new'] }]) {
      assert.equal(rejectPreflight(result, { current, move: () => assert.fail('stale mutation'), comment: () => assert.fail('stale comment') }), false);
    }
  }
});

test('#855 actual workflow shell: valid format reaches reviewer; malformed ledger/body stops before model', { skip: process.platform === 'win32' }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-855-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name))),
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' };
  const git = (...args) => execFileSync('git', args, { cwd: dir, env, encoding: 'utf8' }).trim();
  git('init', '-q');
  mkdirSync(join(dir, 'docs/release-ledger/v1.80.1'), { recursive: true });
  writeFileSync(join(dir, 'docs/release-ledger/cycle.json'), JSON.stringify({ schema: 1, baseStable: 'v1.80.1', targetStable: 'v1.81.0', milestone: { number: 3, title: '1.81' } }));
  git('add', '.'); git('commit', '-qm', 'base'); git('tag', 'v1.80.1'); const base = git('rev-parse', 'HEAD');
  const ledger = join(dir, 'docs/release-ledger/v1.80.1/7.json');
  writeFileSync(ledger, JSON.stringify({ schema: 1, issue: 7, baseStable: 'v1.80.1', category: 'infra', rationale: 'tooling' }));
  git('add', '.'); git('commit', '-qm', 'fix\n\nIssue: #7\nUser-Visible: no');
  const bin = join(dir, 'bin'); mkdirSync(bin);
  const fixture = join(dir, 'issue.json');
  writeFileSync(fixture, JSON.stringify({ state: 'open', labels: [{ name: 'S7-code-review' }], body: '' }));
  const gh = join(bin, 'gh');
  writeFileSync(gh, '#!/usr/bin/env node\n' +
    'const fs=require("node:fs"); const args=process.argv.slice(2);\n' +
    'if(args.includes("POST")||args[0]==="issue"){fs.appendFileSync(process.env.CALLS,args.join(" ")+"\\n");process.stdout.write("{}");}\n' +
    'else if(args.some(x=>x.endsWith("/comments")))process.stdout.write(JSON.stringify([[{body:process.env.HANDOFF}]]));\n' +
    'else process.stdout.write(fs.readFileSync(process.env.FIXTURE,"utf8"));\n');
  chmodSync(gh, 0o755);
  const calls = join(dir, 'calls'); writeFileSync(calls, '');
  const output = join(dir, 'output'); const summary = join(dir, 'summary');
  const step = findStep(workflow, { id: 'preflight' });
  const execute = (digest) => {
    writeFileSync(output, '');
    return runStep(step, step.run, { cwd: dir, env: { ...env, PATH: bin + ':' + process.env.PATH,
      FIXTURE: fixture, CALLS: calls, HANDOFF: handoff, NUM: '7', REPO: 'owner/repo', STAGE: 'code', TRACK: 'show',
      SHA: git('rev-parse', 'HEAD'), TREE: git('rev-parse', 'HEAD^{tree}'), DIGEST: digest, BASE: base,
      TOOLS: ROOT, RUNNER_TEMP: dir, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } });
  };
  let result = execute(issueBodyDigest(''));
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /ok=true/);
  assert.equal(JSON.parse(readFileSync(join(dir, 'review-preflight.json'))).semanticApproval, false);
  assert.equal(readFileSync(calls, 'utf8'), '', 'No model or status action on format success');
  result = execute('f'.repeat(64));
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(output, 'utf8'), /ok=false/);
  assert.match(readFileSync(calls, 'utf8'), /--add-label S6-in-progress --remove-label S7-code-review/);
  writeFileSync(ledger, '{bad'); git('add', '.'); git('commit', '-qm', 'bad fixture\n\nIssue: #7\nUser-Visible: no');
  result = execute(issueBodyDigest(''));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(JSON.parse(readFileSync(join(dir, 'review-preflight.json'))).errors.some((e) => e.field === 'ledger'));
  // A stale report must not mask a new setup/API failure.
  writeFileSync(fixture, '{bad');
  result = execute(issueBodyDigest(''));
  assert.notEqual(result.status, 0);
  assert.equal(readFileSync(output, 'utf8'), '');
  const gate = workflow.slice(workflow.indexOf('- name: Validate на материале'), workflow.indexOf('# #636: прогон на материале идёт'));
  assert.match(gate, /if: .*steps\.preflight\.outputs\.ok == 'true'/);
  const model = findStep(workflow, { name: 'Перепроверить тело перед моделью (#855)' });
  assert.ok(model.line < findStep(workflow, { name: 'Review' }).line);
});
