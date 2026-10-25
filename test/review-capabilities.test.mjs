import test from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildReviewCapabilities, capabilityDigest, readReviewCapabilities,
  reviewCheckToolDefinition, reviewChecksMarkdown, NATIVE_REVIEW_TOOLS } from '../scripts/review-capabilities.mjs';

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
