import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkflowFallbackAdapter, fallbackRequest } from '../lib/fallback.mjs';

const SHA = 'a'.repeat(40);
const input = { active: { issue: 1105, materialSha: SHA }, task: { issue: 1105, layer: 'infra', track: 'show', changedFiles: ['scripts/example.mjs'] }, request: { areaTests: ['test/example.test.mjs'] } };
const successful = () => ({ schema: 1, id: 'run-1', materialSha: SHA, materialClean: true, issue: 1105, event: 'task',
  status: 'passed', finishedAt: '2026-11-01T09:00:00Z', results: [{ id: 'area', status: 'passed' }] });
function fixture(options = {}) {
  let now = Date.parse('2026-11-01T09:00:00Z');
  const selected = fallbackRequest(input), writes = [], reads = [], sleeps = [];
  const state = { run: null, report: null, ...options };
  const api = { root: '/repos/test/repo', request: async (method, path, body, extra) => {
    if (method !== 'GET') {
      writes.push({ path, body });
      if (state.writeError) throw state.writeError;
      if (path.endsWith('/dispatches')) state.run = { id: 101, display_title: `${selected.title} · ${selected.requestId}`, status: 'queued', run_attempt: 1, html_url: 'https://example.invalid/run/101' };
      if (path.endsWith('/rerun-failed-jobs')) { state.run.run_attempt++; state.run.status = 'queued'; }
      if (state.lostDispatch) { state.lostDispatch = false; throw Error('response lost'); }
      return null;
    }
    reads.push(path);
    if (path.includes('/workflows/')) return { workflow_runs: state.run ? [structuredClone(state.run)] : [] };
    if (path.includes('/artifacts?')) return { artifacts: state.report || state.archive ? [{ id: 202, name: 'process-next-result' }] : [] };
    if (path.endsWith('/zip')) { assert.equal(extra.binary, true); return state.archive; }
    return structuredClone(state.run);
  } };
  const adapter = new WorkflowFallbackAdapter({ api, clock: () => now, maxWaitMs: 4 * 60000,
    sleep: async ms => { now += ms; sleeps.push(ms); state.onSleep?.(); }, readArtifact: async () => structuredClone(state.report) });
  const complete = report => { state.run = { id: 101, display_title: `${selected.title} · ${selected.requestId}`, status: 'completed', conclusion: 'success', run_attempt: 1, html_url: 'https://example.invalid/run/101' }; state.report = report; };
  return { state, api, adapter, selected, writes, reads, sleeps, complete };
}

test('hosted request pins admitted identity and uses stable profile identity without local roots', () => {
  const first = fallbackRequest(input);
  const second = fallbackRequest({ ...input, request: { layer: 'docs', issue: 999, event: 'stable', root: 'C:/another', areaTests: input.request.areaTests } });
  assert.equal(first.requestId, second.requestId);
  assert.equal(second.profile.layer, 'infra'); assert.equal(second.profile.issue, 1105); assert.equal(second.profile.event, 'task');
  assert.throws(() => fallbackRequest({ ...input, request: { command: 'arbitrary program' } }), /Unsupported/);
  assert.notEqual(fallbackRequest({ ...input, active: { ...input.active, materialSha: 'b'.repeat(40) } }).requestId, first.requestId);
});

test('docs never dispatch a fallback or read GitHub', async () => {
  const f = fixture();
  assert.equal((await f.adapter.runS6({ ...input, task: { ...input.task, layer: 'docs' } })).outcome, 'not-required');
  assert.equal(f.reads.length + f.writes.length, 0);
  const invalid = await f.adapter.runS6({ ...input, request: { command: 'arbitrary program' } });
  assert.equal(invalid.terminal, true); assert.match(invalid.reason, /invalid/);
  assert.equal(f.reads.length + f.writes.length, 0);
});

test('one hosted S6 dispatch waits at minute intervals, returns real report, and resumes without another dispatch', async () => {
  const f = fixture(); f.state.onSleep = () => f.complete(successful());
  const result = await f.adapter.runS6(input);
  assert.equal(result.outcome, 'passed'); assert.equal(result.receipt.materialSha, SHA); assert.equal(result.evidence.execution, 'github');
  assert.deepEqual(f.sleeps, [60000]); assert.equal(f.writes.length, 1); assert.equal(f.reads.length, 3);
  assert.equal(f.writes[0].body.inputs.candidate, SHA); assert.equal(JSON.parse(f.writes[0].body.inputs.request).layer, 'infra');
  assert.equal((await f.adapter.runS6(input)).outcome, 'passed'); assert.equal(f.writes.length, 1);
});

test('a failed runner report is a failed check, never another automatic test run', async () => {
  const f = fixture(); f.complete({ ...successful(), status: 'failed', results: [{ id: 'area', status: 'failed' }] });
  f.state.run.conclusion = 'failure';
  assert.equal((await f.adapter.runS6(input)).outcome, 'failed'); assert.equal(f.writes.length, 0);
});

