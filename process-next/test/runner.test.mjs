import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { runPlan, validatePlan, executeStep } from '../lib/runner.mjs';
import { defaultStateDir, inputIdentity, outputIdentity, within } from '../lib/storage.mjs';

function fixture(t) { const root = mkdtempSync(join(tmpdir(), 'hp-next-runner-')); t.after(() => rmSync(root, { recursive: true, force: true })); writeFileSync(join(root, 'source'), 'one'); return root; }
const step = (id, extra = {}) => ({ id, name: id, command: ['node', '-e', 'console.log("ok")'], inputs: ['source'], ...extra });
const plan = steps => ({ name: 'Тесты для задачи #1105 (перед ревью)', event: 'task', steps });
const pass = async () => ({ status: 'passed', counts: { tests: 1, passed: 1 }, durationMs: 1 });

test('runs a real child, persists its log/result and reuses successful unchanged inputs', async t => {
  const root = fixture(t), p = plan([step('behavior')]);
  const a = await runPlan(p, { root }); assert.equal(a.status, 'passed'); assert.match(readFileSync(a.results[0].logPath, 'utf8'), /ok/);
  const b = await runPlan(p, { root }); assert.equal(b.results[0].status, 'reused'); assert.equal(b.results[0].sourceRun, a.id);
  writeFileSync(join(root, 'source'), 'two');
  const c = await runPlan(p, { root }); assert.equal(c.results[0].status, 'passed');
});

test('beta to stable version-only promotion rebuilds artifacts but reuses behavior; dependency/code changes rerun it', async t => {
  const root = fixture(t); mkdirSync(join(root, 'src'));
  const version = value => {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: value, dependencies: { example: '1.0.0' } }));
    writeFileSync(join(root, 'package-lock.json'), JSON.stringify({ version: value, packages: { '': { version: value }, 'node_modules/example': { version: '1.0.0' } } }));
    writeFileSync(join(root, 'src/houseplan-card.ts'), `const CARD_VERSION = '${value}';\nexport const behavior = 1;`);
  };
  version('1.84.0-beta.1');
  const inputs = ['package.json', 'package-lock.json', 'src/**'];
  const p = plan([step('build', { inputs, outputs: ['built'] }), step('behavior', { inputs, requires: ['build'], preparationOnlyRequires: ['build'], reuseReleaseVersion: true })]);
  const execute = async s => { if (s.id === 'build') writeFileSync(join(root, 'built'), readFileSync(join(root, 'package.json'))); return pass(); };
  await runPlan(p, { root, execute }); version('1.84.0');
  const promoted = await runPlan(p, { root, execute });
  assert.deepEqual(promoted.results.map(r => r.status), ['passed', 'reused']);
  writeFileSync(join(root, 'src/houseplan-card.ts'), "const CARD_VERSION = '1.84.0';\nexport const behavior = 2;");
  assert.equal((await runPlan(p, { root, execute })).results[1].status, 'passed');
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'))); lock.packages['node_modules/example'].version = '2.0.0';
  writeFileSync(join(root, 'package-lock.json'), JSON.stringify(lock));
  assert.equal((await runPlan(p, { root, execute })).results[1].status, 'passed');
});

