#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitHubClient, GitHubQueueStore } from './lib/github.mjs';
import { QueueController, StateConflict } from './lib/queue.mjs';
import { handleGithubEvent, reconcileQueue, reconcileMergedLabel } from './lib/coordinator.mjs';
import { initialReleaseState, reduceRelease, releaseClosePlan, ReleaseGitAdapter, ReleasePublisher,
  HacsClient, HacsDeliveryVerifier } from './lib/release.mjs';

const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const component = encodeURIComponent;
const commands = new Set(['initialize-queue', 'initialize-release', 'owner-decision', 'label', 'ready', 'enqueue',
  'admit', 'heartbeat', 'synchronized', 's6-complete', 'return', 'expire', 'review-complete', 'reconcile', 'merge',
  'reconcile-merged', 'release-event', 'publish-prepared', 'verify-delivery', 'close-included']);

export const help = `Houseplan process-next remote (disabled by default)
node process-next/remote.mjs COMMAND --config config.json --event event.json [--plan | --execute]

Queue: initialize-queue, owner-decision, label, ready (alias enqueue), admit,
       heartbeat, synchronized, s6-complete, return, expire, reconcile,
       review-complete, merge, reconcile-merged
Release: initialize-release, release-event, publish-prepared, verify-delivery, close-included

Default --plan is OFFLINE: no API, Git, environment probes or remote writes.
Execution requires ALL: --execute, config.enabled=true, HP_PROCESS_NEXT_ACTIVATE=1.
Credentials come ONLY from env (github.tokenEnv, default GH_TOKEN; hacs.tokenEnv).
Git authentication uses the configured Git remote/credential helper; tokens are not CLI arguments.

Config: {enabled:false, owner:"Matysh", repo:"houseplan-card", workspace:"/path/to/repo",
  github:{tokenEnv:"GH_TOKEN"}, ownerLogin:"Matysh",
  queue:{branch:"process-state",path:"queue.json"},
  release:{branch:"process-release-state",path:"releases.json"},
  review:{workflow:"process-next-review.yml",ref:"dev",commentAuthor:"github-actions[bot]"}}

Every event needs a stable id reused for delivery retries. Queue events carry issue/token/materialSha
as applicable. ready additionally carries branch/layer; synchronized carries expectedBase.
s6-complete carries outcome and evidence from the local runner; this CLI never runs tests.
review-complete reads the matching trusted workflow report; it never trusts a supplied verdict.
reconcile performs ONE step (admit / await local S6 / request or read review / merge).
initialize-* requires event.confirmed=true and baseSha. release-event takes a reducer event;
published/delivery-verified are accepted only through actual publication/observation commands.
publish-prepared: {id,candidate,tag,expectedMain,artifacts:[{name,path,expectedDigest}],body?}.
verify-delivery: {id,candidate,assetName}; close-included: {id,candidate}.
`;

/** Workflow input/result protocol. No test runner is exposed to S7.
 * Dispatch has no API idempotency key: the workflow also needs concurrency by requestId and
 * a preflight report-marker check. This adapter avoids redispatching an observed run/result.
 */
