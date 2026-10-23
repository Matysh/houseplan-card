import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { main, serviceTitle, makeReceipt, verifyReceipt, reviewDeliveryKey, claimDelivery, serviceInputs, routingEvent, SERVICES } from '../scripts/service-event.mjs';
import { serviceWorkflow, ROUTES } from '../scripts/service-workflows.mjs';
import { processRuns } from '../scripts/process-reconcile.mjs';

const repo = 'Matysh/houseplan-card';
const now = Date.parse('2026-10-23T09:00:00Z');
const sha = 'a'.repeat(40);
const source = { repository: { full_name: repo }, action: 'labeled', issue: { number: 1040, title: 'A test\nwith text' }, label: { name: 'S7-code-review' } };
const receipt = () => makeReceipt({ workflow: 'process.yml', eventName: 'issues', event: source, inputs: {}, repo, run: 123, attempt: 1, sha, now });
const origin = () => ({ id: 123, run_attempt: 1, repository: { full_name: repo }, head_repository: { full_name: repo },
  head_branch: 'main', head_sha: sha, path: '.github/workflows/process.yml', event: 'issues', created_at: new Date(now).toISOString() });
const options = { workflow: 'process.yml', origin: 123, attempt: 1, now };

test('#1040 verify exact GitHub source, not the dispatch input or checksum alone', () => {
  assert.equal(verifyReceipt(receipt(), origin(), options).event.issue.number, 1040);
  for (const patch of [ { head_branch: 'issue/1040-x' }, { head_sha: 'b'.repeat(40) }, { path: '.github/workflows/validate.yml' },
    { repository: { full_name: 'foreign/repo' } }, { head_repository: { full_name: 'foreign/repo' } },
    { event: 'workflow_dispatch' }, { run_attempt: 2 }, { id: 124 }, { created_at: '2020-01-01' } ]) {
    assert.throws(() => verifyReceipt(receipt(), { ...origin(), ...patch }, options), /service delivery/);
  }
  for (const patch of [{ schema: 2 }, { repo: 'foreign/repo' }, { workflow: 'nightly.yml' }, { attempt: '2' },
    { sha: 'b'.repeat(40) }, { created: '2020-01-01' }, { created: new Date(now + 120_000).toISOString() },
    { event: { ...receipt().event, body: 'untrusted extra input' } }, { inputs: { injected: true } }]) {
    assert.throws(() => verifyReceipt({ ...receipt(), ...patch }, origin(), options), /service delivery/);
  }
});

test('#1040 project only bounded routing identity and preserve false, never truthy strings', () => {
  assert.equal('body' in receipt().event.issue, false);
  assert.deepEqual(serviceInputs('process-reconcile.yml', { apply: false }), { apply: false });
  assert.throws(() => serviceInputs('process-reconcile.yml', { apply: 'false' }), /type/);
  assert.throws(() => serviceInputs('nightly.yml', null), /./);
  assert.throws(() => routingEvent('process.yml', 'workflow_dispatch', { repository: { full_name: repo } }), /authenticated/);
  assert.throws(() => routingEvent('nightly.yml', 'issues', source), /wrong source/);
  assert.throws(() => routingEvent('process.yml', 'issues', { ...source, label: { name: 'P2' } }), /review identity/);
});

test('#1040 schedules retain their semantics after becoming workflow_dispatch', () => {
  for (const [workflow, config] of Object.entries(SERVICES)) {
    if (config.event !== 'schedule') continue;
    const r = makeReceipt({ workflow, eventName: 'schedule', event: { repository: { full_name: repo }, schedule: '43 0 * * *' }, inputs: {}, repo, run: 123, attempt: 1, sha, now });
    const run = { ...origin(), path: `.github/workflows/${workflow}`, event: 'schedule' };
    assert.equal(verifyReceipt(r, run, { ...options, workflow }).eventName, 'schedule');
  }
});