test('beta and stable worktrees share successful reports by default without sharing build artifacts or rewriting the beta', async t => {
  const directory = fixture(t), beta = join(directory, 'beta'), stable = join(directory, 'stable'); mkdirSync(beta);
  const git = args => execFileSync('git', args, { cwd: beta, encoding: 'utf8', stdio: 'pipe', windowsHide: true }).trim();
  git(['init', '-q']); git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
  git(['config', 'core.hooksPath', join(directory, 'no-hooks')]);
  writeFileSync(join(beta, 'source'), 'same behavior'); writeFileSync(join(beta, 'package.json'), '{"version":"1.84.0-beta.1"}');
  git(['add', '.']); git(['commit', '-qm', 'beta']);
  git(['worktree', 'add', '-b', 'stable', stable, 'HEAD']);
  writeFileSync(join(stable, 'package.json'), '{"version":"1.84.0"}');
  git(['-C', stable, 'add', 'package.json']); git(['-C', stable, 'commit', '-qm', 'stable version']);
  const reports = ['artifacts/process-next/backend-coverage.xml', 'artifacts/process-next/golden-beta/golden-report.json'];
  const p = plan([step('build', { inputs: ['source', 'package.json'], outputs: ['built'] }),
    ...reports.map((name, index) => step(`report-${index}`, { inputs: ['source', 'package.json'], outputs: [name], reusableReports: [name], reuseReleaseVersion: true }))]);
  const execute = async (s, { cwd }) => {
    const output = s.outputs[0]; mkdirSync(dirname(join(cwd, output)), { recursive: true });
    writeFileSync(join(cwd, output), s.id === 'build' ? readFileSync(join(cwd, 'package.json')) : `original ${s.id} evidence`);
    return pass();
  };
  const first = await runPlan(p, { root: beta, execute });
  assert.equal(defaultStateDir(stable), defaultStateDir(beta));
  assert.ok(first.reportPath.startsWith(defaultStateDir(beta)));
  const calls = [], second = await runPlan(p, { root: stable, execute: async (...args) => { calls.push(args[0].id); return execute(...args); } });
  assert.deepEqual(second.results.map(r => r.status), ['passed', 'reused', 'reused']);
  assert.equal(second.materialClean, true);
  assert.deepEqual(calls, ['build']);
  for (const name of reports) assert.deepEqual(readFileSync(join(stable, name)), readFileSync(join(beta, name)));
  assert.equal(readFileSync(join(beta, 'built'), 'utf8'), '{"version":"1.84.0-beta.1"}');
  assert.equal(readFileSync(join(stable, 'built'), 'utf8'), '{"version":"1.84.0"}');
  writeFileSync(join(stable, 'source'), 'changed behavior'); calls.length = 0;
  const changed = await runPlan(p, { root: stable, execute: async (...args) => { calls.push(args[0].id); return execute(...args); } });
  assert.ok(changed.results.every(result => result.status === 'passed'));
  assert.equal(calls.length, 3);
  assert.equal(readFileSync(join(beta, 'source'), 'utf8'), 'same behavior');
});

test('damaged cached report bytes rerun only that check; restoration cannot escape a symlinked output parent', async t => {
  const root = fixture(t), name = 'artifacts/process-next/backend-coverage.xml';
  const p = plan([step('coverage', { outputs: [name], reusableReports: [name] })]);
  let calls = 0;
  const execute = async () => { calls++; mkdirSync(dirname(join(root, name)), { recursive: true }); writeFileSync(join(root, name), '<coverage line-rate="1"/>'); return pass(); };
  const first = await runPlan(p, { root, execute });
  const cachePath = join(defaultStateDir(root), 'cache', `${first.results[0].fingerprint}.json`);
  const cached = JSON.parse(readFileSync(cachePath)); cached.reportArtifacts[name].data = Buffer.from('corrupted').toString('base64');
  writeFileSync(cachePath, JSON.stringify(cached)); rmSync(join(root, name));
  const second = await runPlan(p, { root, execute }); assert.equal(second.results[0].status, 'passed'); assert.equal(calls, 2);
  const outside = join(root, 'separate'); mkdirSync(outside);
  const linked = join(root, 'linked'); symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
  assert.doesNotThrow(() => within(root, 'linked/inside.xml'));
  const escape = join(root, 'escape'); symlinkSync(dirname(root), escape, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => within(root, 'escape/absent-report.xml'), /Symlink leaves root/);
  assert.equal(existsSync(join(dirname(root), 'absent-report.xml')), false);
  for (const unsafe of ['../outside.json', 'dist/report.json', 'artifacts/process-next/../../source.json']) {
    assert.throws(() => validatePlan(plan([step('unsafe', { outputs: [unsafe], reusableReports: [unsafe] })])), /Only named report/);
  }
});