export class WorkflowReviewAdapter {
  constructor({ api, workflow = 'process-next-review.yml', ref = 'dev', commentAuthor = 'github-actions[bot]', maxPages = 20 } = {}) {
    if (!/^[\w.-]+\.ya?ml$/.test(workflow) || !ref || !commentAuthor) throw Error('Review workflow/ref/author required');
    Object.assign(this, { api, workflow, ref, commentAuthor, maxPages });
  }
  validate({ requestId, active, task }) {
    if (!/^[A-Za-z0-9:-]+$/.test(requestId ?? '') || !Number.isSafeInteger(active?.issue)
      || !sha(active.materialSha) || !sha(active.expectedBase)) throw Error('Pinned review request required');
    if (task?.track === 'ship' && task.ownerAssigned) throw Error('Owner ship never requests individual code review');
  }
  async list(path, key) {
    const rows = [];
    for (let page = 1; page <= this.maxPages; page++) {
      const response = await this.api.request('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const batch = key ? response[key] : response;
      if (!Array.isArray(batch)) throw Error('Invalid review inventory');
      rows.push(...batch);
      if (batch.length < 100) return rows;
    }
    throw Error('Review inventory incomplete; do not dispatch another uncertain request');
  }
  async readReviewResult(context) {
    this.validate(context);
    const { requestId, active } = context, marker = `<!-- process-next-review:${requestId} -->`;
    const comments = await this.list(`${this.api.root}/issues/${active.issue}/comments`);
    const matched = comments.filter(row => row.user?.login === this.commentAuthor && row.body?.includes(marker));
    const results = matched.map(row => {
      const after = row.body.slice(row.body.indexOf(marker) + marker.length).trim();
      const fenced = after.match(/^```(?:json)?\s*\n([\s\S]*?)\n```/);
      const raw = fenced ? fenced[1] : after.split(/\r?\n/)[0];
      let result;
      try { result = JSON.parse(raw); } catch { throw Error('Review report marker has invalid JSON'); }
      if (result.requestId !== requestId || result.materialSha !== active.materialSha
        || !['accepted', 'changes_requested', 'incomplete'].includes(result.verdict)) throw Error('Review report belongs to different material or has invalid verdict');
      return { requestId, materialSha: result.materialSha, verdict: result.verdict, reportUrl: row.html_url ?? result.reportUrl };
    });
    if (results.length) {
      if (new Set(results.map(row => row.verdict)).size !== 1) throw Error('Conflicting reports for the same review request');
      return results.at(-1);
    }
    const runs = await this.list(`${this.api.root}/actions/workflows/${component(this.workflow)}/runs?event=workflow_dispatch`, 'workflow_runs');
    const escaped = requestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = runs.filter(run => new RegExp(`(?:^|[^A-Za-z0-9:-])${escaped}(?:$|[^A-Za-z0-9:-])`).test(run.display_title ?? run.name ?? ''));
    if (matches.some(run => run.status !== 'completed')) return { pending: true, requestId, materialSha: active.materialSha };
    if (matches.length) return { requestId, materialSha: active.materialSha, verdict: 'incomplete', reportUrl: matches.at(-1).html_url };
    return { missing: true, requestId, materialSha: active.materialSha };
  }
  async requestReview(context) {
    this.validate(context);
    const observed = await this.readReviewResult(context);
    if (!observed.missing) return { requested: false, observed };
    const { requestId, active, task } = context;
    const inputs = { issue: String(active.issue), base: active.expectedBase, head: active.materialSha,
      track: task.track, requestId, kind: 'code', ownerAssigned: String(task.ownerAssigned === true),
      receipts: JSON.stringify(task.s6 ? (Array.isArray(task.s6) ? task.s6 : [task.s6]) : []) };
    if (Buffer.byteLength(JSON.stringify(inputs)) > 60_000) throw Error('S6 receipt is too large for a workflow input; supply a compact receipt');
    const result = await this.api.request('POST', `${this.api.root}/actions/workflows/${component(this.workflow)}/dispatches`, { ref: this.ref, inputs });
    return { requested: !result?.planned, ...(result?.planned ? { planned: true } : {}), requestId };
  }
}

async function releaseDispatch(store, event) {
  for (let retry = 0; retry < 8; retry++) {
    const { state, version } = await store.read(), next = reduceRelease(state, event);
    if (next.revision === state.revision) return next;
    try { await store.compareAndSwap(version, next); return next; }
    catch (error) { if (!(error instanceof StateConflict)) throw error; }
  }
  throw new StateConflict('Release state remained busy; retry the same event ID');
}

function activation(config, execute, env) {
  if (!execute) return false;
  if (config.enabled !== true || env.HP_PROCESS_NEXT_ACTIVATE !== '1')
    throw Error('Remote execution is disabled: require config.enabled=true and HP_PROCESS_NEXT_ACTIVATE=1');
  return true;
}

/** The injected dependencies make the exact binding testable without GitHub, HACS or a checkout.
 * All default execution is offline planning; supplying a config file cannot activate it.
 */
export async function executeRemoteCommand({ command, config = {}, event = {}, execute = false, env = process.env, dependencies = {} } = {}) {
  if (!commands.has(command)) throw Error('Unknown remote command; use --help');
  if (typeof event.id !== 'string' || !/^[A-Za-z0-9:-]+$/.test(event.id)) throw Error('Stable alphanumeric/colon/hyphen delivery id required');
  const enabled = activation(config, execute, env);
  if (!enabled) return { planned: true, offline: true, command, eventId: event.id,
    issue: event.issue ?? null, candidate: event.candidate ?? null,
    requiredActivation: ['--execute', 'config.enabled=true', 'HP_PROCESS_NEXT_ACTIVATE=1'],
    note: 'No API/Git calls or tests were performed. Execute uses current remote state and immutable identities.' };
  const tokenName = config.github?.tokenEnv ?? 'GH_TOKEN';
  if (!/^[A-Z][A-Z0-9_]*$/.test(tokenName)) throw Error('Use a credential environment-variable name');
  if (!dependencies.api && !env[tokenName]) throw Error(`Missing credential environment variable ${tokenName}`);
  const api = dependencies.api ?? new GitHubClient({ owner: config.owner, repo: config.repo, token: env[tokenName], activated: true });
  const git = dependencies.git ?? new ReleaseGitAdapter({ cwd: config.workspace, remote: config.git?.remote ?? 'origin',
    dev: config.git?.dev ?? 'dev', activated: true });
  const queue = dependencies.queue ?? new QueueController(new GitHubQueueStore(api, {
    branch: config.queue?.branch ?? 'process-state', path: config.queue?.path ?? 'queue.json' }));
  const releaseStore = dependencies.releaseStore ?? new GitHubQueueStore(api, {
    branch: config.release?.branch ?? 'process-release-state', path: config.release?.path ?? 'releases.json', initial: initialReleaseState });
  const review = dependencies.review ?? new WorkflowReviewAdapter({ api, ...config.review });
  const owner = config.ownerLogin ?? config.owner;
  if (command === 'initialize-queue' || command === 'initialize-release')
    return (command === 'initialize-queue' ? queue.store : releaseStore).initialize({ baseSha: event.baseSha, confirmed: event.confirmed });
  if (['owner-decision', 'label', 'ready', 'enqueue'].includes(command)) {
    const issue = await api.getIssue(event.issue);
    if (['ready', 'enqueue'].includes(command) && await git.remoteHead(event.branch) !== event.materialSha)
      throw Error('Ready material differs from the current task branch');
    if (command === 'owner-decision' && !event.ownerDecision) throw Error('Explicit attributed owner decision required');
    return handleGithubEvent({ event: { ...event, kind: ['ready', 'enqueue'].includes(command) ? 'ready' : 'label' },
      issue, queue, owner, ownerDecision: event.ownerDecision, activated: true });
  }
  if (['admit', 'heartbeat', 'synchronized', 's6-complete', 'return', 'expire'].includes(command)) {
    if (command === 'synchronized') {
      const state = (await queue.store.read()).state, task = state.tasks[event.issue];
      if (!task || await git.remoteHead(git.dev) !== event.expectedBase || await git.remoteHead(task.branch) !== event.materialSha)
        throw Error('Synchronization differs from current dev/task heads');
      await git.ensureCommit(event.expectedBase); await git.ensureCommit(event.materialSha);
      await git.assertAncestor(event.expectedBase, event.materialSha);
    }
    if (command === 's6-complete' && event.outcome === 'passed' && !event.evidence) throw Error('Attach the actual S6 runner receipt');
    return { state: await queue.dispatch({ ...event, type: command }) };
  }
  if (command === 'reconcile-merged') return reconcileMergedLabel({ queue, api, issue: await api.getIssue(event.issue), activated: true });
  if (['reconcile', 'merge', 'review-complete'].includes(command)) {
    const active = (await queue.store.read()).state.active;
    if (command === 'merge' && active?.phase !== 'ready-to-merge') throw Error('Only an accepted admission can merge');
    if (command === 'review-complete' && active?.phase !== 'review') throw Error('No matching active review');
    if (command !== 'reconcile' && (event.issue !== active.issue || event.token !== active.token)) throw Error('Admission identity differs');
    return reconcileQueue({ queue, api, git, activated: true, worker: event.worker ?? 'github-coordinator', eventId: event.id,
      requestReview: context => review.requestReview(context), readReviewResult: context => review.readReviewResult(context) });
  }
  if (command === 'release-event') {
    if (['published', 'delivery-verified', 'publication-started', 'publication-failed'].includes(event.type))
      throw Error('Use the publication/observation command for actual delivery evidence');
    if (event.type === 'create') {
      const { state } = await releaseStore.read(), source = await git.resolveSource({ kind: event.kind, published: state.published });
      if (source.sourceSha !== event.sourceSha) throw Error('Candidate source differs from the selected release source');
      // Worktree creation is explicit, separate from state delivery retries.
    }
    if (event.type === 'accept-metrics' && event.ownerDecision?.actor !== owner) throw Error('Owner metrics decision attribution required');
    return { state: await releaseDispatch(releaseStore, event) };
  }
  let state = (await releaseStore.read()).state, candidate = state.candidates[event.candidate];
  if (!candidate) throw Error('Unknown release candidate');
  if (command === 'publish-prepared') {
    if (candidate.status !== 'published' && candidate.status !== 'publishing') {
      state = await releaseDispatch(releaseStore, { id: `${event.id}:started:${state.revision}`, type: 'publication-started',
        candidate: candidate.id, sha: candidate.sha, tag: event.tag });
      candidate = state.candidates[candidate.id];
    }
    if (event.tag && candidate.tag !== event.tag) throw Error('Publication retry cannot change the tag');
    const publisher = dependencies.publisher ?? new ReleasePublisher({ github: api, git, activated: true });
    try {
      const result = await publisher.publish({ candidate, tag: candidate.tag, artifacts: event.artifacts, body: event.body, expectedMain: event.expectedMain });
      if (!result.published) throw Error('Publication has no actual evidence');
      if (candidate.status !== 'published') state = await releaseDispatch(releaseStore, {
        id: `${event.id}:published`, type: 'published', candidate: candidate.id, sha: candidate.sha, evidence: result.evidence });
      return { ...result, state };
    } catch (error) {
      // If the final state write lost its response, preserve observed publication rather than reverting it.
      const latestState = (await releaseStore.read()).state, latest = latestState.candidates[candidate.id];
      if (latest.status === 'publishing') await releaseDispatch(releaseStore, { id: `${event.id}:failed:${latestState.revision}`, type: 'publication-failed',
        candidate: candidate.id, sha: candidate.sha, reason: error.message });
      throw error;
    }
  }
  if (command === 'verify-delivery') {
    if (candidate.status !== 'published') throw Error('Publish the candidate before observing HACS delivery');
    const hacsTokenName = config.hacs?.tokenEnv;
    if (!dependencies.verifier && (!hacsTokenName || !/^[A-Z][A-Z0-9_]*$/.test(hacsTokenName))) throw Error('Configure hacs.tokenEnv');
    const verifier = dependencies.verifier ?? new HacsDeliveryVerifier({ github: api,
      hacs: new HacsClient({ url: config.hacs?.url, token: env[hacsTokenName] }) });
    const evidence = await verifier.verify({ repository: `${config.owner}/${config.repo}`, tag: candidate.tag,
      assetName: event.assetName, expectedDigest: candidate.publication.artifactDigest });
    return { evidence, state: await releaseDispatch(releaseStore, { id: event.id, type: 'delivery-verified', candidate: candidate.id, evidence }) };
  }
  const issues = await Promise.all(candidate.includedIssues.map(number => api.getIssue(number)));
  const updates = releaseClosePlan(candidate, issues), completed = [];
  for (const update of updates) { await api.updateIssue(update.issue, update.change); completed.push(update.issue); }
  return { closed: completed };
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || !args.length) { process.stdout.write(help); return; }
  const [command, ...flags] = args, options = {};
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index];
    if (['--plan', '--execute'].includes(flag)) options[flag.slice(2)] = true;
    else if (['--config', '--event'].includes(flag) && flags[index + 1] && !flags[index + 1].startsWith('--')) options[flag.slice(2)] = flags[++index];
    else throw Error('Unknown/incomplete argument; credentials belong in environment variables');
  }
  if (options.plan && options.execute) throw Error('Choose --plan or --execute');
  if (!options.config || !options.event) throw Error('--config and --event JSON files required');
  const [config, event] = await Promise.all([options.config, options.event].map(async path => JSON.parse(await readFile(path, 'utf8'))));
  const result = await executeRemoteCommand({ command, config, event, execute: options.execute === true });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error => { process.stderr.write(error.message + '\n'); process.exitCode = 1; });
