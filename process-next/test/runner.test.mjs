import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPlan, validatePlan, executeStep } from '../lib/runner.mjs';
import { inputIdentity, outputIdentity, within } from '../lib/storage.mjs';

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