test('#1040 reject foreign/fake completion and expose the exact CI run/attempt', () => {
  const run = { id: 9, run_attempt: 2, head_sha: sha, head_branch: 'issue/1040-x', repository: { full_name: repo },
    head_repository: { full_name: repo }, path: '.github/workflows/validate-product.yml', status: 'completed', conclusion: 'failure', event: 'push' };
  const event = { repository: { full_name: repo }, action: 'completed', workflow_run: run };
  assert.equal(routingEvent('process-resume.yml', 'workflow_run', event).workflow_run.conclusion, 'failure');
  for (const patch of [{ head_repository: { full_name: 'x/y' } }, { path: '.github/workflows/process.yml' }, { status: 'queued' }, { run_attempt: 0 }]) {
    assert.throws(() => routingEvent('process-resume.yml', 'workflow_run', { ...event, workflow_run: { ...run, ...patch } }), /service delivery/);
  }
});

test('#1040 current epoch, stale request and ambiguous same-second relabel', () => {
  const events = [{ id: 1, event: 'labeled', label: { name: 'S7-code-review' }, created_at: new Date(now - 1000).toISOString() }];
  assert.equal(reviewDeliveryKey(receipt(), events, origin().created_at), 'process-1040-1');
  assert.throws(() => reviewDeliveryKey(receipt(), [{ ...events[0], created_at: new Date(now + 1000).toISOString() }], origin().created_at), /stale/);
  assert.throws(() => reviewDeliveryKey(receipt(), [events[0], { ...events[0], id: 2 }], origin().created_at), /ambiguous/);
  assert.throws(() => reviewDeliveryKey(receipt(), [{ ...events[0], label: { name: 'S4-spec-review' } }], origin().created_at), /stale/);
});

test('#1040 claim is exactly once, including races; unknown write outcome remains red', async () => {
  let claimed = false, writes = 0;
  const api = async (_, { method } = {}) => {
    if (method === 'POST') { writes++; if (claimed) throw Object.assign(Error('conflict'), { status: 422 }); claimed = true; return {}; }
    return claimed ? { ref: 'already claimed' } : null;
  };
  assert.deepEqual(await Promise.all([claimDelivery('process-1040-1', sha, api), claimDelivery('process-1040-1', sha, api)]), [true, false]);
  assert.equal(writes, 2);
  assert.equal(await claimDelivery('process-1040-1', sha, api), false);
  const broken = async (_, { method } = {}) => { if (method === 'POST') throw Error('network'); return null; };
  await assert.rejects(claimDelivery('process-1040-2', sha, broken), /network/);
});

test('#1040 generated ingress has no operational body on main, receiver owns every business input', () => {
  assert.deepEqual(Object.keys(ROUTES), Object.keys(SERVICES));
  for (const file of Object.keys(ROUTES)) {
    const actual = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
    assert.equal(actual, serviceWorkflow(file), file);
    assert.match(actual, /needs: event\n    if: needs\.event\.outputs\.accepted == 'true'/);
    const body = readFileSync(new URL(`../.github/workflows/_${file}`, import.meta.url), 'utf8');
    assert.match(body, /source_event:/);
  }
});

test('#1040 process history sees dispatched dev workers, never successful ingress as a review verdict', () => {
  const created_at = origin().created_at;
  const title = 'process #1040 · S7-code-review · x';
  const rows = [
    { id: 1, event: 'issues', display_title: 'relay ' + title, created_at },
    { id: 2, event: 'workflow_dispatch', head_branch: 'dev', display_title: title, created_at },
    { id: 3, event: 'workflow_dispatch', head_branch: 'main', display_title: title, created_at },
    { id: 4, event: 'issues', display_title: title, created_at },
  ];
  const result = processRuns(repo, [], { since: created_at, getJson: () => ({ workflow_runs: rows }) });
  assert.deepEqual(result.map(row => row.id), [2, 4]);
});

