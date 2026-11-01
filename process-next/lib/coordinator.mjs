import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LeaseLost, StateConflict, ownerDecisionRecord, ownerShip, queueSummary } from './queue.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const names = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
export const issueStatus = issue => names(issue).find(name => /^S[1-8]-/.test(name));
export function devBuildTarget(state, currentDevSha) {
  const pending = Object.values(state.tasks).filter(task => task.status === 'S8-merged' && task.devBuild?.status === 'pending').sort((a, b) => b.mergedAt - a.mergedAt);
  return pending.length ? { sha: currentDevSha, issue: pending[0].issue } : null;
}
const stopped = issue => issue.state === 'closed' || names(issue).includes('blocked');
const knownKinds = new Map(JSON.parse(readFileSync(new URL('../catalog/inventory.json', import.meta.url), 'utf8')).entries.map(entry => [entry.path, entry.kind]));

export function taskLayerFromDiff(files) {
  const source = files.filter(Boolean);
  const doc = file => /\.md$/i.test(file) || /^(?:LICENSE|NOTICE)(?:\.[^/]+)?$/.test(file)
    || /^docs\/.*\.(?:png|jpe?g|webp|svg|gif|pdf)$/i.test(file);
  if (source.every(doc)) return 'docs';
  if (source.some(file => {
    if (['infrastructure', 'converter', 'product-meta'].includes(knownKinds.get(file))) return false;
    return /^(?:src|custom_components|assets|demo|test|tests_backend)\//.test(file) || file === 'docs/data-hp-contract.json'
      || /^(?:package(?:-lock)?\.json|rollup\.config\.[cm]?js|tsconfig(?:\.[\w-]+)?\.json)$/.test(file);
  })) return 'product';
  return 'infra';
}
export async function inspectTaskMaterial(git, expectedBase, materialSha) {
  await git.ensureCommit(expectedBase); await git.ensureCommit(materialSha);
  await git.assertAncestor(expectedBase, materialSha);
  const changedFiles = (await git.git(['diff', '--name-only', '-z', expectedBase, materialSha])).split('\0').filter(Boolean);
  const patch = await git.git(['diff', '--binary', expectedBase, materialSha]);
  const identity = patch ? (await git.git(['patch-id', '--stable'], { input: patch + '\n' })).split(/\s/)[0] : digest('empty-patch');
  return { expectedBase, materialSha, changedFiles, layer: taskLayerFromDiff(changedFiles), patchId: identity };
}

/** Labels and shared GitHub login are observations, never an owner exemption. */
export async function handleGithubEvent({ event, issue, queue, ownerDecision, activated = false }) {
  if (!event?.id || !issue?.number) throw Error('Delivery and current issue snapshot required');
  const decision = ownerDecision ? ownerDecisionRecord(ownerDecision) : null;
  if (decision && activated) await queue.dispatch({ id: `${event.id}:owner-track`, type: 'owner-track', issue: issue.number, ...decision });
  if (stopped(issue)) return { action: 'stopped', issue: issue.number };
  if (event.kind !== 'ready') return { action: decision ? 'owner-decision-recorded' : issueStatus(issue) === 'S4-spec-review' ? 'spec-review-required' : 'reconcile', issue: issue.number, ...(!activated && decision ? { planned: true } : {}) };
  if (issueStatus(issue) !== 'S6-in-progress') throw Error('Ready intent needs current S6');
  const tracks = names(issue).filter(name => /^track:(ship|show|ask)$/.test(name)).map(name => name.slice(6));
  const stored = (await queue.store.read()).state, saved = stored.ownerDecisions?.[issue.number];
  if (tracks.length > 1 && !decision && !saved) throw Error('Resolve ambiguous track labels');
  const task = { issue: issue.number, track: decision?.track ?? saved?.track ?? tracks[0] ?? 'show',
    layer: event.layer, branch: event.branch, materialSha: event.materialSha,
    ...(event.syncMode === 'merge' ? { syncMode: 'merge', mergeSourceSha: event.mergeSourceSha } : {}) };
  if (!activated) return { planned: true, action: 'enqueue', task };
  return { action: 'queued', state: await queue.dispatch({ id: event.id, type: 'enqueue', task }) };
}

