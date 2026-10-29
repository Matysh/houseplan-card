import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildReviewCapabilities, capabilityDigest, readReviewCapabilities,
  reviewCheckToolDefinition, reviewChecksMarkdown, resolveReviewDiffBasis, NATIVE_REVIEW_TOOLS } from '../scripts/review-capabilities.mjs';

const policy = stage => ({ schema: 2, root: realpathSync(fileURLToPath(new URL('..', import.meta.url))),
  sha: 'a'.repeat(40), base: 'b'.repeat(40), stage, kind: 'task',
  files: ['test/example.test.mjs', 'demo/smoke_example.mjs', 'scripts/ci-profiles.mjs', 'package.json'],
  changedFiles: ['test/example.test.mjs'] });
const ready = stage => { const p = policy(stage); p.capabilities = buildReviewCapabilities(p); return p; };

test('#1065 one capability manifest advertises only native readers/report and fixed checks', () => {
  const p = ready('code'), m = readReviewCapabilities(p);
  assert.deepEqual(m.nativeTools, NATIVE_REVIEW_TOOLS);
  for (const name of ['Bash', 'PowerShell', 'Edit', 'Agent', 'mcp__github__issue_write']) assert.ok(!m.nativeTools.includes(name));
  const unit = m.checks.find(c => c.id === 'unit:test/example.test.mjs');
  assert.deepEqual(unit.steps, [{ bin: realpathSync(process.execPath), args: ['--test', 'test/example.test.mjs'] }]);
  assert.equal(m.checks.find(c => c.id === 'smoke:demo/smoke_example.mjs').timeoutMs, 180000);
  assert.deepEqual(m.checks.find(c => c.id === 'build:bundle:sync').steps,
    [{ bin: realpathSync(process.execPath), args: [m.runtime.npm, 'run', 'bundle:sync'] }]);
  assert.equal(reviewCheckToolDefinition(m).inputSchema.additionalProperties, false);
  assert.deepEqual(reviewCheckToolDefinition(m).inputSchema.required, ['check_id']);
  assert.match(reviewChecksMarkdown(m), /unit:test\/example\.test\.mjs/);
});

test('#1065 spec retains ordinary pure checks without build/browser/backend execution', () => {
  const m = ready('spec').capabilities;
  assert.ok(m.checks.some(c => c.kind === 'node-unit'));
  assert.ok(m.checks.every(c => !['build', 'smoke', 'pytest'].includes(c.kind)));
});

test('#1065 even a recomputed manifest checksum cannot inject an executable, argv or capability', () => {
  for (const change of [
    p => { p.capabilities.checks[0].steps[0].bin = 'bash'; },
    p => { p.capabilities.checks[0].steps[0].args.push('--eval=forbidden'); },
    p => { p.capabilities.runtime.npm = '/tmp/foreign.mjs'; },
    p => { p.capabilities.nativeTools.push('Bash'); },
    p => { p.capabilities.materialSha = 'c'.repeat(40); },
    p => { p.capabilities.checks.pop(); },
  ]) {
    const p = ready('code'); change(p);
    const { digest, ...payload } = p.capabilities; p.capabilities.digest = capabilityDigest(payload);
    assert.throws(() => readReviewCapabilities(p));
  }
  const p = ready('code'); delete p.capabilities;
  assert.throws(() => readReviewCapabilities(p));
});

test('#1065 shell-looking check IDs never become recipe arguments and unsafe paths refuse', () => {
  const p = ready('code');
  assert.ok(!p.capabilities.checks.some(c => c.id === 'node -e execute'));
  for (const file of ['../outside.test.mjs', '/tmp/outside.test.mjs', 'test/../outside.test.mjs', 'test/x\n.test.mjs'])
    assert.throws(() => buildReviewCapabilities({ ...p, files: [file] }));
});

test('#1065 available runtime cannot silently disappear from a rehashed capability manifest', () => {
  const p = ready('code');
  assert.ok(p.capabilities.runtime.npm, 'the pinned Node distribution supplies npm');
  p.capabilities.runtime.npm = null;
  p.capabilities.checks = p.capabilities.checks.filter(c => !['build:build', 'build:typecheck'].includes(c.id));
  const { digest, ...payload } = p.capabilities; p.capabilities.digest = capabilityDigest(payload);
  assert.throws(() => readReviewCapabilities(p), /runtime changed/);
});

