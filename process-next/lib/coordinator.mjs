import { LeaseLost, StateConflict } from './queue.mjs';

const names = issue => (issue.labels ?? []).map(label => typeof label === 'string' ? label : label.name);
const status = issue => names(issue).find(name => /^S[1-8]-/.test(name));
const stopped = issue => issue.state === 'closed' || names(issue).includes('blocked');

/** Labels wake reconciliation; only an explicit ready intent means implementation is ready.
 * Merely entering S6 must never enqueue an unfinished task. Owner chat decisions are supplied
 * explicitly by the caller, not guessed from arbitrary issue-comment prose.
 */
export async function handleGithubEvent({ event, issue, queue, owner, ownerDecision, activated = false }) {
  if (!event?.id || !issue?.number) throw Error('Delivery and current issue snapshot required');
  const eventLabel = typeof event.label === 'string' ? event.label : event.label?.name;
  const ownerLabel = owner && event.actor === owner && (event.trackAssignment === true || event.action === 'labeled')
    && /^track:(ship|show|ask)$/.test(eventLabel ?? '');
  const decision = ownerDecision && owner && ownerDecision.actor === owner && ['chat', 'label'].includes(ownerDecision.source)
    ? ownerDecision : ownerLabel ? { actor: owner, source: 'label', track: eventLabel.slice(6) } : null;
  if (ownerDecision && !decision) throw Error('Owner decision attribution differs');
  if (decision && activated) await queue.dispatch({ id: `${event.id}:owner-track`, type: 'owner-track', issue: issue.number, ...decision });
  if (stopped(issue)) return { action: 'stopped', issue: issue.number };
  if (event.kind !== 'ready') return { action: decision ? 'owner-decision-recorded' : 'reconcile', issue: issue.number, ...(!activated && decision ? { planned: true } : {}) };
  if (status(issue) !== 'S6-in-progress') throw Error('Ready intent needs current S6');
  const tracks = names(issue).filter(name => /^track:(ship|show|ask)$/.test(name)).map(name => name.slice(6));
  const stored = (await queue.store.read()).state, previous = stored.tasks[issue.number], savedDecision = stored.ownerDecisions?.[issue.number];
  if (tracks.length > 1 && !decision && !savedDecision && !previous?.ownerAssigned) throw Error('Resolve ambiguous track labels; never silently raise the owner track');
  const track = decision?.track ?? savedDecision?.track ?? (previous?.ownerAssigned ? previous.track : tracks[0]) ?? previous?.track ?? 'show';
  const ownerAssigned = Boolean(decision || savedDecision
    || previous?.ownerAssigned && previous.track === track);
  const task = { issue: issue.number, track, ownerAssigned, layer: event.layer, branch: event.branch,
    materialSha: event.materialSha, ...(decision ? { ownerDecision: decision } : {}) };
  if (!activated) return { planned: true, action: 'enqueue', task };
  return { action: 'queued', state: await queue.dispatch({ id: event.id, type: 'enqueue', task }) };
}

/** One resumable action per call, never a hidden test/review loop.
 * synchronize/runS6/requestReview/readReviewResult are adapters owned by the common CLI.
 * A remote review request ID is stable across retries; its adapter must deduplicate it.
 */
