#!/usr/bin/env node
// #1040: default-branch events are delivery, not execution on the release SHA.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isMainModule } from './spawn-portable.mjs';

export const SERVICES = Object.freeze({
  'process.yml': { event: 'issues', inputs: {} },
  'process-resume.yml': { event: 'workflow_run', inputs: {} },
  'process-reconcile.yml': { event: 'schedule', inputs: { apply: true } },
  'nightly.yml': { event: 'schedule', inputs: {} },
  'mutation-gate.yml': { event: 'schedule', inputs: { ref: 'dev' } },
  'process-metrics.yml': { event: 'schedule', inputs: { days: '7' } },
  'ship-review.yml': { event: null, inputs: { tag: '', candidate: '', force: false } },
  'beta-derived.yml': { event: null, inputs: { tag: '', docs_expect_change: '', golden_run: '', golden_expect_change: '', golden_expect_new: '' } },
});
const REPO = 'Matysh/houseplan-card';
const ID = /^[1-9][0-9]*$/;
const SHA = /^[a-f0-9]{40}$/;
export const MAX_RECEIPT_BYTES = 32_768;
const MAX_AGE = 24 * 60 * 60_000;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const requireThat = (ok, why) => { if (!ok) throw Error(`service delivery: ${why}`); };
const pathOf = workflow => `.github/workflows/${workflow}`;
export const receiptName = (run, attempt) => `service-event-${run}-${attempt}`;

export function serviceInputs(workflow, inputs = {}) {
  const defaults = SERVICES[workflow]?.inputs;
  requireThat(defaults, 'unknown workflow');
  requireThat(inputs && typeof inputs === 'object' && !Array.isArray(inputs), 'invalid inputs object');
  const result = {};
  for (const [key, fallback] of Object.entries(defaults)) {
    const value = inputs[key] ?? fallback;
    requireThat(typeof value === typeof fallback, `invalid ${key} type`);
    requireThat(typeof value !== 'string' || value.length <= 4096, `${key} too long`);
    result[key] = value;
  }
  return result;
}

/** Only routing identity, never issue bodies, tokens or arbitrary event blobs. */
export function routingEvent(workflow, name, event, repo = REPO) {
  requireThat(repo === REPO && SERVICES[workflow], 'foreign repository/workflow');
  requireThat(name === SERVICES[workflow].event || name === 'workflow_dispatch', 'wrong source event');
  requireThat(event?.repository?.full_name === repo, 'event repository mismatch');
  if (name === 'issues') {
    requireThat(workflow === 'process.yml' && event.action === 'labeled', 'not a review request');
    requireThat(ID.test(String(event.issue?.number)) && ['S4-spec-review', 'S7-code-review'].includes(event.label?.name), 'invalid review identity');
    requireThat(typeof event.issue.title === 'string', 'missing issue title');
    return { action: 'labeled', issue: { number: event.issue.number, title: event.issue.title.slice(0, 256) }, label: { name: event.label.name } };
  }
  if (name === 'workflow_run') {
    const run = event.workflow_run;
    requireThat(workflow === 'process-resume.yml' && event.action === 'completed' && run?.status === 'completed', 'not a completed workflow');
    requireThat(run.repository?.full_name === repo && run.head_repository?.full_name === repo, 'foreign completed workflow');
    requireThat(ID.test(String(run.id)) && ID.test(String(run.run_attempt)) && SHA.test(run.head_sha), 'invalid completed run identity');
    requireThat(['validate.yml', 'validate-product.yml', 'validate-tooling.yml', 'validate-docs.yml', 'performance.yml'].some(file => run.path === pathOf(file)), 'unregistered completion');
    return { action: 'completed', workflow_run: Object.fromEntries([
      'id', 'run_attempt', 'path', 'head_branch', 'head_sha', 'event', 'status', 'conclusion',
      'repository', 'head_repository',
    ].map(key => [key, ['repository', 'head_repository'].includes(key) ? { full_name: repo } : run[key]])) };
  }
  if (name === 'schedule') {
    requireThat(typeof event.schedule === 'string' && /^[0-9*,/ -]+$/.test(event.schedule) && event.schedule.length < 80, 'invalid schedule');
    return { schedule: event.schedule };
  }
  requireThat(!['process.yml', 'process-resume.yml'].includes(workflow), 'manual review/completion needs an authenticated delivery');
  return {};
}

