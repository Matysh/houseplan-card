import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { LeaseLost, StateConflict, ownerDecisionRecord, queueSummary, REVIEW_RETRY_VISIBILITY_MS } from './queue.mjs';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const names = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
export const issueStatus = issue => names(issue).find(name => /^S[1-8]-/.test(name));
export function devBuildTarget(state, currentDevSha) {
  const pending = Object.values(state.tasks).filter(task => task.status === 'S8-merged' && task.devBuild?.status === 'pending').sort((a, b) => b.mergedAt - a.mergedAt);
  return pending.length ? { sha: currentDevSha, issue: pending[0].issue } : null;
}
const stopped = issue => issue.state === 'closed' || names(issue).includes('blocked');
function pendingPresentation(result, { issue, kind, requestId, materialSha, expectedBase, patchId }) {
  return result?.publicationPending ? { issue, kind, requestId, materialSha, expectedBase,
    ...(patchId ? { patchId } : {}), ...(result.runId ? { runId: result.runId } : {}),
    ...(result.verdict === 'incomplete' && result.markdown ? { receipt: result,
      resultKey: `incomplete:${result.runId ?? 'saved'}:${result.runAttempt ?? 1}` } : {}) } : null;
}
async function observeTransition(queue, event) {
  // Reporting cannot undo a successful label mutation or hold a task slot.
  try { await queue.dispatch({ ...event, type: 'transition-observed' }); } catch { /* Next publication reports current state honestly. */ }
}
function installedTrack(issue) {
  const tracks = names(issue).filter(name => /^track:(ship|show|ask)$/.test(name)).map(name => name.slice(6));
  if (tracks.length > 1) throw Error('Resolve conflicting track labels; automation does not change an installed track');
  return tracks[0];
}
function retryStillBecomingVisible(retry, result, now) {
  if (result?.runId && retry.runId && result.runId !== retry.runId) return false;
  if (Number.isFinite(result?.runAttempt) && Number.isFinite(retry.runAttempt) && result.runAttempt > retry.runAttempt) return false;
  return now - retry.at < REVIEW_RETRY_VISIBILITY_MS;
}
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

/** The installed label is authoritative; agents only initialize a missing track. */
export async function handleGithubEvent({ event, issue, queue, ownerDecision, activated = false }) {
  if (!event?.id || !issue?.number) throw Error('Delivery and current issue snapshot required');
  const decision = ownerDecision ? ownerDecisionRecord(ownerDecision) : null;
  if (decision && activated) await queue.dispatch({ id: `${event.id}:owner-track`, type: 'owner-track', issue: issue.number, ...decision });
  if (stopped(issue)) return { action: 'stopped', issue: issue.number };
  const track = installedTrack(issue);
  if (track && activated) await queue.dispatch({ id: `${event.id}:track-observed`, type: 'track-observed', issue: issue.number, track });
  if (event.kind !== 'ready') return { action: decision ? 'owner-decision-recorded' : issueStatus(issue) === 'S4-spec-review' ? 'spec-review-required' : 'reconcile', issue: issue.number, ...(!activated && decision ? { planned: true } : {}) };
  if (issueStatus(issue) !== 'S6-in-progress') throw Error('Ready intent needs current S6');
  const stored = (await queue.store.read()).state, saved = stored.ownerDecisions?.[issue.number];
  const task = { issue: issue.number, track: track ?? decision?.track ?? saved?.track ?? event.track ?? 'show',
    layer: event.layer, branch: event.branch, materialSha: event.materialSha,
    ...(event.syncMode === 'merge' ? { syncMode: 'merge', mergeSourceSha: event.mergeSourceSha } : {}) };
  if (!activated) return { planned: true, action: 'enqueue', task };
  return { action: 'queued', state: await queue.dispatch({ id: event.id, type: 'enqueue', task }) };
}