test('release receipts distinguish committed material from dirty source, independently of test success', async t => {
  const root = fixture(t), git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  git(['init']); git(['config','user.name','Fixture']); git(['config','user.email','fixture@example.invalid']);
  git(['add','source']); git(['commit','-m','fixture']);
  const p = { ...plan([step('behavior')]), event: 'beta' };
  const clean = await runPlan(p, { root, execute: pass }); assert.equal(clean.materialClean, true); assert.match(clean.materialSha, /^[a-f0-9]{40}$/);
  writeFileSync(join(root,'source'),'uncommitted');
  const dirty = await runPlan(p, { root, execute: pass }); assert.equal(dirty.materialClean, false); assert.equal(dirty.status,'passed');
  mkdirSync(join(root, 'src')); writeFileSync(join(root, 'src/deleted.mjs'), 'tracked'); git(['add','src']); git(['commit','-m','tracked source']);
  rmSync(join(root, 'src/deleted.mjs'));
  const removed = await runPlan(plan([step('glob', { inputs: ['src/**'] })]), { root, execute: pass });
  assert.equal(removed.materialClean, false, 'deleted tracked source is still a material change');
});
test('command, explicit environment and generated outputs invalidate reuse', async t => {
  const root = fixture(t), calls = [];
  const execute = async s => { calls.push(s.id); writeFileSync(join(root, 'built'), 'compiled'); return pass(); };
  const p = plan([step('build', { outputs: ['built'] })]);
  await runPlan(p, { root, execute }); await runPlan(p, { root, execute }); assert.equal(calls.length, 1);
  writeFileSync(join(root, 'built'), 'wrong'); await runPlan(p, { root, execute }); assert.equal(calls.length, 2);
  p.steps[0].env = { FEATURE: 'new' }; await runPlan(p, { root, execute }); assert.equal(calls.length, 3);
  p.steps[0].command.push('changed'); await runPlan(p, { root, execute }); assert.equal(calls.length, 4);
});
test('preparation dependency identity is part of downstream evidence', async t => {
  const root = fixture(t), p = plan([step('build'), step('consumer', { inputs: [], requires: ['build'] })]);
  await runPlan(p, { root, execute: pass });
  writeFileSync(join(root, 'source'), 'changed preparation');
  const calls = [], r = await runPlan(p, { root, execute: async s => { calls.push(s.id); return pass(); } });
  assert.deepEqual(calls, ['build', 'consumer']); assert.equal(r.status, 'passed');
});
test('failure continues independent work, blocks only descendants and never caches a failure', async t => {
  const root = fixture(t), p = plan([step('grandchild', { requires: ['child'] }), step('child', { requires: ['bad'] }), step('bad'), step('independent')]);
  const r = await runPlan(p, { root, jobs: 1, execute: async s => ({ status: s.id === 'bad' ? 'failed' : 'passed' }) });
  assert.deepEqual(r.results.map(r => r.status), ['blocked', 'blocked', 'failed', 'passed']); assert.equal(r.status, 'failed');
  const second = await runPlan(p, { root, execute: pass }); assert.equal(second.results[2].status, 'passed'); assert.equal(second.results[3].status, 'reused');
});
test('source edits during a set invalidate receipts even when child returned zero', async t => {
  const root = fixture(t), p = plan([step('changed')]);
  const r = await runPlan(p, { root, execute: async () => { writeFileSync(join(root, 'source'), 'mutated'); return pass(); } });
  assert.equal(r.status, 'invalidated'); assert.equal(r.results[0].status, 'invalidated');
  assert.equal((await runPlan(p, { root, execute: pass })).results[0].status, 'passed');
});
test('docs have no spawn and missing diagnostic converter cannot hide a required failure', async t => {
  const root = fixture(t), no = () => { throw Error('unexpected spawn'); };
  assert.equal((await runPlan(plan([]), { root, execute: no })).status, 'not-required');
  const converter = step('converter', { command: null, unavailable: '#1179', diagnostic: true });
  const r = await runPlan(plan([converter, step('product')]), { root, execute: pass });
  assert.equal(r.status, 'passed'); assert.equal(r.results[0].status, 'unavailable');
  assert.equal((await runPlan(plan([converter, step('product')]), { root, reuse: false, execute: async () => ({ status: 'failed' }) })).status, 'failed');
});
test('timeout kills the actual process and cancellation never becomes passed', async t => {
  const root = fixture(t), r = await executeStep(step('slow', { command: ['node', '-e', 'setInterval(()=>{},1000)'], timeoutMs: 80 }), { cwd: root, logPath: join(root, 'slow.log') });
  assert.equal(r.status, 'timed-out');
  const controller = new AbortController(); controller.abort();
  const cancel = await runPlan(plan([step('a')]), { root, signal: controller.signal, execute: () => { throw Error('must not start'); } });
  assert.equal(cancel.results[0].status, 'cancelled'); assert.equal(cancel.status, 'failed');
});
test('exit zero with failed TAP or an empty required selection is a failure', async t => {
  const root = fixture(t);
  for (const [id, text] of [['bad', '# tests 1\n# fail 1'], ['empty', '# tests 0\n# fail 0']]) {
    const s = step(id, { command: ['node', '-e', `console.log(${JSON.stringify(text)})`], expectedNonempty: true });
    const r = await executeStep(s, { cwd: root, logPath: join(root, id + '.log') }); assert.equal(r.status, 'failed');
  }
});
test('glob inputs notice new files; each output pattern must exist; paths stay within root', t => {
  const root = fixture(t), before = inputIdentity(root, ['*.txt']).hash;
  writeFileSync(join(root, 'one.txt'), 'one'); assert.notEqual(inputIdentity(root, ['*.txt']).hash, before);
  assert.equal(outputIdentity(root, ['*.txt', '*.missing']).complete, false);
  mkdirSync(join(root, 'empty')); assert.equal(outputIdentity(root, ['empty']).complete, false);
  assert.throws(() => within(root, '../escape'));
});
test('invalid command, unknown dependency, cycle and duplicate fail before executing', () => {
  for (const steps of [[step('x'), step('x')], [step('x', { command: 'shell' })], [step('x', { requires: ['absent'] })], [step('x', { requires: ['y'] }), step('y', { requires: ['x'] })]]) assert.throws(() => validatePlan(plan(steps)));
});
test('ordered independent suites continue after failure; empty remainder is explicit N/A', async t => {
  const root = fixture(t), events = [];
  const r = await runPlan(plan([step('first'), step('second', { after: ['first'] })]), { root, execute: async s => { events.push(s.id); return { status: s.id === 'first' ? 'failed' : 'passed' }; } });
  assert.deepEqual(events, ['first','second']); assert.equal(r.results[1].status, 'passed');
  const empty = await executeStep(step('remainder', { command: ['node','-e','console.log(\'PROCESS_NEXT_RESULT {"status":"not-required","counts":{"tests":0}}\')'], allowEmpty: true }), { cwd: root, logPath: join(root, 'empty.log') });
  assert.equal(empty.status, 'not-required');
});
test('metadata-only packaging update does not repeat tests of identical delivered bytes', async t => {
  const root = fixture(t), p = plan([step('package', { env: { SHA:'one' }, outputs:['built','metadata'], evidenceOutputs:['built'] }),
    step('integration', { requires:['package'], dependencyOutputOnlyRequires:['package'] })]);
  const execute = async s => { if (s.id === 'package') { writeFileSync(join(root,'built'),'same'); writeFileSync(join(root,'metadata'),s.env.SHA); } return pass(); };
  await runPlan(p, { root, execute }); p.steps[0].env.SHA = 'two';
  const r = await runPlan(p, { root, execute }); assert.equal(r.results[0].status,'passed'); assert.equal(r.results[1].status,'reused');
});
test('silent zero-exit Node invocation is not a completed required test selection', async t => {
  const root = fixture(t), r = await executeStep(step('silent', { command:['node','-e',''], expectedNonempty:true }), { cwd:root, logPath:join(root,'silent.log') });
  assert.equal(r.status,'failed');
});