export async function reconcileSpecReview({ queue, api, git, issue, requestReview, readReviewResult, eventId, activated = false }) {
  if (stopped(issue) || issueStatus(issue) !== 'S4-spec-review') return { action: 'unchanged' };
  const initial = (await queue.store.read()).state, explicit = initial.ownerDecisions?.[issue.number];
  if (explicit?.track === 'ship') {
    if (activated) await api.moveStatus(issue.number, 'S5-ready', issue.labels);
    return { action: 'spec-not-required', planned: !activated, reason: 'explicit-owner-ship' };
  }
  const comments = [];
  for (let page = 1; page <= 20; page++) {
    const rows = await api.request('GET', `${api.root}/issues/${issue.number}/comments?per_page=100&page=${page}`);
    comments.push(...rows); if (rows.length < 100) break;
    if (page === 20) throw Error('Incomplete specification discussion');
  }
  const material = { body: issue.body ?? '', comments: comments.filter(row => !(row.user?.type === 'Bot' && /^<!-- process-next-review:/.test(row.body ?? '')))
    .map(row => ({ id: row.id, body: row.body, updated_at: row.updated_at })) };
  const contextDigest = digest(material), requestId = `spec:${issue.number}:${contextDigest}`;
  const state = (await queue.store.read()).state, saved = state.specReviews?.[issue.number];
  if (!activated) return { action: 'spec-review', planned: true, issue: issue.number, requestId };
  if (saved?.requestId === requestId && ['accepted', 'changes_requested'].includes(saved.status)) {
    await api.moveStatus(issue.number, saved.status === 'accepted' ? 'S5-ready' : 'S3-spec', issue.labels);
    return { action: 'spec-complete', verdict: saved.status };
  }
  const base = saved?.requestId === requestId ? saved.base : await git.remoteHead(git.dev);
  const decision = state.ownerDecisions?.[issue.number];
  const task = { issue: issue.number, track: decision?.track ?? names(issue).find(name => name.startsWith('track:'))?.slice(6) ?? 'show', ownerAssigned: !!decision, ownerDecision: decision };
  const context = { kind: 'spec', requestId, active: { issue: issue.number, materialSha: base, expectedBase: base, patchId: contextDigest }, task };
  if (saved?.requestId !== requestId) await queue.dispatch({ id: `${eventId}:spec-request`, type: 'spec-requested', issue: issue.number,
    request: { requestId, contextDigest, base } });
  const result = await readReviewResult(context);
  if (!result || result.missing || result.retryable || result.verdict === 'incomplete') {
    await requestReview(context); return { action: 'spec-review-requested', requestId };
  }
  if (result.pending) return { action: 'spec-review-pending', requestId };
  if (!['accepted', 'changes_requested'].includes(result.verdict)) return { action: 'spec-review-pending', requestId };
  await queue.dispatch({ id: `${eventId}:spec-complete`, type: 'spec-complete', issue: issue.number, requestId, verdict: result.verdict, reportUrl: result.reportUrl });
  await api.moveStatus(issue.number, result.verdict === 'accepted' ? 'S5-ready' : 'S3-spec', issue.labels);
  return { action: 'spec-complete', verdict: result.verdict };
}