test('#1122 incoming reference documents are not authored deletions; real task deletions remain visible', t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-1122-diff-'));
  t.after(() => rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
  const root = realpathSync(dir);
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))),
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (...args) => execFileSync('git', ['-c', 'maintenance.auto=false', '-c', 'gc.auto=0', ...args],
    { cwd: root, env, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  writeFileSync(join(root, 'INDEX.md'), 'old index\n');
  writeFileSync(join(root, 'removed.md'), 'base document\n');
  git('add', '.'); git('commit', '-qm', 'common ancestor');
  const ancestor = git('rev-parse', 'HEAD');
  git('rm', 'removed.md');
  writeFileSync(join(root, 'task.md'), 'task change\n');
  git('add', '.'); git('commit', '-qm', 'own task');
  const materialSha = git('rev-parse', 'HEAD');
  git('checkout', '-q', '--detach', ancestor);
  writeFileSync(join(root, 'incoming.md'), 'accepted upstream review\n');
  writeFileSync(join(root, 'INDEX.md'), 'new index\n');
  git('add', '.'); git('commit', '-qm', 'incoming C document');
  const referenceSha = git('rev-parse', 'HEAD');
  git('checkout', '-q', '--detach', materialSha);
  const diffBasis = resolveReviewDiffBasis({ kind: 'task', materialSha, referenceSha,
    mergeBases: git('merge-base', '--all', referenceSha, materialSha).split('\n') });
  assert.equal(diffBasis.baseSha, ancestor);
  const p = { schema: 2, root, sha: materialSha, base: diffBasis.baseSha, kind: 'task', stage: 'code', diffBasis,
    files: git('ls-files').split('\n'), changedFiles: git('diff', '--name-only', diffBasis.baseSha, materialSha).split('\n') };
  p.capabilities = buildReviewCapabilities(p);
  const manifest = readReviewCapabilities(p);
  const read = id => { const step = manifest.checks.find(c => c.id === id)?.steps[0];
    assert.ok(step, id); return git(...step.args); };
  const taskDiff = read('read:diff');
  assert.match(taskDiff, /deleted file mode[\s\S]*base document/);
  assert.match(taskDiff, /task change/);
  assert.doesNotMatch(taskDiff, /incoming\.md|INDEX\.md/);
  assert.equal(read('read:base:removed.md'), 'base document');
  assert.match(read('read:incoming-diff'), /new file mode[\s\S]*accepted upstream review/);
  assert.match(read('read:reference-diff'), /deleted file mode[\s\S]*accepted upstream review/);
  assert.match(manifest.checks.find(c => c.id === 'read:reference-diff').description, /not.*authored deletion/i);
  assert.equal(read('read:log').split('\n').length, 1);
  const markdown = reviewChecksMarkdown(manifest);
  for (const s of [ancestor, materialSha, referenceSha]) assert.ok(markdown.includes(s));
  assert.match(markdown, /common ancestor/i);
  for (const stage of ['spec', 'code']) {
    const fresh = { ...p, stage, base: ancestor, sha: ancestor, changedFiles: [],
      diffBasis: resolveReviewDiffBasis({ kind: 'task', materialSha: ancestor, referenceSha: ancestor, mergeBases: [ancestor] }) };
    assert.equal(buildReviewCapabilities(fresh).diffBasis.baseSha, ancestor);
  }
});

test('#1122 ambiguous or invalid task bases fail closed; ship and release retain direct ranges', () => {
  const materialSha = 'a'.repeat(40), referenceSha = 'b'.repeat(40), baseSha = 'c'.repeat(40);
  for (const mergeBases of [[], [baseSha, referenceSha], ['bad'], undefined])
    assert.throws(() => resolveReviewDiffBasis({ kind: 'task', materialSha, referenceSha, mergeBases }));
  for (const kind of ['ship', 'release']) {
    const diffBasis = resolveReviewDiffBasis({ kind, materialSha, referenceSha });
    assert.equal(diffBasis.baseSha, referenceSha);
    assert.equal(diffBasis.comparison, 'direct-tree');
    const p = { ...policy(kind), kind, stage: kind, diffBasis };
    const m = buildReviewCapabilities(p);
    assert.deepEqual(m.checks.find(c => c.id === 'read:diff').steps[0].args.slice(-2), [referenceSha, materialSha]);
    assert.ok(!m.checks.some(c => c.id === 'read:incoming-diff'));
  }
  assert.throws(() => resolveReviewDiffBasis({ kind: 'unknown', materialSha, referenceSha }));
  assert.throws(() => resolveReviewDiffBasis({ kind: 'ship', materialSha: 'HEAD', referenceSha }));
  const diffBasis = resolveReviewDiffBasis({ kind: 'task', materialSha, referenceSha, mergeBases: [baseSha] });
  const p = { ...policy('code'), base: baseSha, diffBasis };
  p.capabilities = buildReviewCapabilities(p);
  for (const change of [
    q => { q.base = referenceSha; },
    q => { q.diffBasis.referenceSha = 'HEAD'; },
    q => { q.capabilities.diffBasis.referenceSha = materialSha; },
    q => { delete q.capabilities.diffBasis; },
    q => { q.changedFiles = ['../outside.md']; },
  ]) {
    const q = structuredClone(p); change(q);
    const { digest, ...payload } = q.capabilities; q.capabilities.digest = capabilityDigest(payload);
    assert.throws(() => readReviewCapabilities(q));
  }
});
