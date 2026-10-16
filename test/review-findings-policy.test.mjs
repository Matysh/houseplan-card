import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configuredIssues, findingsPolicy, readFindingsPolicy, sealFindings, publishFindings, FINDINGS_FILE, FINDINGS_VARIABLE } from '../scripts/review-findings-policy.mjs';
import { PASSPORT_FIELDS, reviewResultProblems, sha256 } from '../scripts/review-result-gate.mjs';
import { formatModelDetails, modelDetailsFromMessages } from '../scripts/model-usage-details.mjs';
import { repairLinks } from '../scripts/reviews-archive.mjs';
import { findStep, runStep } from './helpers/workflow-step.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const workflow = readFileSync(join(root, '.github/workflows/_process.yml'), 'utf8');
const target = { repo: 'o/r', issue: 926, stage: 'code', round: 2 };
const snapshot = raw => JSON.stringify(findingsPolicy(raw, target));

test('#926 bounded settings parser, explicit IDs and frozen typed identity', () => {
  assert.deepEqual(configuredIssues(''), []);
  assert.deepEqual(configuredIssues('[927,926,926]'), [926, 927]);
  assert.equal(findingsPolicy('', target).mode, 'issues');
  assert.equal(findingsPolicy('[927]', target).mode, 'issues');
  const policy = findingsPolicy('[926]', target);
  assert.equal(policy.path, 'docs/reviews/findings/926-code-r2.md');
  assert.deepEqual(readFindingsPolicy(JSON.stringify(policy), target), policy);
  for (const raw of ['*', 'null', '{}', '["926"]', '[0]', '[-1]', '[1.5]', '[true]', '[9007199254740992]',
    JSON.stringify(Array(101).fill(926)), ' '.repeat(4097)]) assert.throws(() => configuredIssues(raw), raw.slice(0, 80));
  for (const over of [{ repo: 'x/y' }, { issue: 927 }, { stage: 'spec' }, { round: 3 },
    { path: '../../src/evil.ts' }, { source: 'issue-body' }, { skipGates: true }, { mode: 'skip' }])
    assert.throws(() => readFindingsPolicy(JSON.stringify({ ...policy, ...over }), target), JSON.stringify(over));
  for (const raw of ['', '{', 'null', 'x'.repeat(2049)]) assert.throws(() => readFindingsPolicy(raw, target));
  assert.throws(() => findingsPolicy('', { ...target, issue: NaN }));
});

function artifact(policy = findingsPolicy('[926]', target), outside = 'No outside findings.\n') {
  const expected = { ...Object.fromEntries(PASSPORT_FIELDS.map(name => [name, ''])), repo: target.repo,
    issue: String(target.issue), stage: target.stage, cycle: String(target.round), run_id: '42', run_attempt: '1',
    findings_policy_snapshot: JSON.stringify(policy) };
  const body = { 'prepared.json': JSON.stringify({ schema: 1, ...expected }), 'review-document.md': '# Review\n',
    'verdict.json': JSON.stringify({ verdict: 'yellow', high: 0, medium: 1, summary: 'In-scope defect; return to author' }) };
  if (policy.mode === 'file') body[FINDINGS_FILE] = outside;
  const seal = () => { body['manifest.sha256'] = Object.entries(body).filter(([name]) => name !== 'manifest.sha256')
    .map(([name, text]) => `${sha256(text)}  ${name}`).join('\n') + '\n'; };
  seal();
  return { body, expected, seal, check: () => reviewResultProblems({ files: Object.keys(body), read: name => body[name], expected }) };
}