test('#1040 real sender/receiver orchestration: delivery is not a verdict, authenticated work is once-only', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'hp-service-event-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { SERVICE_WORKFLOW: 'process.yml', GITHUB_REPOSITORY: repo, SERVICE_INPUTS: '{}',
    GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'issues', GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1', GITHUB_SHA: sha,
    SERVICE_EVENT: JSON.stringify(source), SERVICE_DIRECTORY: join(dir, 'receipt'), GITHUB_OUTPUT: join(dir, 'output'), GITHUB_STEP_SUMMARY: join(dir, 'summary') };
  // Native issue bodies need not fit workflow_call inputs or environment values.
  env.GITHUB_EVENT_PATH = join(dir, 'native-event.json');
  writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify({ ...source, issue: { ...source.issue, body: 'private-looking-data'.repeat(10_000) } }));
  delete env.SERVICE_EVENT;
  env.SERVICE_INPUTS = 'null';
  let dispatch;
  await main('prepare', env, { now });
  assert.match(readFileSync(env.GITHUB_OUTPUT, 'utf8'), /accepted=false/);
  await main('dispatch', env, { api: async (path, options) => { dispatch = { path, ...options }; } });
  assert.equal(dispatch.data.ref, 'dev');
  assert.equal(dispatch.path, 'actions/workflows/process.yml/dispatches');
  const stored = JSON.parse(readFileSync(join(env.SERVICE_DIRECTORY, 'event.json')));
  assert.equal(JSON.parse(dispatch.data.inputs.delivery).title, serviceTitle(stored));
  assert.doesNotMatch(readFileSync(join(env.SERVICE_DIRECTORY, 'event.json'), 'utf8'), /body|password|token/);
  const receiving = { ...env, GITHUB_REF: 'refs/heads/dev', GITHUB_EVENT_NAME: 'workflow_dispatch',
    SERVICE_INPUTS: JSON.stringify(dispatch.data.inputs), GITHUB_OUTPUT: join(dir, 'received') };
  let claimed = false, posts = 0;
  const deps = { now, api: async (path, options = {}) => {
    if (path === 'actions/runs/123/attempts/1') return origin();
    if (path.includes('/artifacts?')) return { artifacts: [{ name: 'service-event-123-1', size_in_bytes: 500, expired: false }] };
    if (path.startsWith('issues/1040/events')) return [{ id: 5, event: 'labeled', label: source.label, created_at: new Date(now - 1000).toISOString() }];
    if (path.startsWith('git/ref/')) return claimed ? {} : null;
    if (path === 'git/refs' && options.method === 'POST') { claimed = true; posts++; return {}; }
    throw Error(`unexpected API ${path}`);
  }, command: args => {
    const out = args[args.indexOf('--dir') + 1];
    for (const name of ['event.json', 'manifest.sha256']) writeFileSync(join(out, name), readFileSync(join(env.SERVICE_DIRECTORY, name)));
  } };
  await main('prepare', receiving, deps);
  assert.match(readFileSync(receiving.GITHUB_OUTPUT, 'utf8'), /accepted=true/);
  assert.match(readFileSync(receiving.GITHUB_OUTPUT, 'utf8'), /event_name=issues/);
  writeFileSync(receiving.GITHUB_OUTPUT, '');
  await main('prepare', receiving, deps);
  assert.match(readFileSync(receiving.GITHUB_OUTPUT, 'utf8'), /accepted=false/);
  assert.equal(posts, 1, 'no second work authorization');
  const badBytes = Buffer.from(JSON.stringify({ ...stored, sha: 'b'.repeat(40) }));
  writeFileSync(join(env.SERVICE_DIRECTORY, 'event.json'), badBytes);
  writeFileSync(join(env.SERVICE_DIRECTORY, 'manifest.sha256'), `${createHash('sha256').update(badBytes).digest('hex')}  event.json\n`);
  await assert.rejects(main('prepare', receiving, deps), /material\/event mismatch/, 'even a matching checksum cannot bless foreign source material');
  await assert.rejects(main('dispatch', env, { api: async () => { throw Error('dispatch refused'); } }), /dispatch refused/);
  await assert.rejects(main('prepare', { ...receiving, GITHUB_REF: 'refs/heads/issue/1040-x' }, deps), /on dev/);
  const manual = { ...receiving, SERVICE_WORKFLOW: 'process-reconcile.yml', SERVICE_INPUTS: '{"apply":false}', GITHUB_OUTPUT: join(dir, 'manual') };
  await main('prepare', manual, { api: () => { throw Error('ordinary manual context must not synthesize a source API call'); } });
  assert.match(readFileSync(manual.GITHUB_OUTPUT, 'utf8'), /parameters=\{"apply":false\}/);
});