export function makeReceipt({ workflow, eventName, event, inputs, repo, run, attempt, sha, now = Date.now() }) {
  requireThat(ID.test(String(run)) && ID.test(String(attempt)) && SHA.test(sha), 'invalid producer identity');
  return { schema: 1, repo, workflow, eventName, run: String(run), attempt: String(attempt), sha,
    created: new Date(now).toISOString(), event: routingEvent(workflow, eventName, event, repo), inputs: serviceInputs(workflow, inputs) };
}

/** Content hash is integrity only; the immutable GitHub run supplies authority. */
export function verifyReceipt(receipt, run, { workflow, repo = REPO, origin, attempt, now = Date.now() }) {
  requireThat(receipt?.schema === 1 && receipt.repo === repo && repo === REPO && receipt.workflow === workflow, 'receipt identity mismatch');
  requireThat(ID.test(String(origin)) && ID.test(String(attempt)), 'invalid origin locator');
  requireThat(String(run.id) === String(origin) && String(run.run_attempt) === String(attempt)
    && receipt.run === String(origin) && receipt.attempt === String(attempt), 'origin attempt mismatch');
  requireThat(run.repository?.full_name === repo && run.head_repository?.full_name === repo
    && run.head_branch === 'main' && run.path === pathOf(workflow), 'untrusted origin');
  requireThat(SHA.test(receipt.sha) && receipt.sha === run.head_sha && receipt.eventName === run.event, 'origin material/event mismatch');
  const age = now - Date.parse(receipt.created);
  requireThat(Number.isFinite(age) && age >= -60_000 && age <= MAX_AGE, 'expired receipt');
  const sourceAge = now - Date.parse(run.created_at);
  requireThat(Number.isFinite(sourceAge) && sourceAge >= -60_000 && sourceAge <= MAX_AGE, 'expired origin');
  const event = routingEvent(workflow, receipt.eventName, { ...receipt.event, repository: { full_name: repo } }, repo);
  requireThat(JSON.stringify(event) === JSON.stringify(receipt.event), 'noncanonical event');
  requireThat(JSON.stringify(serviceInputs(workflow, receipt.inputs)) === JSON.stringify(receipt.inputs), 'noncanonical inputs');
  return receipt;
}

export function reviewDeliveryKey(receipt, events, originCreated) {
  const labels = ['S4-spec-review', 'S7-code-review'];
  const requests = events.filter(event => event.event === 'labeled' && labels.includes(event.label?.name));
  requireThat(requests.every(event => ID.test(String(event.id)) && Number.isFinite(Date.parse(event.created_at))), 'invalid request timeline');
  requests.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at) || Number(a.id) - Number(b.id));
  const latest = requests.at(-1);
  requireThat(latest && latest.label.name === receipt.event.label.name && Date.parse(latest.created_at) <= Date.parse(originCreated), 'stale review request');
  // A same-second relabel cannot safely be attributed to an older ingress.
  requireThat(requests.filter(event => event.created_at === latest.created_at).length === 1, 'ambiguous review request');
  return `process-${receipt.event.issue.number}-${latest.id}`;
}

export async function claimDelivery(key, sha, api) {
  requireThat(/^[a-z0-9-]+$/.test(key) && SHA.test(sha), 'invalid claim identity');
  const ref = `service-delivery/${key}`;
  if (await api(`git/ref/heads/${ref}`, { missing: true })) return false;
  try { await api('git/refs', { method: 'POST', data: { ref: `refs/heads/${ref}`, sha } }); return true; }
  catch (error) {
    // Conflict can also be a racing receiver. Unknown write outcomes stay red.
    if ([409, 422].includes(error.status) && await api(`git/ref/heads/${ref}`, { missing: true })) return false;
    throw error;
  }
}