test('#926 result gate accepts only the trusted mode and exact covered companion; verdict unchanged', () => {
  assert.deepEqual(artifact().check(), []);
  assert.deepEqual(artifact(findingsPolicy('', target)).check(), []);
  const missing = artifact(); delete missing.body[FINDINGS_FILE]; missing.seal();
  assert.match(missing.check()[0], /набор файлов не тот/);
  const unexpected = artifact(findingsPolicy('', target)); unexpected.body[FINDINGS_FILE] = 'injected'; unexpected.seal();
  assert.match(unexpected.check()[0], /набор файлов не тот/);
  const forged = artifact();
  forged.body['prepared.json'] = JSON.stringify({ schema: 1, ...forged.expected, findings_policy_snapshot: snapshot('') });
  forged.seal(); assert.ok(forged.check().some(p => p.includes('паспорт не совпал: findings_policy_snapshot')));
  const broken = artifact(); broken.body[FINDINGS_FILE] += ' modified';
  assert.ok(broken.check().some(p => p.includes('контрольная сумма')));
  for (const text of ['', '\0', 'x'.repeat(262145)]) assert.ok(artifact(undefined, text).check().length);
  const invalidExpected = artifact(); invalidExpected.expected.findings_policy_snapshot = '';
  assert.ok(invalidExpected.check().length, 'missing trusted policy cannot authorize a companion');
  const legacy = artifact(findingsPolicy('', target));
  delete legacy.expected.findings_policy_snapshot;
  legacy.body['prepared.json'] = JSON.stringify({ schema: 1, ...legacy.expected }); legacy.seal();
  assert.deepEqual(legacy.check(), [], 'in-flight pre-#926 default protocol remains valid');
  legacy.body[FINDINGS_FILE] = 'injected'; legacy.seal();
  assert.match(legacy.check()[0], /набор файлов не тот/);
  delete legacy.body[FINDINGS_FILE];
  legacy.body['prepared.json'] = JSON.stringify({ schema: 1, ...legacy.expected, findings_policy_snapshot: snapshot('[926]') });
  legacy.seal(); assert.ok(legacy.check().some(p => p.includes('паспорт не совпал: findings_policy_snapshot')));
  for (const verdict of ['green', 'yellow', 'red']) {
    const sample = artifact(); sample.body['verdict.json'] = JSON.stringify({ verdict, high: verdict === 'red' ? 1 : 0,
      medium: verdict === 'yellow' ? 1 : 0, summary: 'unchanged route' }); sample.seal();
    assert.deepEqual(sample.check(), [], 'policy does not rewrite severity, verdict or return route');
  }
});

