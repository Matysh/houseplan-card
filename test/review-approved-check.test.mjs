import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildReviewCapabilities, REVIEW_MCP_NATIVE_TOOL_NAME } from '../scripts/review-capabilities.mjs';
import { runApprovedCheck, readCheckExecutionEntries, verifyCheckExecutionFiles, checkTraceProblems,
  reviewCheckEnvironment } from '../scripts/review-approved-check.mjs';

function fixture(t, extraFiles = {}) {
  const parent = realpathSync(tmpdir()), dir = mkdtempSync(join(parent, 'hp-approved-check-'));
  t.after(() => { assert.equal(dirname(realpathSync(dir)), parent); rmSync(dir, { recursive: true, maxRetries: 10, retryDelay: 50 }); });
  const root = join(dir, 'repo'); mkdirSync(root); mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'test/ok.test.mjs'), 'import test from "node:test"; import assert from "node:assert/strict"; test("ordinary", () => assert.equal(1 + 1, 2));\n');
  writeFileSync(join(root, 'test/failed.test.mjs'), 'process.exit(7);\n');
  writeFileSync(join(root, 'data.txt'), 'immutable fixture data\n');
  for (const [path, text] of Object.entries(extraFiles)) {
    mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text);
  }
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
    { cwd: root, env: reviewCheckEnvironment(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('add', '.'); git('commit', '-qm', 'ordinary fixture input');
  const policyPath = join(dir, 'policy.json'), checksJournal = policyPath + '.checks.jsonl';
  const policy = { schema: 2, root: realpathSync(root), sha: git('rev-parse', 'HEAD'), kind: 'task', stage: 'code',
    outputs: [join(dir, 'report.md')], files: git('ls-files').split('\n'), checksJournal };
  policy.capabilities = buildReviewCapabilities(policy);
  writeFileSync(policyPath, JSON.stringify(policy)); writeFileSync(checksJournal, '');
  return { policyPath, policy, root };
}

test('#1065 fixed real child execution produces independently bound receipt and complete output files', async t => {
  const f = fixture(t), checkId = 'unit:test/ok.test.mjs';
  const receipt = await runApprovedCheck({ policyPath: f.policyPath, checkId });
  assert.equal(receipt.status, 'passed'); assert.equal(receipt.executed, true); assert.equal(receipt.exitCode, 0);
  assert.match(readFileSync(receipt.steps[0].stdoutPath, 'utf8'), /# pass 1/);
  const rows = readCheckExecutionEntries(f.policy);
  const call = { id: 'native-check', name: REVIEW_MCP_NATIVE_TOOL_NAME, input: { check_id: checkId } };
  const result = { tool_use_id: call.id, content: [{ type: 'text', text: JSON.stringify(receipt) }] };
  assert.deepEqual(checkTraceProblems(call, result, rows, f.policy).problems, []);
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  assert.deepEqual(checkTraceProblems(call, { ...result, content: JSON.stringify(reordered) }, rows, f.policy).problems, []);
  assert.deepEqual(verifyCheckExecutionFiles(rows, f.policy, f.policyPath), []);
  assert.ok(checkTraceProblems({ ...call, input: { check_id: 'foreign' } }, result, rows, f.policy).problems.length);
  writeFileSync(receipt.steps[0].stdoutPath, 'altered ordinary output');
  assert.ok(verifyCheckExecutionFiles(rows, f.policy, f.policyPath).length);
});

test('#1065 a failed real check stays failed and an unknown opaque ID dispatches no process', async t => {
  const f = fixture(t);
  const failed = await runApprovedCheck({ policyPath: f.policyPath, checkId: 'unit:test/failed.test.mjs' });
  assert.equal(failed.status, 'failed'); assert.notEqual(failed.exitCode, 0);
  const unknown = await runApprovedCheck({ policyPath: f.policyPath, checkId: 'node --eval arbitrary; redirect > target' });
  assert.equal(unknown.status, 'unavailable'); assert.equal(unknown.executed, false); assert.deepEqual(unknown.steps, []);
  const fabricated = { ...failed, status: 'passed', exitCode: 0 };
  const call = { name: REVIEW_MCP_NATIVE_TOOL_NAME, input: { check_id: failed.checkId } };
  assert.ok(checkTraceProblems(call, { content: JSON.stringify(fabricated) }, [fabricated], f.policy).problems.length);
});

test('#1065 material drift and altered recipe fail before dispatch; already-cancelled check is not PASS', async t => {
  const f = fixture(t), signal = AbortSignal.abort();
  const cancelled = await runApprovedCheck({ policyPath: f.policyPath, checkId: 'unit:test/ok.test.mjs', signal });
  assert.equal(cancelled.status, 'cancelled'); assert.equal(cancelled.executed, false);
  writeFileSync(join(f.root, 'data.txt'), 'different input');
  await assert.rejects(runApprovedCheck({ policyPath: f.policyPath, checkId: 'unit:test/ok.test.mjs' }), /material changed/);
});

test('#1065 child environment removes tokens, Node/Git overrides and Actions output paths', () => {
  const env = reviewCheckEnvironment({ PATH: '/bin', GH_TOKEN: 'secret', GITHUB_TOKEN: 'secret', CLAUDE_CODE_OAUTH_TOKEN: 'secret',
    NODE_OPTIONS: '--import=foreign', GIT_DIR: '/foreign', GITHUB_OUTPUT: '/foreign', GIT_CONFIG_COUNT: '99' });
  for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'NODE_OPTIONS', 'GIT_DIR', 'GITHUB_OUTPUT', 'GIT_CONFIG_COUNT'])
    assert.equal(env[key], undefined);
  assert.ok(env.PATH.startsWith(dirname(process.execPath))); assert.ok(env.PATH.endsWith('/bin'));
  assert.equal(env.GIT_CONFIG_NOSYSTEM, '1');
});

test('#1065 first-step failure preserves its exit and never becomes a timeout or launches the next step', async t => {
  const f = fixture(t, { 'tsconfig.test.json': '{}', 'node_modules/typescript/bin/tsc': 'process.exit(7);\n',
    'scripts/fix-test-build.mjs': 'import { writeFileSync } from "node:fs"; writeFileSync("unexpected-next-step", "bad");\n' });
  const receipt = await runApprovedCheck({ policyPath: f.policyPath, checkId: 'build:test' });
  assert.equal(receipt.status, 'failed'); assert.equal(receipt.exitCode, 7); assert.equal(receipt.steps.length, 1);
  assert.equal(receipt.steps[0].timedOut, false);
  assert.throws(() => readFileSync(join(f.root, 'unexpected-next-step')));
});

test('#1065 ordinary fixed npm build remains executable with the scrubbed child environment', async t => {
  const f = fixture(t, { 'package.json': JSON.stringify({ name: 'ordinary-check-fixture', version: '1.0.0', scripts: { build: 'node build.cjs' } }),
    'build.cjs': 'console.log("ordinary fixture build complete");\n' });
  const receipt = await runApprovedCheck({ policyPath: f.policyPath, checkId: 'build:build' });
  assert.equal(receipt.status, 'passed'); assert.equal(receipt.exitCode, 0);
  assert.match(readFileSync(receipt.steps[0].stdoutPath, 'utf8'), /ordinary fixture build complete/);
});