function gh(args, options = {}) {
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024, ...options });
}
function runtime(repo) {
  return async (path, { method = 'GET', data, missing = false } = {}) => {
    const args = ['api', `repos/${repo}/${path}`, '--method', method];
    if (data) args.push('--input', '-');
    try { const out = gh(args, data ? { input: JSON.stringify(data) } : {}); return out.trim() ? JSON.parse(out) : null; }
    catch (error) {
      if (missing && /HTTP 404/.test(String(error.stderr))) return null;
      // Do not echo gh diagnostics/credential-bearing URLs into Actions outputs.
      const failure = Error(`GitHub ${method} ${path.split('?')[0]} failed`);
      failure.status = Number(/HTTP (\d{3})/.exec(String(error.stderr))?.[1]) || null;
      throw failure;
    }
  };
}
function outputs(values, file) {
  for (const [key, value] of Object.entries(values)) {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    requireThat(!/[\r\n]/.test(text), 'multiline output');
    appendFileSync(file, `${key}=${text}\n`);
  }
}

export async function main(mode, env = process.env, dependencies = {}) {
  const workflow = env.SERVICE_WORKFLOW;
  requireThat(SERVICES[workflow] && env.GITHUB_REPOSITORY === REPO, 'unknown service/repository');
  const api = dependencies.api || runtime(REPO);
  const command = dependencies.command || gh;
  const emit = values => outputs(values, env.GITHUB_OUTPUT);
  const input = JSON.parse(env.SERVICE_INPUTS || '{}') ?? {};
  requireThat(input && typeof input === 'object' && !Array.isArray(input), 'invalid dispatch inputs');
  const sourceEvent = () => JSON.parse(env.SERVICE_EVENT || readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  if (mode === 'prepare') {
    if (env.GITHUB_REF === 'refs/heads/main') {
      requireThat(!input.delivery, 'a delivered event cannot relay again');
      const receipt = makeReceipt({ workflow, eventName: env.GITHUB_EVENT_NAME,
        event: sourceEvent(), inputs: input, repo: REPO,
        run: env.GITHUB_RUN_ID, attempt: env.GITHUB_RUN_ATTEMPT, sha: env.GITHUB_SHA, now: dependencies.now });
      const bytes = Buffer.from(JSON.stringify(receipt));
      requireThat(bytes.length <= MAX_RECEIPT_BYTES, 'receipt too large');
      mkdirSync(env.SERVICE_DIRECTORY, { recursive: true });
      writeFileSync(join(env.SERVICE_DIRECTORY, 'event.json'), bytes);
      writeFileSync(join(env.SERVICE_DIRECTORY, 'manifest.sha256'), `${hash(bytes)}  event.json\n`);
      emit({ relay: true, accepted: false, artifact: receiptName(receipt.run, receipt.attempt) });
      return;
    }
    requireThat(env.GITHUB_REF === 'refs/heads/dev' && env.GITHUB_EVENT_NAME === 'workflow_dispatch', 'execution must be dispatched on dev');
    let receipt;
    let key;
    if (input.delivery) {
      const locator = JSON.parse(input.delivery);
      requireThat(ID.test(String(locator.run)) && ID.test(String(locator.attempt)), 'invalid delivery locator');
      const run = await api(`actions/runs/${locator.run}/attempts/${locator.attempt}`);
      const dir = mkdtempSync(join(tmpdir(), 'houseplan-service-event-'));
      try {
        const name = receiptName(locator.run, locator.attempt);
        const artifacts = await api(`actions/runs/${locator.run}/artifacts?per_page=100`);
        const matches = artifacts.artifacts?.filter(artifact => artifact.name === name && !artifact.expired);
        requireThat(matches?.length === 1 && matches[0].size_in_bytes <= MAX_RECEIPT_BYTES + 4096, 'missing/ambiguous/oversize source artifact');
        command(['run', 'download', String(locator.run), '--repo', REPO, '--name', name, '--dir', dir]);
        requireThat(readdirSync(dir).sort().join(',') === 'event.json,manifest.sha256', 'unexpected artifact files');
        const bytes = readFileSync(join(dir, 'event.json'));
        requireThat(bytes.length <= MAX_RECEIPT_BYTES && readFileSync(join(dir, 'manifest.sha256'), 'utf8') === `${hash(bytes)}  event.json\n`, 'receipt integrity failure');
        receipt = verifyReceipt(JSON.parse(bytes), run, { workflow, origin: locator.run, attempt: locator.attempt, now: dependencies.now });
        requireThat(locator.title === serviceTitle(receipt), 'dispatch title differs from receipt');
      } finally { rmSync(dir, { recursive: true, force: true }); }
      key = `${workflow.replace('.yml', '')}-${receipt.run}`;
      if (workflow === 'process.yml') {
        const events = [];
        for (let page = 1; ; page++) {
          requireThat(page <= 100, 'request timeline exceeds bound');
          const batch = await api(`issues/${receipt.event.issue.number}/events?per_page=100&page=${page}`);
          requireThat(Array.isArray(batch), 'invalid request timeline');
          events.push(...batch);
          if (batch.length < 100) break;
        }
        key = reviewDeliveryKey(receipt, events, run.created_at);
      }
      if (receipt.eventName === 'workflow_run') {
        const expected = receipt.event.workflow_run;
        const actual = await api(`actions/runs/${expected.id}/attempts/${expected.run_attempt}`);
        for (const field of ['id', 'run_attempt', 'path', 'head_branch', 'head_sha', 'event', 'status', 'conclusion']) {
          requireThat(actual[field] === expected[field], 'completed source changed');
        }
        requireThat(actual.repository?.full_name === REPO && actual.head_repository?.full_name === REPO, 'foreign completion');
      }
      if (!await claimDelivery(key, env.GITHUB_SHA, api)) { emit({ accepted: false, relay: false }); return; }
    } else {
      receipt = { eventName: 'workflow_dispatch', event: routingEvent(workflow, 'workflow_dispatch', sourceEvent()), inputs: serviceInputs(workflow, input) };
    }
    emit({ accepted: true, relay: false, event: JSON.stringify(receipt.event), event_name: receipt.eventName, parameters: JSON.stringify(receipt.inputs) });
    return;
  }
  requireThat(mode === 'dispatch' && env.GITHUB_REF === 'refs/heads/main', 'invalid dispatch mode');
  const receipt = JSON.parse(readFileSync(join(env.SERVICE_DIRECTORY, 'event.json'), 'utf8'));
  const delivery = JSON.stringify({ run: receipt.run, attempt: receipt.attempt, title: serviceTitle(receipt) });
  // One write, no retry on an ambiguous HTTP outcome. The receiver claims once.
  await api(`actions/workflows/${workflow}/dispatches`, { method: 'POST', data: { ref: 'dev', inputs: { delivery, ...receipt.inputs } } });
  appendFileSync(env.GITHUB_STEP_SUMMARY, `Delivered ${workflow} to dev. Origin ${receipt.run}/${receipt.attempt}; this is delivery, not a verdict.\n`);
}

export function serviceTitle(receipt) {
  if (receipt.workflow === 'process.yml') return `process #${receipt.event.issue.number} · ${receipt.event.label.name} · ${receipt.event.issue.title}`;
  if (receipt.workflow === 'process-resume.yml') return `resume · ${receipt.event.workflow_run.head_branch} · ${receipt.event.workflow_run.conclusion}`;
  return `${receipt.workflow} · ${receipt.eventName}`;
}
if (isMainModule(import.meta.url)) await main(process.argv[2]);
