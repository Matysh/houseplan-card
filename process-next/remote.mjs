#!/usr/bin/env node
import { readFile, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { GitHubClient, GitHubQueueStore } from './lib/github.mjs';
import { QueueController, StateConflict, ownerShip, queueSummary } from './lib/queue.mjs';
import { handleGithubEvent, reconcileQueue, reconcileMergedLabel, reconcileSpecReview, inspectTaskMaterial } from './lib/coordinator.mjs';
import { planProfile } from './lib/catalog.mjs';
import { runPlan } from './lib/runner.mjs';
import { WorkflowFallbackAdapter } from './lib/fallback.mjs';
import { initialReleaseState, reduceRelease, ReleaseGitAdapter, ReleasePublisher,
  HacsClient, HacsDeliveryVerifier, ReleaseDiscoveryVerifier, readRunnerReport, readPublishedMeasurement } from './lib/release.mjs';
import { reconcileTaskCompletions, notifyDevWebhook } from './lib/task-completion.mjs';
import { publishReviewReceipt } from './lib/review-publication.mjs';
import { prepareReleaseData, preparePublicationArtifacts } from './lib/release-preparation.mjs';
import { completePublishedRelease } from './lib/release-completion.mjs';
import { announceStableRelease } from './lib/notifications.mjs';
import { returnPublishedHistory } from './lib/return-worker.mjs';

const sha = value => /^[a-f0-9]{40}$/.test(value ?? '');
const component = encodeURIComponent;
export async function initializeMissingTrack(api, issue, track = 'show') {
  const labels = (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
  if (labels.some(label => /^track:(ship|show|ask)$/.test(label))) return issue;
  if (!['ship', 'show', 'ask'].includes(track)) throw Error('Unknown initial track');
  // Add only the absent track; never replace labels or reinterpret an existing choice.
  await api.request('POST', `${api.root}/issues/${issue.number}/labels`, { labels: [`track:${track}`] });
  return api.getIssue(issue.number);
}
export async function readReleaseMetrics({ root, sha: materialSha, path }) {
  let report;
  try { report = JSON.parse(await readFile(resolve(root, path ?? 'artifacts/process-next/metrics.json'), 'utf8')); }
  catch (error) { if (!path && error.code === 'ENOENT') return null; throw error; }
  if (report.sha !== materialSha) {
    if (path) throw Error('Metrics belong to another candidate');
    return null;
  }
  return report;
}
const commands = new Set(['initialize-queue', 'initialize-release', 'owner-decision', 'label', 'ready', 'enqueue',
  'admit', 'heartbeat', 'synchronized', 's6-complete', 'return', 'expire', 'review-complete', 'reconcile', 'merge',
  'reconcile-merged', 'reconcile-completions', 'dev-webhook', 'release-event', 'publish-prepared', 'complete-release', 'verify-delivery', 'close-included', 'status', 'finish', 'dev-build-complete', 'return-to-dev', 'measurement-baseline']);

export const help = `Houseplan process-next remote (disabled by default)
node process-next/remote.mjs COMMAND --config config.json --event event.json [--plan | --execute]

Queue: initialize-queue, owner-decision, label, ready (alias enqueue), admit,
       heartbeat, synchronized, s6-complete, return, expire, reconcile,
       review-complete, merge, reconcile-merged
Release: initialize-release, release-event, publish-prepared, complete-release, verify-delivery, close-included
Bookkeeping: reconcile-completions, dev-webhook (no tests or model calls)

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
s6-complete carries outcome and evidence; finish executes the selected local or hosted S6.
review-complete reads the matching trusted workflow report; it never trusts a supplied verdict.
reconcile performs ONE step (admit / await local S6 / request or read review / merge).
initialize-* requires event.confirmed=true and baseSha. release-event takes a reducer event;
published/delivery-verified are accepted only through actual publication/observation commands.
publish-prepared: {id,candidate,tag,reportPath?,packagePath?,expectedMain?}; uses authored candidate notes and completes delivery.
complete-release: {id,candidate}; resumes bookkeeping without publishing or testing again.
verify-delivery: {id,candidate,assetName}; close-included: {id,candidate}.
`;

/** Workflow input/result protocol. No test runner is exposed to S7.
 * Dispatch has no API idempotency key: the workflow also needs concurrency by requestId and
 * a preflight report-marker check. This adapter avoids redispatching an observed run/result.
 */
export class WorkflowReviewAdapter {
  constructor({ api, workflow = 'process-next-review.yml', ref = 'dev', commentAuthor = 'github-actions[bot]', maxPages = 20, readArtifact, clock = Date.now } = {}) {
    if (!/^[\w.-]+\.ya?ml$/.test(workflow) || !ref) throw Error('Review workflow/ref required');
    Object.assign(this, { api, workflow, ref, commentAuthor, maxPages, readArtifact, clock });
  }
  validate({ requestId, active, task, kind = 'code' }) {
    if (!/^[A-Za-z0-9:-]+$/.test(requestId ?? '') || !Number.isSafeInteger(active?.issue)
      || !sha(active.materialSha) || !sha(active.expectedBase) || !['code', 'spec'].includes(kind)) throw Error('Pinned review request required');
    if (kind === 'code' && ownerShip(task)) throw Error('Owner ship never requests individual code review');
  }
  async list(path, key, firstPage) {
    const rows = [];
    for (let page = 1; page <= this.maxPages; page++) {
      const response = page === 1 && firstPage ? firstPage : await this.api.request('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const batch = key ? response[key] : response;
      if (!Array.isArray(batch)) throw Error('Invalid review inventory');
      rows.push(...batch);
      if (Number.isSafeInteger(response.total_count) && rows.length >= response.total_count) return rows;
      if (batch.length < 100) {
        if (Number.isSafeInteger(response.total_count) && rows.length < response.total_count) throw Error('Review inventory incomplete; do not dispatch another uncertain request');
        return rows;
      }
    }
    throw Error('Review inventory incomplete; do not dispatch another uncertain request');
  }
  async runs() {
    // Match review.yml retention. GitHub caps each filtered search at 1000 runs;
    // split only crowded intervals rather than loading the lifetime history.
    const end = Math.floor(this.clock() / 1000), start = end - 60 * 24 * 60 * 60;
    const scan = async (from, to) => {
      const date = seconds => new Date(seconds * 1000).toISOString();
      const created = component(`${date(from)}..${date(to)}`);
      const path = `${this.api.root}/actions/workflows/${component(this.workflow)}/runs?event=workflow_dispatch&created=${created}`;
      const first = await this.api.request('GET', `${path}&per_page=100&page=1`);
      if (first.total_count > 1000) {
        if (from === to) throw Error('More than 1000 review runs in one second; inventory cannot establish a missing request');
        const middle = Math.floor((from + to) / 2);
        return [...await scan(middle + 1, to), ...await scan(from, middle)];
      }
      return this.list(path, 'workflow_runs', first);
    };
    return scan(start, end);
  }
  async artifactResult(run) {
    if (!run.id) return null;
    const artifacts = await this.list(`${this.api.root}/actions/runs/${run.id}/artifacts`, 'artifacts');
    const matches = artifacts.filter(row => row.name === 'review-result' && !row.expired);
    if (matches.length > 1) throw Error('Ambiguous review artifacts');
    if (!matches.length) return null;
    const artifact = matches[0];
    let payload;
    if (this.readArtifact) payload = await this.readArtifact(artifact, run);
    else {
      const directory = await mkdtemp(join(tmpdir(), 'hp-review-artifact-'));
      try {
        const archive = join(directory, 'result.zip');
        await writeFile(archive, await this.api.request('GET', `${this.api.root}/actions/artifacts/${artifact.id}/zip`, undefined, { binary: true }));
        const { readZipEntries } = await import('./lib/zip.mjs');
        const entry = readZipEntries(archive, ['result.json']).get('result.json');
        if (!entry) throw Error('Review artifact lacks result.json');
        payload = JSON.parse(entry.toString('utf8'));
      } finally { await rm(directory, { recursive: true, force: true }); }
    }
    return { ...payload, artifactId: artifact.id, runId: run.id, reportUrl: run.html_url };
  }
  checked(result, { requestId, active, kind = 'code' }) {
    if (result.requestId !== requestId || result.issue !== active.issue || result.kind !== kind
      || (result.materialSha !== active.materialSha && (!result.patchId || result.patchId !== active.patchId))
      || !['accepted', 'changes_requested', 'incomplete', 'not-required'].includes(result.verdict)) throw Error('Review report belongs to different material or has invalid verdict');
    return result;
  }
  async readReviewResult(context) {
    this.validate(context);
    const { requestId, active, task } = context;
    const escaped = requestId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const identity = new RegExp(`(?:^|[^A-Za-z0-9:-])${escaped}(?:$|[^A-Za-z0-9:-])`);
    const knownRunId = task.reviewRetry?.requestId === requestId ? task.reviewRetry.runId : null;
    const inventory = knownRunId ? [await this.api.request('GET', `${this.api.root}/actions/runs/${knownRunId}`)] : await this.runs();
    if (knownRunId && !identity.test(inventory[0].display_title ?? inventory[0].name ?? '')) throw Error('Known review run belongs to another request');
    const matches = inventory.filter(run => identity.test(run.display_title ?? run.name ?? ''))
      .sort((a, b) => Number(b.id) - Number(a.id));
    // A saved artifact is authoritative even while its workflow is finishing.
    // Readers never publish: the serialized coordinator owns that side effect.
    let incomplete = null;
    for (const run of matches) {
      const result = await this.artifactResult(run);
      if (result) {
        const checked = this.checked(result, context);
        if (checked.verdict !== 'incomplete') {
          return { ...checked, runId: run.id, runStatus: run.status, publicationPending: true };
        }
        if (!incomplete && run.status === 'completed') incomplete = { ...checked, retryable: true,
          runId: run.id, runAttempt: run.run_attempt ?? 1, runStatus: run.status, publicationPending: true };
      }
    }
    if (matches.some(run => run.status !== 'completed')) return { pending: true, requestId, materialSha: active.materialSha };
    if (incomplete) return incomplete;
    if (matches.length) return { retryable: true, verdict: 'incomplete', requestId, materialSha: active.materialSha, runId: matches[0].id, runAttempt: matches[0].run_attempt ?? 1, reportUrl: matches[0].html_url };
    return { missing: true, requestId, materialSha: active.materialSha };
  }
  /** Called only by the coordinator's existing serialized metadata sweep. */
  async publishCompletedReview(record) {
    const result = await this.readReviewResult({ kind: record.kind, requestId: record.requestId,
      active: { issue: record.issue, materialSha: record.materialSha, expectedBase: record.expectedBase, patchId: record.patchId },
      task: { track: 'show', reviewRetry: { requestId: record.requestId, runId: record.runId } } });
    if (!result?.verdict || result.runStatus !== 'completed') return { published: false, pending: true };
    return publishReviewReceipt({ api: this.api, receipt: result, reportUrl: result.reportUrl });
  }
  async readPreviousReviewResult({ issue, kind = 'code', excludeRequestId }) {
    const identity = new RegExp(`(?:^|[^A-Za-z0-9:-])${kind === 'spec' ? 'spec' : 'review'}:${issue}:`);
    const title = new RegExp(`${kind === 'spec' ? 'Ревью ТЗ' : 'Код-ревью'} задачи #?${issue}(?:\\D|$)`);
    const runs = (await this.runs()).filter(run => run.status === 'completed'
      && (identity.test(run.display_title ?? '') || title.test(run.display_title ?? ''))
      && !(excludeRequestId && (run.display_title ?? '').includes(excludeRequestId)))
      .sort((a, b) => Number(b.id) - Number(a.id));
    for (const run of runs) {
      const result = await this.artifactResult(run);
      if (result?.issue === issue && result.kind === kind && result.requestId !== excludeRequestId && result.report) return result;
    }
    return null;
  }
  async requestReview(context) {
    this.validate(context);
    const observed = await this.readReviewResult(context);
    if (observed.retryable && observed.runId) {
      if (!context.retry || observed.runAttempt >= 2) return { requested: false, observed, needsAttention: true };
      await this.api.request('POST', `${this.api.root}/actions/runs/${observed.runId}/rerun-failed-jobs`);
      return { requested: true, retry: true, requestId: context.requestId, runId: observed.runId };
    }
    if (!observed.missing) return { requested: false, observed };
    const { requestId, active, task, kind = 'code' } = context;
    const original = task.reviewRequest === requestId ? task.reviewMaterial : null;
    const inputs = { issue: String(active.issue), base: original?.expectedBase ?? active.expectedBase, head: original?.materialSha ?? active.materialSha,
      track: task.track, requestId, kind, patchId: original?.patchId ?? active.patchId ?? '',
      receipts: JSON.stringify(task.s6 ? (Array.isArray(task.s6) ? task.s6 : [task.s6]) : []) };
    if (Buffer.byteLength(JSON.stringify(inputs)) > 60_000) throw Error('S6 receipt is too large; supply a compact runner receipt');
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

async function finishBookkeeping({ queue, api, git, review, eventId, issue, publishReviews = false }) {
  try { return await reconcileTaskCompletions({ queue, api, git, activated: true, issue,
    eventId: `${eventId}:metadata:${randomUUID()}`,
    ...(publishReviews ? { publishReview: record => review.publishCompletedReview(record) } : {}) }); }
  catch (error) { return { pending: [{ issue, reason: error.message }], warning: 'Metadata remains pending; a completed merge is not repeated' }; }
}

/** Agent-facing route: one invocation owns queue wait, final sync, S6 and reconciliation. */
export async function finishTask({ config, event, queue, api, git, review, dependencies = {}, signal, onProgress = () => {},
  pollMs = 60000, maxWaitMs = 4 * 60 * 60_000 } = {}) {
  const clock = dependencies.clock ?? Date.now, started = clock(), inspect = dependencies.inspectMaterial ?? inspectTaskMaterial;
  if (!['local', 'github'].includes(event.s6 ?? 'local')) throw Error('S6 executor must be local or github');
  const branch = event.branch ?? await git.git(['symbolic-ref', '--short', 'HEAD']);
  if ([git.dev, 'main', queue.store.branch].includes(branch)) throw Error('Finish requires a separate task branch');
  let current = (await queue.store.read()).state;
  if (!current.tasks[event.issue]?.queued && current.active?.issue !== event.issue && current.tasks[event.issue]?.status !== 'S8-merged') {
    const materialSha = await git.remoteHead(branch), dev = await git.remoteHead(git.dev);
    await git.ensureCommit(dev); await git.ensureCommit(materialSha);
    const base = await git.git(['merge-base', dev, materialSha]);
    const material = await inspect(git, base, materialSha);
    const issue = await initializeMissingTrack(api, await api.getIssue(event.issue), event.track ?? event.request?.track);
    await handleGithubEvent({ queue, api, activated: true, issue,
      event: { ...event, ...material, branch, kind: 'ready' } });
  }
  const synchronize = async ({ task }) => {
    if (dependencies.synchronize) return dependencies.synchronize({ task });
    if (await git.git(['status', '--porcelain', '--untracked-files=no'])) throw Error('Commit tracked task changes before finish');
    if (await git.git(['symbolic-ref', '--short', 'HEAD']) !== task.branch) throw Error('Working checkout is not the admitted task branch');
    const expectedBase = await git.remoteHead(git.dev), previousHead = await git.remoteHead(task.branch);
    await git.ensureCommit(expectedBase); await git.ensureCommit(previousHead);
    const localHead = await git.git(['rev-parse', 'HEAD']);
    if (localHead !== previousHead) {
      const beforeBase = await git.git(['merge-base', expectedBase, previousHead]);
      const localBase = await git.git(['merge-base', expectedBase, localHead]);
      if ((await inspect(git, beforeBase, previousHead)).patchId !== (await inspect(git, localBase, localHead)).patchId)
        throw Error('Local branch changed after ready; do not overwrite the remote task');
    }
    try {
      if (task.syncMode === 'merge') {
        await git.assertAncestor(task.mergeSourceSha, localHead);
        await git.git(['merge', '--no-edit', expectedBase]);
      } else await git.git(['rebase', expectedBase]);
    } catch (error) {
      if (await git.git(['diff', '--name-only', '--diff-filter=U'])) return { conflict: true };
      throw error;
    }
    const materialSha = await git.git(['rev-parse', 'HEAD']);
    if (materialSha !== previousHead) try {
      await git.git(['push', `--force-with-lease=refs/heads/${task.branch}:${previousHead}`, git.remote, `${materialSha}:refs/heads/${task.branch}`]);
    } catch (error) { if (await git.remoteHead(task.branch) !== materialSha) throw error; }
    const material = await inspect(git, expectedBase, materialSha);
    return { ...material, review: task.releaseTag ? await git.publishedReturnReview({ task, ...material }) : null };
  };
  const runS6 = async ({ active, task }) => {
    if (event.s6 === 'github') {
      const fallback = dependencies.fallback ?? new WorkflowFallbackAdapter({ api, ...config.fallback });
      const result = await fallback.runS6({ active, task, request: { ...(event.request ?? {}),
        areaTests: event.areaTests ?? event.request?.areaTests ?? [] }, signal,
        onProgress: progress => onProgress({ kind: 'checks', ...progress }) });
      return { ...result, evidence: result.receipt };
    }
    if (dependencies.prepareEnvironment) await dependencies.prepareEnvironment();
    const plan = await (dependencies.planProfile ?? planProfile)({ ...(event.request ?? {}), root: config.workspace, event: 'task', issue: task.issue,
      track: task.track, ownerAssigned: ownerShip(task), layer: task.layer, changedFiles: task.changedFiles ?? [], areaTests: event.areaTests ?? event.request?.areaTests ?? [] });
    const report = await (dependencies.runPlan ?? runPlan)(plan, { root: config.workspace, stateDir: config.localStateDir,
      reuse: true, signal, onProgress: progress => onProgress({ kind: 'checks', ...progress }) });
    return { outcome: report.status, evidence: { id: report.id, reportPath: report.reportPath, materialSha: active.materialSha,
      status: report.status, finishedAt: report.finishedAt } };
  };
  let ownedAdmission = null;
  const heartbeat = setInterval(() => {
    if (ownedAdmission && ['sync', 'testing'].includes(ownedAdmission.phase)) queue.dispatch({ id: `finish:${randomUUID()}`, type: 'heartbeat',
      issue: event.issue, token: ownedAdmission.token }).catch(() => {});
  }, Math.min(60000, Math.max(1000, queue.leaseMs / 3))); heartbeat.unref();
  let sequence = 0;
  try {
    while (!signal?.aborted && clock() - started < maxWaitMs) {
      current = (await queue.store.read()).state;
      ownedAdmission = current.active?.issue === event.issue ? current.active : null;
      onProgress({ kind: 'queue', issue: event.issue, ...queueSummary(current), elapsedMs: clock() - started });
      if (current.tasks[event.issue]?.status === 'S8-merged') {
        const bookkeeping = await finishBookkeeping({ queue, api, git, review, eventId: event.id, issue: event.issue });
        return { action: 'merged', task: current.tasks[event.issue], bookkeeping };
      }
      if (!current.tasks[event.issue]?.queued && current.active?.issue !== event.issue) return { action: 'returned', task: current.tasks[event.issue] };
      const own = current.active?.issue === event.issue;
      // Waiting agents observe only; they never reconcile somebody else's task.
      if (current.active && !own) {
        await (dependencies.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(pollMs, signal);
        continue;
      }
      const result = await reconcileQueue({ queue, api, git, activated: true, eventId: `${event.id}:finish:${++sequence}`, worker: event.worker ?? 'finish',
        ...(own ? { synchronize, runS6 } : {}), requestReview: context => review.requestReview(context), readReviewResult: context => review.readReviewResult(context) });
      onProgress({ kind: 'transition', action: result.action, reason: result.reason });
      if (own && result.action === 'returned') return { ...result,
        bookkeeping: await finishBookkeeping({ queue, api, git, review, eventId: event.id, issue: event.issue }) };
      if (['admitted', 'synchronized', 'review', 'ready-to-merge', 'merged', 'expired'].includes(result.action)) continue;
      await (dependencies.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))))(pollMs, signal);
    }
    return { action: signal?.aborted ? 'interrupted' : 'waiting', summary: queueSummary((await queue.store.read()).state) };
  } finally { clearInterval(heartbeat); }
}

/** The injected dependencies make the exact binding testable without GitHub, HACS or a checkout.
 * All default execution is offline planning; supplying a config file cannot activate it.
 */
export async function executeRemoteCommand({ command, config = {}, event = {}, execute = false, env = process.env, dependencies = {}, signal, onProgress } = {}) {
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
  if (command === 'status') { const state = (await queue.store.read()).state; return { summary: queueSummary(state), task: event.issue ? state.tasks[event.issue] ?? null : undefined }; }
  if (command === 'finish') return finishTask({ config, event, queue, api, git, review, dependencies, signal, onProgress });
  if (command === 'reconcile-completions') return finishBookkeeping({ queue, api, git, review, eventId: event.id, issue: event.issue, publishReviews: true });
  if (command === 'dev-webhook') return notifyDevWebhook({ queue, activated: true, url: env.HP_HA_DEV_WEBHOOK,
    eventId: `${event.id}:${randomUUID()}`, fetchImpl: dependencies.fetchImpl });
  if (command === 'initialize-queue' || command === 'initialize-release')
    return (command === 'initialize-queue' ? queue.store : releaseStore).initialize({ baseSha: event.baseSha, confirmed: event.confirmed });
  if (['owner-decision', 'label', 'ready', 'enqueue'].includes(command)) {
    let issue = await api.getIssue(event.issue);
    const ready = ['ready', 'enqueue'].includes(command);
    if (ready && await git.remoteHead(event.branch) !== event.materialSha)
      throw Error('Ready material differs from the current task branch');
    if (ready) issue = await initializeMissingTrack(api, issue, event.track ?? event.ownerDecision?.track);
    if (command === 'owner-decision' && !event.ownerDecision) throw Error('Explicit attributed owner decision required');
    const result = await handleGithubEvent({ event: { ...event, kind: ['ready', 'enqueue'].includes(command) ? 'ready' : 'label' },
      issue, queue, owner, ownerDecision: event.ownerDecision, activated: true });
    if (result.action === 'spec-review-required') return reconcileSpecReview({ queue, api, git, issue, eventId: event.id, activated: true,
      requestReview: context => review.requestReview(context), readReviewResult: context => review.readReviewResult(context) });
    return result;
  }
  if (['admit', 'heartbeat', 'synchronized', 's6-complete', 'return', 'expire'].includes(command)) {
    if (command === 'synchronized') {
      const state = (await queue.store.read()).state, task = state.tasks[event.issue];
      if (!task || await git.remoteHead(git.dev) !== event.expectedBase || await git.remoteHead(task.branch) !== event.materialSha)
        throw Error('Synchronization differs from current dev/task heads');
      const material = await (dependencies.inspectMaterial ?? inspectTaskMaterial)(git, event.expectedBase, event.materialSha);
      event = { ...event, ...material, review: task.releaseTag ? await git.publishedReturnReview({ task, ...material }) : null };
    }
    if (command === 's6-complete' && event.outcome === 'passed' && !event.evidence) throw Error('Attach the actual S6 runner receipt');
    return { state: await queue.dispatch({ ...event, type: command }) };
  }
  if (command === 'reconcile-merged') return reconcileMergedLabel({ queue, api, issue: await api.getIssue(event.issue), activated: true });
  if (command === 'dev-build-complete') {
    const source = await git.remoteHead('dev-build'); await git.ensureCommit(source);
    const marker = JSON.parse(await git.git(['show', `${source}:DEV-BUILD.json`]));
    const snapshot = (await queue.store.read()).state, task = snapshot.tasks[event.issue];
    if (task?.status !== 'S8-merged' || !sha(marker.source)) throw Error('Actual dev-build publication required');
    await git.ensureCommit(marker.source);
    await git.assertAncestor(task.mergedSha, marker.source);
    let state = snapshot;
    if ((env.HP_HA_DEV_WEBHOOK || event.webhookPending) && snapshot.devWebhook?.integrationTree !== marker.integrationTree)
      state = await queue.dispatch({ id: `${event.id}:webhook`, type: 'dev-webhook',
        sourceSha: marker.source, integrationTree: marker.integrationTree, status: 'pending' });
    for (const covered of Object.values(snapshot.tasks).filter(item => item.status === 'S8-merged' && item.devBuild?.status === 'pending')) {
      try { await git.assertAncestor(covered.mergedSha, marker.source); } catch { continue; }
      state = await queue.dispatch({ id: `${event.id}:${covered.issue}`, type: 'dev-build', issue: covered.issue, materialSha: covered.mergedSha, status: 'published' });
    }
    return { state };
  }
  if (['reconcile', 'merge', 'review-complete'].includes(command)) {
    const active = (await queue.store.read()).state.active;
    if (command === 'merge' && active?.phase !== 'ready-to-merge') throw Error('Only an accepted admission can merge');
    if (command === 'review-complete' && active?.phase !== 'review') throw Error('No matching active review');
    if (command !== 'reconcile' && (event.issue !== active.issue || event.token !== active.token)) throw Error('Admission identity differs');
    return reconcileQueue({ queue, api, git, activated: true, worker: event.worker ?? 'github-coordinator', eventId: event.id,
      requestReview: context => review.requestReview(context), readReviewResult: context => review.readReviewResult(context) });
  }
  if (command === 'release-event') {
    if (['published', 'delivery-verified', 'publication-started', 'publication-failed', 'release-prepared', 'completion-step', 'announcement'].includes(event.type))
      throw Error('Use the publication/observation command for actual delivery evidence');
    if (event.type === 'create') {
      const { state } = await releaseStore.read(), source = await git.resolveSource({ kind: event.kind, published: state.published });
      if (source.sourceSha !== event.sourceSha) throw Error('Candidate source differs from the selected release source');
      const data = await (dependencies.prepareReleaseData ?? prepareReleaseData)({ git, candidateSha: source.sourceSha,
        baseSha: state.published.stable?.sha ?? null, kind: event.kind, tag: event.tag, texts: false,
        previousMembership: event.kind !== 'hotfix' ? state.candidates[state.published.beta?.id]?.membership : undefined,
        tasks: Object.values((await queue.store.read()).state.tasks) });
      event = { ...event, ...data };
      // Worktree creation is explicit, separate from state delivery retries.
    }
    if (event.type === 'fix') {
      const { state } = await releaseStore.read(), candidate = state.candidates[event.candidate];
      if (!candidate) throw Error('Unknown release candidate');
      const data = await (dependencies.prepareReleaseData ?? prepareReleaseData)({ git, candidateSha: event.sha,
        baseSha: candidate.membership?.base ?? state.published.stable?.sha ?? null, kind: candidate.kind, texts: false,
        previousMembership: candidate.membership,
        tasks: Object.values((await queue.store.read()).state.tasks) });
      event = { ...event, ...data };
    }
    return { state: await releaseDispatch(releaseStore, event) };
  }
  if (command === 'measurement-baseline') {
    const stable = (await releaseStore.read()).state.published.stable;
    if (!stable) return { status: 'absent', diagnostic: true, reason: 'No published stable measurement source recorded' };
    const path = resolve(config.workspace, event.path ?? `process-next/.state/baselines/${stable.tag}.json`);
    const outputTree = resolve(config.workspace, 'artifacts/process-next');
    if (!relative(outputTree, path).startsWith('..')) throw Error('Baseline must be stored outside the current measurement outputs');
    let measurement;
    try { measurement = await readPublishedMeasurement(api, { tag: stable.tag, sha: stable.sha }); }
    catch (error) { return { status: 'absent', diagnostic: true, reason: error.message }; }
    await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(measurement, null, 2) + '\n');
    return { status: 'downloaded', tag: stable.tag, sha: stable.sha, path };
  }
  let state = (await releaseStore.read()).state, candidate = state.candidates[event.candidate];
  if (!candidate) throw Error('Unknown release candidate');
  const observeDelivery = async ({ candidate: item, assetName = 'houseplan.zip' }) => {
    let verifier = dependencies.verifier;
    if (!verifier && config.hacs?.mode === 'instance') {
      const tokenEnv = config.hacs?.tokenEnv, url = config.hacs?.url || env.HA_URL;
      if (!tokenEnv || !/^[A-Z][A-Z0-9_]*$/.test(tokenEnv) || !url || !env[tokenEnv])
        throw Error('Explicit HACS instance observation requires its URL and token environment variable');
      verifier = new HacsDeliveryVerifier({ github: api, hacs: new HacsClient({ url, token: env[tokenEnv] }) });
    }
    verifier ??= new ReleaseDiscoveryVerifier({ github: api });
    const request = { repository: `${config.owner}/${config.repo}`, tag: item.tag, kind: item.kind,
      assetName, expectedDigest: item.publication.artifactDigest, signal, onProgress };
    return verifier.wait ? verifier.wait(request) : verifier.verify(request);
  };
  const complete = async item => {
    const update = async change => {
      state = await releaseDispatch(releaseStore, { ...change, id: `${event.id}:completion:${randomUUID()}` });
      return state.candidates[item.id];
    };
    const completion = await completePublishedRelease({ candidate: item, api, git, verifyDelivery: observeDelivery,
      onUpdate: update, onProgress,
      returnToDev: dependencies.returnToDev ?? (async ({ candidate: released, previous }) => returnPublishedHistory({
        candidate: released, previous, api, git, queue, config: { ...config, returnIssue: event.returnIssue ?? config.returnIssue },
        onUpdate: update, onProgress, signal,
        finish: async ({ config: localConfig, event: returnEvent, prepareEnvironment }) => {
          const localGit = new ReleaseGitAdapter({ cwd: localConfig.workspace, remote: git.remote, dev: git.dev, activated: true });
          return finishTask({ config: localConfig, event: returnEvent, queue, api, git: localGit, review, signal, onProgress,
            dependencies: { prepareEnvironment } });
        } })),
      announce: dependencies.announce ?? (({ candidate: released, persist }) => {
        const tokenEnv = config.telegram?.tokenEnv ?? 'TELEGRAM_BOT_TOKEN', chatEnv = config.telegram?.chatEnv ?? 'TELEGRAM_CHAT_ID';
        if (![tokenEnv, chatEnv].every(name => /^[A-Z][A-Z0-9_]*$/.test(name))) throw Error('Use Telegram credential environment-variable names');
        return announceStableRelease({ candidate: released, userChangelog: released.releaseData?.userChangelog?.ru,
          token: env[tokenEnv], chat: env[chatEnv], persist, retryAmbiguous: event.retryAmbiguousAnnouncement === true,
          fetchImpl: dependencies.fetchImpl });
      }) });
    return { published: true, completion, state: (await releaseStore.read()).state };
  };
  if (command === 'complete-release' || command === 'close-included'
    || command === 'publish-prepared' && candidate.status === 'published') return complete(candidate);
  if (command === 'return-to-dev') {
    const prepared = await git.prepareDevReturn({ candidate, issue: event.issue, branch: event.branch, worktree: event.worktree });
    if (prepared.alreadyIncluded) {
      const verified = await git.verifyDevReturn(candidate.sha);
      return { ...prepared, state: await releaseDispatch(releaseStore, { id: event.id, type: 'port-completed', candidate: candidate.id, fixSha: candidate.sha, devSha: verified.devSha }) };
    }
    const issue = await initializeMissingTrack(api, await api.getIssue(event.issue), 'show');
    const tracks = (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name).filter(label => /^track:(ship|show|ask)$/.test(label));
    if (tracks.length !== 1) throw Error('Resolve conflicting track labels');
    prepared.task.track = tracks[0].slice(6);
    return { ...prepared, queue: await queue.dispatch({ id: event.id, type: 'enqueue', task: prepared.task }) };
  }
  if (command === 'publish-prepared') {
    const resumingPublication = ['publishing', 'publication-retry'].includes(candidate.status);
    if (!resumingPublication && event.reportPath) {
      const report = await readRunnerReport(resolve(config.workspace ?? '.', event.reportPath));
      state = await releaseDispatch(releaseStore, { id: `${event.id}:runner-report`, type: 'runner-report', candidate: candidate.id, report });
      candidate = state.candidates[candidate.id];
    }
    if (!resumingPublication && ['beta', 'stable'].includes(candidate.kind) && (event.reportPath || event.metricsPath)) {
      const metrics = await readReleaseMetrics({ root: config.workspace ?? '.', sha: candidate.sha, path: event.metricsPath });
      if (metrics) {
        state = await releaseDispatch(releaseStore, { id: `${event.id}:metrics`, type: 'metrics', candidate: candidate.id, sha: candidate.sha, report: metrics });
        candidate = state.candidates[candidate.id];
      }
    }
    const tag = candidate.tag ?? event.tag;
    const data = candidate.releaseData ?? await (dependencies.prepareReleaseData ?? prepareReleaseData)({ git, candidateSha: candidate.sha,
      baseSha: candidate.membership?.base ?? state.published.stable?.sha ?? null, kind: candidate.kind, tag,
      previousMembership: candidate.membership,
      tasks: Object.values((await queue.store.read()).state.tasks) });
    state = await releaseDispatch(releaseStore, { id: `${event.id}:prepared:${randomUUID()}`, type: 'release-prepared',
      candidate: candidate.id, sha: candidate.sha, data });
    candidate = state.candidates[candidate.id];
    const artifacts = event.artifacts ?? preparePublicationArtifacts({ root: config.workspace,
      packageResult: JSON.parse(await readFile(resolve(config.workspace, event.packagePath ?? 'artifacts/process-next/package.json'), 'utf8')),
      candidate: { ...candidate, tag } });
    const expectedMain = event.expectedMain ?? (candidate.kind === 'beta' ? undefined : await git.remoteHead('main'));
    if (candidate.status !== 'published' && candidate.status !== 'publishing') {
      state = await releaseDispatch(releaseStore, { id: `${event.id}:started:${state.revision}`, type: 'publication-started',
        candidate: candidate.id, sha: candidate.sha, tag });
      candidate = state.candidates[candidate.id];
    }
    if (event.tag && candidate.tag !== event.tag) throw Error('Publication retry cannot change the tag');
    const publisher = dependencies.publisher ?? new ReleasePublisher({ github: api, git, activated: true });
    try {
      const result = await publisher.publish({ candidate, tag: candidate.tag, artifacts, body: candidate.releaseData.body, expectedMain,
        measurementPath: event.measurementPath ?? (candidate.kind === 'stable' ? resolve(config.workspace, 'artifacts/process-next/measurement.json') : undefined) });
      if (!result.published) throw Error('Publication has no actual evidence');
      if (candidate.status !== 'published') state = await releaseDispatch(releaseStore, {
        id: `${event.id}:published`, type: 'published', candidate: candidate.id, sha: candidate.sha, evidence: result.evidence });
      return { ...result, ...await complete(state.candidates[candidate.id]) };
    } catch (error) {
      // If the final state write lost its response, preserve observed publication rather than reverting it.
      const latestState = (await releaseStore.read()).state, latest = latestState.candidates[candidate.id];
      if (latest.status === 'publishing') await releaseDispatch(releaseStore, { id: `${event.id}:failed:${latestState.revision}`, type: 'publication-failed',
        candidate: candidate.id, sha: candidate.sha, reason: error.message });
      throw error;
    }
  }
  if (command === 'verify-delivery') {
    if (candidate.status !== 'published') throw Error('Publish the candidate before observing release delivery');
    const evidence = await observeDelivery({ candidate, assetName: event.assetName });
    if (evidence.status === 'waiting') return evidence;
    return { evidence, state: await releaseDispatch(releaseStore, { id: event.id, type: 'delivery-verified', candidate: candidate.id, evidence }) };
  }
  throw Error('Unsupported release operation');
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
