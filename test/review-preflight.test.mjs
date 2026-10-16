import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkReviewInput, collectReviewInput, preflightApplies, preflightComment, rejectPreflight, specFormatErrors } from '../scripts/review-preflight.mjs';
import { handoffDigest, handoffSnapshot, parseHandoff, selectHandoff } from '../scripts/review-handoff.mjs';
import { issueBodyDigest } from '../scripts/review-doc-guard.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(ROOT, '.github/workflows/_process.yml'), 'utf8');
const sha = 'a'.repeat(40), tree = 'b'.repeat(40);
const handoff = 'Сделано: patch · Файлы: scripts/change.mjs · Гейты: node --test PASS · НЕ сделано: none · Риски: none · Следующий статус: S7-code-review';
const headingHandoff = '## Сделано\npatch\n## Файлы\nscripts/change.mjs\n## Гейты\nnode --test PASS\n## НЕ сделано\nnone\n## Риски\nnone\n## Следующий статус\nS7-code-review';
const stamp = '2026-10-15T10:00:00Z';
const comment = (body, id = 11, updated_at = stamp) => ({ id, html_url: `https://github.com/o/r/issues/7#issuecomment-${id}`,
  created_at: stamp, updated_at, body });
const provenance = body => ({ id: 11, url: 'https://github.com/o/r/issues/7#issuecomment-11',
  createdAt: stamp, updatedAt: stamp, digest: handoffDigest(body) });
const ask = '## ТЗ\n' + ['Сценарий', 'Что человек увидит до и после', 'Проблема', 'Скоуп и не-скоуп',
  'Контракт поведения', 'UX', 'Модель данных и миграция', 'i18n', 'Критерии приёмки', 'План автотестов',
  'Риски', 'Откат', 'Release-артефакты'].map((name) => '### ' + name + '\nописание\n').join('\n') + '\n- AC1 — unit\n';