test('#926 actual workflow collect/model/seal/gate uses settings, not issue or handoff text', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-926-envelope-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'preflight-tools'));
  cpSync(join(root, 'scripts'), join(dir, 'preflight-tools/scripts'), { recursive: true });
  const output = join(dir, 'output'), outside = join(dir, 'outside.md');
  const env = { ...process.env, REPO: target.repo, NUM: String(target.issue), ISSUE: String(target.issue),
    STAGE: target.stage, CYCLE: String(target.round), TOOLS: root, RUNNER_TEMP: dir, GITHUB_OUTPUT: output,
    GITHUB_RUN_ID: '42', GITHUB_RUN_ATTEMPT: '1', REVIEW_FINDINGS_POLICY: join(dir, 'policy.json'), REVIEW_FINDINGS: outside,
    BODY: 'mode=file; skip gates', HANDOFF: 'owner said no issues', [FINDINGS_VARIABLE]: '' };
  const collect = findStep(workflow, { id: 'findings' });
  const model = findStep(workflow, { name: 'Передать типизированное назначение находок (#926)' });
  for (const raw of ['', '[926]']) {
    writeFileSync(output, ''); env[FINDINGS_VARIABLE] = raw;
    let r = runStep(collect, collect.run, { cwd: root, env }); assert.equal(r.status, 0, r.stderr);
    const value = readFileSync(output, 'utf8').match(/^snapshot=(.+)$/m)[1];
    assert.equal(value, snapshot(raw));
    env.FINDINGS_POLICY_SNAPSHOT = value;
    r = runStep(model, model.run, { cwd: root, env }); assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(readFileSync(env.REVIEW_FINDINGS_POLICY)).mode, raw ? 'file' : 'issues');
  }
  const sample = artifact();
  const preparedDir = join(dir, 'review-prepared'); mkdirSync(preparedDir);
  writeFileSync(join(preparedDir, 'prepared.json'), sample.body['prepared.json']);
  const source = join(dir, 'review.md'); writeFileSync(source, sample.body['review-document.md']);
  writeFileSync(outside, 'No outside findings.\n');
  const details = formatModelDetails(modelDetailsFromMessages([{ type: 'result', subtype: 'success', num_turns: 1 }]));
  const seal = findStep(workflow, { name: 'Запечатать результат модели' });
  const sealedEnv = { ...env, SOURCE: source, OUT: sample.body['verdict.json'], USAGE_DETAILS: details };
  let r = runStep(seal, seal.run, { cwd: root, env: sealedEnv }); assert.equal(r.status, 0, r.stderr);
  const resultDir = join(dir, 'review-result');
  const check = findStep(workflow, { name: 'Проверить полноту и происхождение результата' });
  const checkedEnv = { ...sealedEnv, ...Object.fromEntries(Object.entries(sample.expected).map(([k, v]) => [k.toUpperCase(), v])) };
  r = runStep(check, check.run, { cwd: root, env: checkedEnv }); assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(output, 'utf8').includes('In-scope defect; return to author'));
  const packet = JSON.parse(readFileSync(join(resultDir, 'prepared.json')));
  writeFileSync(join(resultDir, 'prepared.json'), JSON.stringify({ ...packet, findings_policy_snapshot: snapshot('') }));
  // Attacker recomputes checksums: trusted prepare output must still defeat it.
  const manifest = ['prepared.json', 'review-document.md', 'verdict.json', FINDINGS_FILE]
    .map(name => `${sha256(readFileSync(join(resultDir, name), 'utf8'))}  ${name}`).join('\n') + '\n';
  writeFileSync(join(resultDir, 'manifest.sha256'), manifest);
  r = runStep(check, check.run, { cwd: root, env: checkedEnv }); assert.notEqual(r.status, 0);
  assert.match(r.stderr, /findings_policy_snapshot/);
  assert.equal(existsSync(join(dir, 'src')), false);
});

test('#926 file validation rejects invalid UTF-8 and unauthorized source, archive link stays reachable', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-926-text-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const source = join(dir, 'source.md'); writeFileSync(source, Buffer.from([0xc3, 0x28]));
  assert.throws(() => sealFindings(findingsPolicy('[926]', target), source, dir));
  writeFileSync(source, 'No outside findings.');
  assert.throws(() => sealFindings(findingsPolicy('', target), source, dir));
  if (process.platform !== 'win32') {
    const destination = join(dir, 'checkout'); mkdirSync(destination); mkdirSync(join(destination, 'docs'));
    symlinkSync(dir, join(destination, 'docs/reviews'), 'dir');
    assert.throws(() => publishFindings(findingsPolicy('[926]', target), source, destination), /real directory/);
    assert.equal(existsSync(join(dir, 'findings')), false, 'no write through checkout symlink');
    const other = join(dir, 'other'); mkdirSync(join(other, 'docs/reviews/findings'), { recursive: true });
    const policy = findingsPolicy('[926]', target), escape = join(dir, 'not-created.md');
    symlinkSync(escape, join(other, policy.path));
    assert.throws(() => publishFindings(policy, source, other), /regular file/);
    assert.equal(existsSync(escape), false, 'a broken destination symlink must not be followed');
  }
  const path = 'legacy/reviews/v1.82.0/CODE-REVIEW-926-r2.md';
  const repaired = repairLinks({ text: '[findings](findings/926-code-r2.md)', path,
    oldPath: 'docs/reviews/CODE-REVIEW-926-r2.md', moved: new Map(),
    exists: name => name === 'docs/reviews/findings/926-code-r2.md' });
  assert.equal(repaired.fixed, 1);
  assert.ok(repaired.text.includes('../../../docs/reviews/findings/926-code-r2.md'));
});