/** One resumable transition. Infrastructure failures preserve material/evidence. */
export async function reconcileQueue({ queue, api, git, activated = false, worker = 'coordinator', eventId,
  synchronize, runS6, requestReview, readReviewResult, publishDevBuild } = {}) {
  if (!eventId) throw Error('Reconciliation delivery ID required');
  let snapshot = await queue.store.read();
  if (!activated) return { planned: true, action: snapshot.state.active?.phase ?? 'admit', state: snapshot.state };
  if (!snapshot.state.active) {
    const state = await queue.dispatch({ id: `${eventId}:admit`, type: 'admit', worker });
    return { action: state.active ? 'admitted' : 'idle', state, summary: queueSummary(state) };
  }
  const active = snapshot.state.active, task = snapshot.state.tasks[active.issue];
  const dispatch = (type, extra = {}) => queue.dispatch({ id: `${eventId}:${type}`, type, issue: active.issue, token: active.token, ...extra });
  if (active.expiresAt <= queue.clock()) return { action: 'expired', state: await queue.dispatch({ id: `${eventId}:expire`, type: 'expire' }) };
  const pending = async (reason, error) => ({ action: 'automation-pending', reason, ...(error ? { error: error.message } : {}),
    state: await dispatch('automation-pending', { reason }) });
  let issue;
  try { issue = await api.getIssue(active.issue); }
  catch (error) { return pending('github-unavailable', error); }
  const returned = async reason => {
    const outcome = { action: 'returned', reason, state: await dispatch('return', { reason }) };
    if (!['owner-stopped', 'status-changed'].includes(reason) && issueStatus(issue) === 'S7-code-review') {
      try { await api.moveStatus(active.issue, 'S6-in-progress', issue.labels); }
      catch { outcome.warning = 'Return label needs reconciliation'; }
    }
    return outcome;
  };
  if (stopped(issue)) return returned('owner-stopped');
  try {
    const expectedStatus = ['review', 'ready-to-merge'].includes(active.phase) && !ownerShip(task) ? 'S7-code-review' : 'S6-in-progress';
    if (issueStatus(issue) !== expectedStatus) {
      if (['S6-in-progress', 'S7-code-review'].includes(issueStatus(issue))) await api.moveStatus(active.issue, expectedStatus, issue.labels);
      else return returned('status-changed');
    }
    if (active.phase === 'sync') {
      if (!synchronize) return { action: 'synchronize-required', active, task };
      const result = await synchronize({ active, task });
      if (result.conflict) return returned('rebase-conflict');
      return { action: 'synchronized', state: await dispatch('synchronized', result) };
    }
    if (active.phase === 'testing') {
      if (task.layer !== 'docs' && !runS6) return { action: 's6-required', active, task };
      const result = task.layer === 'docs' ? { outcome: 'not-required' } : await runS6({ active, task });
      if (result.outcome === 'failed') return returned('checks-failed');
      if (!['passed', 'not-required'].includes(result.outcome)) return pending('checks-unavailable');
      const state = await dispatch('s6-complete', { materialSha: active.materialSha, ...result });
      const warnings = [];
      if (state.tasks[active.issue].status === 'S7-code-review') try { await api.moveStatus(active.issue, 'S7-code-review', issue.labels); }
      catch { warnings.push('S6 accepted; S7 label needs reconciliation'); }
      return { action: state.active.phase, state, warnings };
    }
    if (active.phase === 'review') {
      const context = { active, task, kind: 'code' };
      if (!active.reviewRequest) {
        if (!requestReview) return { action: 'review-required', active, task };
        const requestId = task.reviewRequest ?? `review:${active.issue}:${active.patchId ?? active.materialSha}:${active.expectedBase}`;
        const state = await dispatch('review-requested', { materialSha: active.materialSha, requestId });
        await requestReview({ ...context, requestId }); return { action: 'review-requested', state };
      }
      if (!readReviewResult) return { action: 'review-pending', active, task };
      const result = await readReviewResult({ ...context, requestId: active.reviewRequest });
      if (!result || result.missing || result.retryable || result.verdict === 'incomplete') {
        if (requestReview) await requestReview({ ...context, requestId: active.reviewRequest });
        return { action: 'review-request-ensured', state: await dispatch('heartbeat') };
      }
      if (result.pending) return { action: 'review-pending', state: await dispatch('heartbeat'), task };
      if ((result.materialSha !== active.materialSha && result.patchId !== active.patchId) || result.requestId !== active.reviewRequest)
        throw Error('Review belongs to another request/material');
      if (['changes_requested', 'changes-requested'].includes(result.verdict)) return returned('review-findings');
      if (result.verdict !== 'accepted') return pending('review-incomplete');
      return { action: 'ready-to-merge', state: await dispatch('review-complete', { materialSha: active.materialSha, verdict: 'accepted', review: result }) };
    }
    if (active.phase === 'ready-to-merge') {
      if (git.remoteHead && await git.remoteHead(git.dev) !== active.expectedBase)
        return { action: 'synchronize-required', state: await dispatch('resynchronize') };
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        snapshot = await queue.assertAdmission({ issue: active.issue, token: active.token, materialSha: active.materialSha });
        if (!snapshot.headSha && !snapshot.version?.headSha) throw Error('Remote merge requires a Git-backed queue fence');
        try {
          result = await git.merge({ expectedBase: active.expectedBase, materialSha: active.materialSha, branch: task.branch,
            fence: { state: snapshot.state, headSha: snapshot.headSha ?? snapshot.version.headSha, branch: queue.store.branch,
              path: queue.store.path, issue: active.issue, token: active.token, eventId: `${eventId}:merged` } }); break;
        } catch (error) {
          if (!(error instanceof StateConflict)) throw error;
          const refreshed = await queue.assertAdmission({ issue: active.issue, token: active.token, materialSha: active.materialSha });
          if (refreshed.state.active.expectedBase !== active.expectedBase || await git.remoteHead(git.dev) !== active.expectedBase || await git.remoteHead(task.branch) !== active.materialSha) throw error;
          if (attempt === 1) return { action: 'merge-pending', reason: 'queue-metadata-busy', active: refreshed.state.active };
        }
      }
      if (result.planned) return result;
      if (!result.merged || !result.statePersisted) throw Error('Merge did not atomically complete the queue');
      const warnings = [...(result.warnings ?? [])];
      try { await api.moveStatus(active.issue, 'S8-merged', issue.labels); } catch { warnings.push('Merge completed; S8 label needs reconciliation'); }
      if (publishDevBuild) try { await publishDevBuild({ issue: active.issue, materialSha: active.materialSha }); }
      catch { warnings.push('Merge completed; dev-build publication needs retry'); }
      return { action: 'merged', ...result, warnings };
    }
    throw Error('Unknown admitted phase');
  } catch (error) {
    if (error instanceof LeaseLost) return { action: 'admission-lost', reason: error.message };
    const latest = (await queue.store.read()).state;
    if (latest.tasks[active.issue]?.status === 'S8-merged') return { action: 'merged', state: latest, warning: 'Post-merge reporting needs reconciliation' };
    if (latest.active?.token !== active.token) return { action: 'admission-lost' };
    return pending('automation-error', error);
  }
}

export async function reconcileMergedLabel({ queue, api, issue, activated = false }) {
  const task = (await queue.store.read()).state.tasks[issue.number];
  if (task?.status !== 'S8-merged' || issueStatus(issue) === 'S8-merged') return { action: 'unchanged' };
  if (!activated) return { planned: true, action: 'label-S8', issue: issue.number };
  await api.moveStatus(issue.number, 'S8-merged', issue.labels);
  return { action: 'label-S8', issue: issue.number };
}