export async function reconcileSpecReview({ queue, api, git, issue, requestReview, readReviewResult, eventId, activated = false }) {
  if (stopped(issue) || issueStatus(issue) !== 'S4-spec-review') return { action: 'unchanged' };
  // Reaching S4 without a track must not silently waive the requested spec review.
  const track = installedTrack(issue) ?? 'ask';
  if (track !== 'ask') {
    if (activated) {
      await api.moveStatus(issue.number, 'S5-ready', issue.labels);
      await observeTransition(queue, { id: `${eventId}:spec-skip`, issue: issue.number, kind: 'spec-skipped', track,
        fromStatus: 'S4-spec-review', toStatus: 'S5-ready' });
    }
    return { action: 'spec-not-required', planned: !activated, reason: `installed-${track}` };
  }
  // Comments are available to the reviewer through review-job, not a new S4 material.
  const material = { body: issue.body ?? '' };
  const contextDigest = digest(material), requestId = `spec:${issue.number}:${contextDigest}`;
  const state = (await queue.store.read()).state, saved = state.specReviews?.[issue.number];
  if (!activated) return { action: 'spec-review', planned: true, issue: issue.number, requestId };
  if (saved?.requestId === requestId && ['accepted', 'changes_requested'].includes(saved.status)) {
    await api.moveStatus(issue.number, saved.status === 'accepted' ? 'S5-ready' : 'S3-spec', issue.labels);
    await observeTransition(queue, { id: `${eventId}:spec-label`, issue: issue.number, kind: 'spec', requestId,
      fromStatus: 'S4-spec-review', toStatus: saved.status === 'accepted' ? 'S5-ready' : 'S3-spec' });
    return { action: 'spec-complete', verdict: saved.status };
  }
  const base = saved?.requestId === requestId ? saved.base : await git.remoteHead(git.dev);
  const decision = state.ownerDecisions?.[issue.number];
  const task = { issue: issue.number, track, ownerAssigned: !!decision, ownerDecision: decision,
    ...(saved?.requestId === requestId && saved.retry ? { reviewRetry: { ...saved.retry, requestId } } : {}) };
  const context = { kind: 'spec', requestId, active: { issue: issue.number, materialSha: base, expectedBase: base, patchId: contextDigest }, task };
  if (saved?.requestId !== requestId) await queue.dispatch({ id: `${eventId}:spec-request`, type: 'spec-requested', issue: issue.number,
    request: { requestId, contextDigest, base } });
  const result = await readReviewResult(context);
  const savePresentation = async () => {
    const presentation = pendingPresentation(result, { issue: issue.number, kind: 'spec', requestId,
      materialSha: base, expectedBase: base, patchId: contextDigest });
    if (presentation) await queue.dispatch({ id: `${eventId}:spec-presentation`, type: 'review-presentation',
      issue: issue.number, kind: 'spec', record: presentation });
  };
  if (!result || result.missing || result.retryable || result.verdict === 'incomplete') {
    if (saved?.requestId !== requestId) {
      await savePresentation();
      await requestReview(context); return { action: 'spec-review-requested', requestId };
    }
    if (saved.retry) {
      if (retryStillBecomingVisible(saved.retry, result, queue.clock())) return { action: 'spec-review-pending', requestId, reason: 'review-retry-starting' };
      if (saved.status !== 'attention') {
        await savePresentation();
        await queue.dispatch({ id: `${eventId}:spec-attention`, type: 'spec-complete', issue: issue.number, requestId, verdict: 'attention' });
      }
      return { action: 'spec-review-attention', requestId, reason: 'review-retry-exhausted' };
    }
    const retryId = `${eventId}:spec-retry`;
    await savePresentation();
    const retried = await queue.dispatch({ id: retryId, type: 'spec-retry', issue: issue.number, requestId, runId: result?.runId, runAttempt: result?.runAttempt });
    if (retried.specReviews[issue.number].retry.eventId === retryId) await requestReview({ ...context, retry: true });
    return { action: 'spec-review-requested', requestId };
  }
  if (result.pending) return { action: 'spec-review-pending', requestId };
  if (!['accepted', 'changes_requested'].includes(result.verdict)) return { action: 'spec-review-pending', requestId };
  await savePresentation();
  await queue.dispatch({ id: `${eventId}:spec-complete`, type: 'spec-complete', issue: issue.number, requestId, verdict: result.verdict, reportUrl: result.reportUrl });
  await api.moveStatus(issue.number, result.verdict === 'accepted' ? 'S5-ready' : 'S3-spec', issue.labels);
  await observeTransition(queue, { id: `${eventId}:spec-label`, issue: issue.number, kind: 'spec', requestId,
    fromStatus: 'S4-spec-review', toStatus: result.verdict === 'accepted' ? 'S5-ready' : 'S3-spec' });
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
  let active = snapshot.state.active, task = snapshot.state.tasks[active.issue];
  const dispatch = (type, extra = {}) => queue.dispatch({ id: `${eventId}:${type}`, type, issue: active.issue, token: active.token, ...extra });
  if (active.expiresAt <= queue.clock()) return { action: 'expired', state: await queue.dispatch({ id: `${eventId}:expire`, type: 'expire' }) };
  let issue;
  const publishReturn = async outcome => {
    if (issueStatus(issue ?? {}) === 'S7-code-review') try {
      await api.moveStatus(active.issue, 'S6-in-progress', issue.labels);
      await observeTransition(queue, { id: `${eventId}:return-label`, issue: active.issue, kind: 'code', requestId: active.reviewRequest,
        fromStatus: 'S7-code-review', toStatus: 'S6-in-progress' });
    }
    catch { outcome.warning = 'Return label needs reconciliation'; }
    return outcome;
  };
  const pending = async (reason, error) => {
    const state = await dispatch('automation-pending', { reason, ...(error ? { detail: error.message } : {}) });
    const outcome = { action: state.active?.issue === active.issue ? 'automation-pending' : 'returned',
      reason: state.tasks[active.issue]?.reason?.startsWith('automation-timeout:') ? state.tasks[active.issue].reason : reason,
      ...(error ? { error: error.message } : {}), state };
    return outcome.action === 'returned' ? publishReturn(outcome) : outcome;
  };
  try { issue = await api.getIssue(active.issue); }
  catch (error) { return pending('github-unavailable', error); }
  const returned = async (reason, detail) => {
    const outcome = { action: 'returned', reason, state: await dispatch('return', { reason, fromStatus: issueStatus(issue),
      ...(detail ? { detail } : {}) }) };
    return ['owner-stopped', 'status-changed'].includes(reason) ? outcome : publishReturn(outcome);
  };
  if (stopped(issue)) return returned('owner-stopped');
  try {
    const track = installedTrack(issue);
    if (track && track !== task.track) {
      const state = await dispatch('track-observed', { track });
      if (state.active?.token !== active.token) return { action: 'admission-lost', state };
      active = state.active; task = state.tasks[active.issue];
    }
    const expectedStatus = active.phase === 'review' || active.phase === 'ready-to-merge' && task.status === 'S7-code-review' ? 'S7-code-review' : 'S6-in-progress';
    if (issueStatus(issue) !== expectedStatus) {
      if (['S6-in-progress', 'S7-code-review'].includes(issueStatus(issue))) {
        const fromStatus = issueStatus(issue);
        await api.moveStatus(active.issue, expectedStatus, issue.labels);
        const pendingS6Message = Object.entries(snapshot.state.events).reverse().find(([, r]) => r.message?.issue === active.issue && r.message.kind === 's6-complete' && !r.message.delivered);
        await observeTransition(queue, { id: `${eventId}:label`, issue: active.issue, kind: 'code', requestId: active.reviewRequest,
          messageId: pendingS6Message?.[0], fromStatus, toStatus: expectedStatus });
      }
      else return returned('status-changed');
    }
    if (active.phase === 'sync') {
      if (!synchronize) return { action: 'synchronize-required', active, task };
      const result = await synchronize({ active, task });
      if (result.conflict) return returned('rebase-conflict', result.reason);
      return { action: 'synchronized', state: await dispatch('synchronized', result) };
    }
    if (active.phase === 'testing') {
      if (task.layer !== 'docs' && !runS6) return { action: 's6-required', active, task };
      const result = task.layer === 'docs' ? { outcome: 'not-required' } : await runS6({ active, task });
      if (result.outcome === 'failed') return returned('checks-failed', result.detail ?? result.evidence?.failures?.join('; '));
      if (result.terminal) return returned(result.reason || 'checks-unavailable', result.detail);
      if (!['passed', 'not-required'].includes(result.outcome)) return pending('checks-unavailable');
      const state = await dispatch('s6-complete', { materialSha: active.materialSha, ...result });
      const warnings = [];
      if (state.tasks[active.issue].status === 'S7-code-review') try {
        const fromStatus = issueStatus(issue);
        await api.moveStatus(active.issue, 'S7-code-review', issue.labels);
        await observeTransition(queue, { id: `${eventId}:s6-label`, issue: active.issue, messageId: `${eventId}:s6-complete`,
          fromStatus, toStatus: 'S7-code-review' });
      }
      catch { warnings.push('S6 accepted; S7 label needs reconciliation'); }
      return { action: state.active.phase, state, warnings };
    }
    if (active.phase === 'review') {
      const context = { active, task, kind: 'code' };
      if (!active.reviewRequest) {
        if (!requestReview) return { action: 'review-required', active, task };
        const requestId = task.reviewRequest ?? `review:${active.issue}:${task.reviewEntry ?? 1}:${active.patchId ?? active.materialSha}:${active.expectedBase}`;
        const state = await dispatch('review-requested', { materialSha: active.materialSha, requestId });
        await requestReview({ ...context, requestId }); return { action: 'review-requested', state };
      }
      if (!readReviewResult) return { action: 'review-pending', active, task };
      const result = await readReviewResult({ ...context, requestId: active.reviewRequest });
      const savePresentation = async () => {
        const presentation = pendingPresentation(result, { issue: active.issue, kind: 'code', requestId: active.reviewRequest,
          materialSha: result?.materialSha ?? active.materialSha, expectedBase: result?.base ?? active.expectedBase,
          patchId: result?.patchId ?? active.patchId });
        if (presentation) await dispatch('review-presentation', { kind: 'code', record: presentation });
      };
      if (!result || result.missing || result.retryable || result.verdict === 'incomplete') {
        if (!requestReview) return pending('review-dispatch-unavailable');
        const retry = task.reviewRetry?.requestId === active.reviewRequest ? task.reviewRetry : null;
        if (retry) {
          if (retryStillBecomingVisible(retry, result, queue.clock())) return { action: 'review-pending', reason: 'review-retry-starting', active, task };
          await savePresentation();
          return returned('review-retry-exhausted');
        }
        await savePresentation();
        const state = await dispatch('review-retry', { requestId: active.reviewRequest, runId: result?.runId, runAttempt: result?.runAttempt });
        if (state.tasks[active.issue].reviewRetry.eventId === `${eventId}:review-retry`)
          await requestReview({ ...context, requestId: active.reviewRequest, retry: true });
        return { action: 'review-request-ensured', state };
      }
      if (result.pending) {
        const renew = active.expiresAt - queue.clock() <= queue.leaseMs / 2 || task.automationError;
        return { action: 'review-pending', ...(renew ? { state: await dispatch('heartbeat', { progress: true }) } : { active }), task };
      }
      if ((result.materialSha !== active.materialSha && result.patchId !== active.patchId) || result.requestId !== active.reviewRequest)
        throw Error('Review belongs to another request/material');
      await savePresentation();
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
              path: queue.store.path, issue: active.issue, token: active.token, eventId: `${eventId}:merged`,
              fromStatus: issueStatus(issue), removedToRelease: names(issue).includes('to_release') } }); break;
        } catch (error) {
          if (!(error instanceof StateConflict)) throw error;
          const refreshed = await queue.assertAdmission({ issue: active.issue, token: active.token, materialSha: active.materialSha });
          if (refreshed.state.active.expectedBase !== active.expectedBase || await git.remoteHead(git.dev) !== active.expectedBase || await git.remoteHead(task.branch) !== active.materialSha) throw error;
          if (attempt === 1) return pending('queue-metadata-busy');
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
  if (task?.status !== 'S8-merged' || issue.state === 'closed'
    || issueStatus(issue) === 'S8-merged' && !names(issue).includes('to_release')) return { action: 'unchanged' };
  if (!activated) return { planned: true, action: 'label-S8', issue: issue.number };
  await api.moveStatus(issue.number, 'S8-merged', issue.labels);
  return { action: 'label-S8', issue: issue.number };
}