function input(over = {}) {
  const body = over.body ?? '## ТЗ\n- AC1 — unit\n';
  return { issue: 7, stage: 'code', track: 'show', body, bodyDigest: issueBodyDigest(body), sha, tree,
    currentSha: sha, currentTree: tree, infrastructure: false, files: ['src/sample.ts'],
    commits: [{ sha, files: ['src/sample.ts'], message: 'fix\n\nIssue: #7\nUser-Visible: no\n' }], handoff,
    handoffProvenance: provenance(over.handoff ?? handoff), ...over };
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

test('#922: trailing AC references do not replace a criterion number or its evidence block', () => {
  const prefix = ask.slice(0, ask.lastIndexOf('\n- AC1'));
  for (const reference of ['AC1-4', 'AC1–AC4', 'AC1, AC2 и AC4', '**AC1** / `AC4`']) {
    const rows = Array.from({ length: 7 }, (_, index) => `- AC${index + 1} — requirement; unit.`);
    rows[5] += ` Согласовано с ${reference}.`;
    assert.deepEqual(specFormatErrors(prefix + '\n' + rows.join('\n'), 'ask'), [], reference);
    rows[5] = `| AC6 | requirement; согласовано с ${reference}. |\n  Доказательство: smoke.`;
    assert.deepEqual(specFormatErrors(prefix + '\n' + rows.join('\n'), 'ask'), [], 'table + next-line evidence: ' + reference);
  }
});

test('#922: cross-references still cannot excuse missing criteria, evidence or the show limit', () => {
  const rows = Array.from({ length: 7 }, (_, index) => `- AC${index + 1} — unit.`);
  rows[5] += ' Согласовано с AC1-4.';
  const prefix = ask.slice(0, ask.lastIndexOf('\n- AC1'));
  const missing = [...rows]; missing.splice(5, 1);
  assert.ok(specFormatErrors(prefix + '\n' + missing.join('\n'), 'ask').some(error => error.field === 'body.spec.AC'));
  const noEvidence = [...rows]; noEvidence[5] = '- AC6 — criterion with reference AC1-4.';
  assert.ok(specFormatErrors(prefix + '\n' + noEvidence.join('\n'), 'ask').some(error => error.field === 'body.spec.AC6'));
  const show = '## ТЗ\nAC1 unit\nAC2 unit\nAC3 unit\nAC4 unit; see AC1.';
  assert.ok(specFormatErrors(show, 'show').some(error => error.message === 'Show allows at most three AC'));
  const hidden = '## ТЗ\nAC1 unit\nAC3 unit\n> AC2 unit; AC1\n```md\nAC2 unit\n```';
  assert.ok(specFormatErrors(hidden, 'show').some(error => error.field === 'body.spec.AC'));
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
  assert.equal(preflightApplies({ ...result, schema: 'houseplan-review-preflight/v1' }, result.identity), false);
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
  cpSync(join(ROOT, 'scripts'), join(dir, 'scripts'), { recursive: true });
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
    'else if(args.some(x=>x.endsWith("/comments")))process.stdout.write(JSON.stringify([[{id:11,html_url:"https://github.com/o/r/issues/7#issuecomment-11",created_at:"2026-10-15T10:00:00Z",updated_at:process.env.HANDOFF_UPDATED||"2026-10-15T10:00:00Z",body:process.env.HANDOFF}]]));\n' +
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
  const selectedSnapshot = readFileSync(output, 'utf8').match(/^handoff_snapshot=(.+)$/m)[1];
  const preparedEnv = { ...env, RUNNER_TEMP: dir, GITHUB_OUTPUT: output, GITHUB_RUN_ID: '10', GITHUB_RUN_ATTEMPT: '1',
    NUM: '7', STAGE: 'code', CYCLE: '1', BRANCH: 'issue/7-test', MATERIAL_SHA: git('rev-parse', 'HEAD'),
    MATERIAL_TREE: git('rev-parse', 'HEAD^{tree}'), MATERIAL_SPECS: '', MATERIAL_ISSUE_BODY: issueBodyDigest(''),
    VALIDATE_RESULT: 'green', VALIDATE_URL: 'https://example.test/validate', REBASE_NOTE: '', VALIDATED_NOTE: '',
    SPEC_BODY_CHANGED: 'false', SPEC_BODY_DOC: '', SPEC_BODY_RECORDED: '', HANDOFF_SNAPSHOT: selectedSnapshot };
  const preparedStep = findStep(workflow, { id: 'prepared' });
  assert.equal(runStep(preparedStep, preparedStep.run, { cwd: dir, env: preparedEnv }).status, 0);
  const verifyStep = findStep(workflow, { name: 'Проверить контракт и exact material' });
  result = runStep(verifyStep, verifyStep.run, { cwd: dir, env: preparedEnv });
  assert.equal(result.status, 0, result.stderr);
  const packetDir = join(dir, 'review-prepared'), packetPath = join(packetDir, 'prepared.json');
  const packet = JSON.parse(readFileSync(packetPath));
  assert.equal(packet.handoff_snapshot, selectedSnapshot);
  writeFileSync(packetPath, JSON.stringify({ ...packet, handoff_snapshot: handoffSnapshot(provenance('foreign text')) }));
  writeFileSync(join(packetDir, 'manifest.sha256'), execFileSync('sha256sum', ['prepared.json'], { cwd: packetDir }));
  assert.notEqual(runStep(verifyStep, verifyStep.run, { cwd: dir, env: preparedEnv }).status, 0,
    'Even a rehashed packet cannot substitute a foreign handoff snapshot');
  assert.equal(runStep(preparedStep, preparedStep.run, { cwd: dir, env: preparedEnv }).status, 0);
  const boundary = findStep(workflow, { name: 'Перепроверить тело перед моделью (#855)' });
  const boundaryEnv = { ...env, PATH: bin + ':' + process.env.PATH, FIXTURE: fixture, CALLS: calls,
    HANDOFF: handoff, NUM: '7', REPO: 'owner/repo', STAGE: 'code', TRACK: 'show',
    SHA: git('rev-parse', 'HEAD'), TREE: git('rev-parse', 'HEAD^{tree}'), DIGEST: issueBodyDigest(''),
    TOOLS_SHA: base, RUNNER_TEMP: dir, GITHUB_OUTPUT: output, HANDOFF_SNAPSHOT: selectedSnapshot };
  result = runStep(boundary, boundary.run, { cwd: dir, env: boundaryEnv });
  assert.equal(result.status, 0, result.stderr);
  result = runStep(boundary, boundary.run, { cwd: dir,
    env: { ...boundaryEnv, HANDOFF: handoff + ' edited', HANDOFF_UPDATED: '2026-10-15T11:00:00Z' } });
  assert.notEqual(result.status, 0, 'An edited handoff cannot reuse the prepare PASS at the model boundary');
  assert.match(result.stdout, /handoff.stale/);
  assert.match(readFileSync(calls, 'utf8'), /--add-label S6-in-progress --remove-label S7-code-review/);
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

function collected(pages) {
  const data = input({ infrastructure: true, files: ['scripts/change.mjs'] });
  return collectReviewInput(data, {
    api: endpoint => endpoint.endsWith('/comments') ? pages : { state: 'open', labels: ['S7-code-review', 'track:show'], body: data.body },
    git: args => {
      if (args[0] === 'rev-parse') return args[1] === 'HEAD' ? sha : tree;
      if (args[0] === 'merge-base') return 'c'.repeat(40);
      if (args[0] === 'rev-list') return sha;
      if (args[0] === 'show') return 'fix\n\nIssue: #7\nUser-Visible: no';
      if (args[0] === 'diff' || args[0] === 'diff-tree') return 'scripts/change.mjs';
      assert.fail('unexpected git command ' + args.join(' '));
    },
  });
}

test('#904 colon/heading collection and validation share one grammar, including incomplete newest candidates', () => {
  for (const [older, newer] of [[handoff, headingHandoff], [headingHandoff, handoff], ['', headingHandoff]]) {
    const data = collected([[comment(newer, 12, '2026-10-15T11:00:00Z')], ...(older ? [[comment(older)]] : [])]);
    assert.equal(data.handoff, newer);
    assert.equal(run(data).ok, true);
    assert.equal(run(data).identity.handoff.id, 12);
  }
  const data = collected([[comment(handoff), comment('## Сделано\nnew incomplete', 12, '2026-10-15T11:00:00Z')]]);
  const result = run(data);
  assert.equal(data.handoff, '## Сделано\nnew incomplete');
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(e => e.field === 'handoff.files'));
  assert.ok(!result.errors.some(e => e.field === 'handoff.done'));
  assert.match(preflightComment(result), /issuecomment-12/);
  assert.match(preflightComment(result), /handoff.files/);
  assert.equal(run(collected([])).ok, false);
});

test('#904 quotes, both code-fence styles and reviewer prose cannot introduce a candidate or satisfy its fields', () => {
  for (const body of [handoff.split('\n').map(line => '> ' + line).join('\n'),
    '```md\n' + handoff + '\n```', '~~~md\n' + headingHandoff + '\n~~~',
    'Вердикт: зелёный\n' + headingHandoff, 'Ordinary discussion: Сделано: is a field name']) {
    assert.equal(parseHandoff(body).candidate, false, body);
    const data = collected([[comment(handoff), comment(body, 99, '2026-10-15T12:00:00Z')]]);
    assert.equal(data.handoffProvenance.id, 11);
  }
  const incomplete = 'Сделано: new\n```md\n' + headingHandoff + '\n```\n> Гейты: fake';
  assert.deepEqual(parseHandoff(incomplete).fields, ['done']);
  assert.equal(run(collected([[comment(incomplete)]])).ok, false);
  const unclosed = '```md\n' + handoff;
  assert.equal(selectHandoff([[comment(unclosed)]]).provenance, null);
});

test('#904 unsorted pages, edits and stable ids determine the selected provenance without author authorization', () => {
  const recent = comment(headingHandoff, 20, '2026-10-15T11:00:00Z');
  const tie = { ...comment(handoff, 21, recent.updated_at), user: { login: 'independent-user' } };
  const edited = comment(handoff + ' edited old comment', 1, '2026-10-15T12:00:00Z');
  for (const pages of [[[recent], [tie]], [[tie], [recent]]])
    assert.equal(collected(pages).handoffProvenance.id, 21);
  const data = collected([[recent, edited], [tie]]), result = run(data);
  assert.equal(result.ok, true);
  assert.deepEqual(result.identity.handoff, { id: 1, url: edited.html_url, createdAt: stamp,
    updatedAt: edited.updated_at, digest: handoffDigest(edited.body) });
  for (const [field, value] of [['id', 2], ['url', recent.html_url], ['createdAt', recent.updated_at],
    ['updatedAt', stamp], ['digest', 'f'.repeat(64)]])
    assert.equal(preflightApplies(result, { ...result.identity, handoff: { ...result.identity.handoff, [field]: value } }), false, field);
  assert.equal(run({ ...data, handoff: data.handoff + ' changed after snapshot' }).ok, false);
  const expectedHandoff = handoffSnapshot(result.identity.handoff);
  assert.equal(handoffSnapshot(Object.fromEntries(Object.entries(result.identity.handoff).reverse())), expectedHandoff,
    'JSON key order does not change the canonical provenance identity');
  assert.equal(run({ ...data, expectedHandoff }).ok, true);
  const changed = collected([[{ ...edited, body: handoff + ' another edit' }]]);
  assert.ok(run({ ...changed, expectedHandoff }).errors.some(e => e.field === 'handoff.stale'));
  assert.equal(preflightApplies({ ...result, identity: { ...result.identity, handoff: null } },
    { ...result.identity, handoff: null }), false, 'code-stage PASS cannot omit provenance on both sides');
});

test('#904 missing or conflicting recognizable provenance never falls back to an older PASS', () => {
  const invalid = { ...comment(headingHandoff, 20, '2026-10-15T11:00:00Z'), updated_at: undefined };
  const missing = run(collected([[comment(handoff)], [invalid]]));
  assert.equal(missing.ok, false); assert.ok(missing.errors.some(e => e.field === 'handoff.provenance'));
  assert.equal(run(collected([[comment(handoff)], [comment(headingHandoff, 20, '2026-10-14T10:00:00Z')]])).ok, false);
  const duplicate = comment(handoff);
  assert.equal(run(collected([[duplicate], [duplicate]])).ok, true);
  assert.equal(run(collected([[duplicate], [{ ...duplicate, body: headingHandoff }]])).ok, false);
});