test('missing result after workflow failure gets one durable retry, then releases the wait', async () => {
  const f = fixture(); f.complete(null); f.state.run.conclusion = 'failure';
  f.state.onSleep = () => { f.state.run.status = 'completed'; f.state.run.conclusion = 'failure'; };
  const failed = await f.adapter.runS6(input);
  assert.equal(failed.outcome, 'unavailable'); assert.equal(failed.terminal, true);
  assert.match(failed.reason, /one automatic retry/); assert.equal(f.writes.length, 1);
  assert.equal(f.state.run.run_attempt, 2);
  await f.adapter.runS6(input); assert.equal(f.writes.length, 1, 'new agent invocation does not reset retry allowance');
});

test('the one rerun has two minutes to become visible without failing on the stale first attempt', async () => {
  const f = fixture(); f.complete(null); f.state.run.conclusion = 'failure';
  const request = f.api.request;
  f.api.request = async (method, path, ...args) => {
    const result = await request(method, path, ...args);
    if (path.endsWith('/rerun-failed-jobs')) { f.state.run.run_attempt = 1; f.state.run.status = 'completed'; }
    return result;
  };
  let waits = 0;
  f.state.onSleep = () => { if (++waits === 2) { f.complete(successful()); f.state.run.run_attempt = 2; } };
  assert.equal((await f.adapter.runS6(input)).outcome, 'passed');
  assert.equal(f.writes.length, 1); assert.deepEqual(f.sleeps, [60000, 60000]);
  const stuck = fixture(); stuck.complete(null); stuck.state.run.conclusion = 'failure';
  const original = stuck.api.request;
  stuck.api.request = async (method, path, ...args) => {
    const result = await original(method, path, ...args);
    if (path.endsWith('/rerun-failed-jobs')) { stuck.state.run.run_attempt = 1; stuck.state.run.status = 'completed'; }
    return result;
  };
  assert.equal((await stuck.adapter.runS6(input)).terminal, true);
  assert.equal(stuck.writes.length, 1); assert.deepEqual(stuck.sleeps, [60000, 60000]);
});

test('missing Actions permissions are actionable without repeated writes', async () => {
  const f = fixture({ writeError: Object.assign(Error('GitHub denied'), { status: 403 }) });
  const result = await f.adapter.runS6(input);
  assert.equal(result.terminal, true); assert.match(result.reason, /Actions write permission/);
  assert.equal(f.writes.length, 1); assert.equal(f.sleeps.length, 0);
});

test('lost dispatch response is recovered by observation rather than a duplicate workflow', async () => {
  const f = fixture({ lostDispatch: true }); f.state.onSleep = () => f.complete(successful());
  assert.equal((await f.adapter.runS6(input)).outcome, 'passed'); assert.equal(f.writes.length, 1);
  const absent = fixture({ writeError: Error('connection closed before response') });
  const result = await absent.adapter.runS6(input);
  assert.equal(result.terminal, true); assert.match(result.reason, /no matching run/); assert.equal(absent.writes.length, 1);
});

test('foreign, dirty, incomplete and empty report cannot authorize the queue', async () => {
  for (const report of [{ ...successful(), materialSha: 'b'.repeat(40) }, { ...successful(), materialClean: false },
    { ...successful(), event: 'beta' }, { ...successful(), finishedAt: null }, { ...successful(), results: [] }]) {
    const f = fixture(); f.complete(report);
    assert.notEqual((await f.adapter.runS6(input)).outcome, 'passed'); assert.equal(f.writes.length, 0);
  }
});

test('wait is bounded; cancelled workflow does not restart; interrupted client can resume the existing run', async () => {
  const f = fixture();
  const result = await f.adapter.runS6(input);
  assert.match(result.reason, /wait limit/); assert.equal(f.writes.length, 1); assert.deepEqual(f.sleeps, Array(4).fill(60000));
  const cancelled = fixture(); cancelled.complete(null); cancelled.state.run.conclusion = 'cancelled';
  assert.equal((await cancelled.adapter.runS6(input)).outcome, 'unavailable'); assert.equal(cancelled.writes.length, 0);
  const stop = new AbortController(); stop.abort(); const interrupted = fixture();
  assert.equal((await interrupted.adapter.runS6({ ...input, signal: stop.signal })).outcome, 'unavailable'); assert.equal(interrupted.reads.length, 0);
});

test('actual ZIP report is read without extracting artifact files into the checkout', async t => {
  const root = mkdtempSync(join(tmpdir(), 'hosted-report-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe', windowsHide: true });
  git(['init', '-q']); git(['config', 'user.name', 'Fixture']); git(['config', 'user.email', 'fixture@example.invalid']);
  git(['config', 'core.hooksPath', join(root, 'no-hooks')]);
  const file = join(root, 'process-next/.state/runs/run-1/report.json'); mkdirSync(join(root, 'process-next/.state/runs/run-1'), { recursive: true });
  writeFileSync(file, JSON.stringify(successful())); git(['add', '.']); git(['commit', '-qm', 'fixture']);
  const archive = join(root, 'result.zip'); git(['archive', '--format=zip', '--output', archive, 'HEAD']);
  const f = fixture({ archive: readFileSync(archive) }); f.complete(null); f.adapter.readArtifact = null;
  assert.equal((await f.adapter.runS6(input)).outcome, 'passed');
  assert.equal(f.reads.filter(path => path.endsWith('/zip')).length, 1);
});