export async function reconcileQueue({ queue, api, git, activated = false, worker = 'coordinator',
  eventId, synchronize, runS6, requestReview, readReviewResult, maxAdmissionMs = 2 * 60 * 60_000 } = {}) {
  if (!eventId) throw Error('Reconciliation delivery ID required');
  let snapshot = await queue.store.read();
  if (!activated) return { planned: true, action: snapshot.state.active?.phase ?? 'admit', state: snapshot.state };
  if (!snapshot.state.active) {
    const state = await queue.dispatch({ id: `${eventId}:admit`, type: 'admit', worker });
    return { action: state.active ? 'admitted' : 'idle', state };
  }
  const active = snapshot.state.active, task = snapshot.state.tasks[active.issue];
  const dispatch = (type, extra = {}) => queue.dispatch({ id: `${eventId}:${type}`, type, issue: active.issue, token: active.token, ...extra });
  if (active.expiresAt <= queue.clock()) return { action: 'expired', state: await queue.dispatch({ id: `${eventId}:expire`, type: 'expire' }) };
  let issue;
  try { issue = await api.getIssue(active.issue); }
  catch { return { action: 'returned', reason: 'github-unavailable', state: await dispatch('return', { reason: 'github-unavailable' }) }; }
  const returned = async reason => {
    const outcome = { action: 'returned', reason, state: await dispatch('return', { reason }) };
    if (!['owner-stopped', 'status-changed'].includes(reason) && status(issue) === 'S7-code-review') {
      try { await api.moveStatus(active.issue, 'S6-in-progress', issue.labels); }
      catch { outcome.warning = 'Return label needs reconciliation'; }
    }
    return outcome;
  };
  if (queue.clock() - active.admittedAt >= maxAdmissionMs) return returned('admission-timeout');
  if (stopped(issue)) return returned('owner-stopped');
  const expectedStatus = ['review', 'ready-to-merge'].includes(active.phase) && !(task.track === 'ship' && task.ownerAssigned)
    ? 'S7-code-review' : 'S6-in-progress';
  if (status(issue) !== expectedStatus) {
    // State transition is authoritative if a label write lost its response; repair only the S6→S7 gap.
    if (expectedStatus === 'S7-code-review' && status(issue) === 'S6-in-progress') await api.moveStatus(active.issue, expectedStatus, issue.labels);
    else if (expectedStatus === 'S6-in-progress' && status(issue) === 'S7-code-review' && task.track === 'ship' && task.ownerAssigned)
      await api.moveStatus(active.issue, expectedStatus, issue.labels);
    else return returned('status-changed');
  }
  try {
    if (active.phase === 'sync') {
      if (!synchronize) return { action: 'synchronize-required', active, task };
      const result = await synchronize({ active, task });
      if (result.conflict) return returned('rebase-conflict');
      return { action: 'synchronized', state: await dispatch('synchronized', result) };
    }
    if (active.phase === 'testing') {
      if (task.layer !== 'docs' && !runS6) return { action: 's6-required', active, task };
      const result = task.layer === 'docs' ? { outcome: 'not-required' } : await runS6({ active, task });
      if (!['passed', 'not-required'].includes(result.outcome)) return returned(result.outcome === 'failed' ? 'checks-failed' : 'checks-unavailable');
      const state = await dispatch('s6-complete', { materialSha: active.materialSha, ...result });
      const warnings = [];
      if (state.tasks[active.issue].status === 'S7-code-review') try { await api.moveStatus(active.issue, 'S7-code-review', issue.labels); }
      catch { warnings.push('S6 accepted; S7 label needs reconciliation'); }
      return { action: state.active.phase, state, warnings };
    }
    if (active.phase === 'review') {
      if (!active.reviewRequest) {
        if (!requestReview) return { action: 'review-required', active, task };
        const requestId = `review:${active.token}`;
        const state = await dispatch('review-requested', { materialSha: active.materialSha, requestId });
        await requestReview({ requestId, active, task });
        return { action: 'review-requested', state };
      }
      if (!readReviewResult) return { action: 'review-pending', active, task };
      const result = await readReviewResult({ requestId: active.reviewRequest, active, task });
      if (result?.missing && requestReview) {
        await requestReview({ requestId: active.reviewRequest, active, task });
        return { action: 'review-request-ensured', active, task };
      }
      if (result?.pending) return { action: 'review-pending', state: await dispatch('heartbeat'), task };
      if (!result || result.missing) return { action: 'review-pending', active, task };
      if (result.materialSha !== active.materialSha || result.requestId !== active.reviewRequest) throw Error('Review belongs to another request/material');
      if (result.verdict !== 'accepted') {
        return returned('review-findings');
      }
      return { action: 'ready-to-merge', state: await dispatch('review-complete', { materialSha: active.materialSha, verdict: 'accepted', review: result }) };
    }
    if (active.phase === 'ready-to-merge') {
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        snapshot = await queue.assertAdmission({ issue: active.issue, token: active.token, materialSha: active.materialSha });
        if (!snapshot.headSha && !snapshot.version?.headSha) throw Error('Remote merge requires a Git-backed queue fence');
        try {
          result = await git.merge({ expectedBase: active.expectedBase, materialSha: active.materialSha, branch: task.branch,
            fence: { state: snapshot.state, headSha: snapshot.headSha ?? snapshot.version.headSha, branch: queue.store.branch,
              path: queue.store.path, issue: active.issue, token: active.token, eventId: `${eventId}:merged` } });
          break;
        } catch (error) {
          if (!(error instanceof StateConflict)) throw error;
          const refreshed = await queue.assertAdmission({ issue: active.issue, token: active.token, materialSha: active.materialSha });
          if (refreshed.state.active.expectedBase !== active.expectedBase
            || await git.remoteHead(git.dev) !== active.expectedBase || await git.remoteHead(task.branch) !== active.materialSha) throw error;
          // Another waiting task/heartbeat can change the state ref. Keep tests/review and retry only CAS.
          if (attempt === 1) return { action: 'merge-pending', reason: 'queue-metadata-busy', active: refreshed.state.active };
        }
      }
      if (result.planned) return result;
      if (!result.merged || !result.statePersisted) throw Error('Merge did not atomically complete the queue');
      const warnings = [...(result.warnings ?? [])];
      try { await api.moveStatus(active.issue, 'S8-merged', issue.labels); }
      catch { warnings.push('Merge completed; S8 label needs reconciliation'); }
      return { action: 'merged', ...result, warnings };
    }
    throw Error('Unknown admitted phase');
  } catch (error) {
    if (error instanceof LeaseLost) throw error;
    // A known successful merge never enters this path just because publishing a label failed.
    const latest = (await queue.store.read()).state;
    if (latest.tasks[active.issue]?.status === 'S8-merged') return { action: 'merged', state: latest, warning: 'Post-merge reporting needs reconciliation' };
    if (latest.active?.token !== active.token) throw new LeaseLost();
    const outcome = await returned('automation-error');
    return { ...outcome, error: error.message };
  }
}

export async function reconcileMergedLabel({ queue, api, issue, activated = false }) {
  const task = (await queue.store.read()).state.tasks[issue.number];
  if (task?.status !== 'S8-merged' || status(issue) === 'S8-merged') return { action: 'unchanged' };
  if (!activated) return { planned: true, action: 'label-S8', issue: issue.number };
  await api.moveStatus(issue.number, 'S8-merged', issue.labels);
  return { action: 'label-S8', issue: issue.number }; // no re-merge, no tests
}
