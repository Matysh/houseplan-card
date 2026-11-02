import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';

const copy = value => structuredClone(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function ownerDecisionRecord(value) {
  if (!value || !['ship', 'show', 'ask'].includes(value.track) || !['chat', 'manual'].includes(value.source)
    || !['decisionId', 'sourceRef', 'decisionText'].every(key => typeof value[key] === 'string' && value[key].trim() && value[key].length <= 2048))
    throw Error('Explicit owner decision requires decisionId, chat/manual source, sourceRef and decisionText; actor/login is not authority');
  return { decisionId: value.decisionId, source: value.source, sourceRef: value.sourceRef, decisionText: value.decisionText,
    track: value.track, ...(value.recordedBy ? { recordedBy: String(value.recordedBy).slice(0, 120) } : {}) };
}
// The installed track is binding; provenance is context, never a routing gate.
export const ownerShip = task => task?.track === 'ship';
export const AUTOMATION_WAIT_MS = 30 * 60_000;
export const REVIEW_RETRY_VISIBILITY_MS = 2 * 60_000;
export function queueSummary(state) {
  const order = [...state.waiting].sort((a, b) => Number(ownerShip(state.tasks[b])) - Number(ownerShip(state.tasks[a])) || state.tasks[a].ticket - state.tasks[b].ticket);
  return { revision: state.revision, active: state.active ? { issue: state.active.issue, phase: state.active.phase, expiresAt: state.active.expiresAt,
    reason: state.tasks[state.active.issue]?.automationError ?? null } : null,
  waiting: order.map((issue, index) => ({ issue, position: index + 1, track: state.tasks[issue].track, ownerShip: ownerShip(state.tasks[issue]) })) };
}
export class StateConflict extends Error { constructor(message = 'State changed; read and retry') { super(message); this.name = 'StateConflict'; } }
export class LeaseLost extends Error { constructor() { super('Queue admission expired or belongs to another worker'); this.name = 'LeaseLost'; } }

export function initialQueueState() {
  return { schema: 1, revision: 0, nextTicket: 1, nextFence: 1, tasks: {}, ownerDecisions: {}, specReviews: {}, reviewPublications: {}, waiting: [], active: null, events: {} };
}

const presentationKey = record => `${record.kind}:${record.issue}:${record.requestId}${record.resultKey ? `:result:${record.resultKey}` : ''}`;
const presentationTime = record => Date.parse(record.presentation?.occurredAt ?? '') || 0;
/** Read both current state and the earlier single-report shape without losing a paid round. */
export function pendingReviewPublications(state) {
  const records = [...Object.values(state.tasks ?? {}).map(task => task.reviewPublication),
    ...Object.values(state.specReviews ?? {}).map(spec => spec.reviewPublication),
    ...Object.values(state.reviewPublications ?? {})].filter(record => record?.status === 'pending');
  return [...new Map(records.map(record => [presentationKey(record), record])).values()].sort((a, b) =>
    presentationTime(a) - presentationTime(b)
    || (a.issue === b.issue && a.requestId === b.requestId
      ? Number(!!b.resultKey) - Number(!!a.resultKey) || (a.receipt?.runAttempt ?? 0) - (b.receipt?.runAttempt ?? 0) : 0));
}

/** Pure transitions. event.id is a delivery ID, not an authorization credential. */
export function reduceQueue(previous, event, { now = Date.now(), leaseMs = 60 * 60_000 } = {}) {
  if (!event?.id || typeof event.id !== 'string' || !Number.isFinite(now) || !(leaseMs > 0)) throw Error('Invalid queue event');
  if (previous.schema !== 1) throw Error('Unsupported queue state');
  const eventDigest = digest(event), recorded = previous.events[event.id];
  if (recorded) {
    if ((typeof recorded === 'string' ? recorded : recorded.digest) !== eventDigest) throw Error('Delivery ID reused with another payload');
    return copy(previous);
  }
  const state = copy(previous);
  state.reviewPublications = Object.fromEntries(pendingReviewPublications(state).map(record => [presentationKey(record), record]));
  for (const record of [...Object.values(state.tasks), ...Object.values(state.specReviews ?? {})]) delete record.reviewPublication;
  const duration = phase => ['sync', 'testing'].includes(phase) ? Math.min(leaseMs, 5 * 60_000) : leaseMs;
  const clearAutomation = task => { delete task.automationError; delete task.automationSince; delete task.automationDetail; };
  const historyMessages = [];
  const returnTask = (task, reason) => {
    const fromStatus = event.fromStatus ?? task.status;
    task.status = 'S6-in-progress'; task.reason = reason; task.queued = false;
    if (!['owner-stopped', 'status-changed'].includes(reason)) task.notice = {
      key: `${task.reviewEntry ?? 0}:${reason}`, reason, status: 'pending',
      fromStatus, at: now, entry: task.reviewEntry ?? 0, ...(task.reviewRequest ? { requestId: task.reviewRequest } : {}),
      ...(event.detail ? { detail: event.detail } : {}), ...(event.reportUrl ? { reportUrl: event.reportUrl } : {}),
    };
    if (task.notice?.status === 'pending' && !['owner-stopped', 'status-changed', 'review-findings'].includes(reason)) {
      // A later return replaces task.notice, but not the earlier event. The
      // suffix also preserves both sides of expiry + enqueue in one delivery.
      task.notice.eventId = `${event.id}:return:${task.issue}`;
      historyMessages.push([task.notice.eventId, { digest: eventDigest, issue: task.issue, message: {
        kind: 'return', issue: task.issue, at: now, entry: task.reviewEntry ?? 0, notice: copy(task.notice),
      } }]);
    }
    if (reason === 'review-retry-exhausted') {
      const publication = state.reviewPublications[presentationKey({ issue: task.issue, kind: 'code', requestId: task.reviewRequest })];
      if (publication) publication.exhausted = true;
    }
    state.waiting = state.waiting.filter(issue => issue !== task.issue); delete task.continuation;
    state.active = null;
  };
  if (state.active && state.active.expiresAt <= now) {
    const active = state.active, task = state.tasks[active.issue];
    if (['sync', 'testing'].includes(active.phase)) returnTask(task, 'executor-admission-expired');
    else {
      task.reason = 'admission-expired'; task.queued = true; task.ticket = state.nextTicket++;
      task.continuation = { phase: active.phase, expectedBase: active.expectedBase, patchId: active.patchId,
        ...(active.reviewRequest ? { reviewRequest: active.reviewRequest } : {}) };
      if (!state.waiting.includes(task.issue)) state.waiting.push(task.issue);
      // Remote review/merge can continue without waiting for the departed executor.
      state.active = null;
    }
  }
  const admitted = () => {
    const active = state.active;
    if (!active || active.issue !== event.issue || active.token !== event.token) throw new LeaseLost();
    return active;
  };
  const material = active => {
    if (!sha(event.materialSha) || event.materialSha !== active.materialSha) throw Error('Result belongs to another material');
  };
  switch (event.type) {
    case 'owner-track': {
      if (!Number.isSafeInteger(event.issue) || event.issue < 1) throw Error('Invalid owner decision issue');
      const decision = ownerDecisionRecord(event);
      (state.ownerDecisions ??= {})[event.issue] = decision;
      const task = state.tasks[event.issue];
      if (task) { task.ownerAssigned = true; task.ownerDecision = decision; }
      break;
    }
    case 'track-observed': {
      if (!Number.isSafeInteger(event.issue) || event.issue < 1 || !['ship', 'show', 'ask'].includes(event.track)) throw Error('Valid observed track required');
      const task = state.tasks[event.issue];
      if (!task || task.status === 'S8-merged' || task.track === event.track) break;
      task.track = event.track;
      const admission = state.active?.issue === event.issue ? state.active : task.continuation;
      if (admission && ['review', 'ready-to-merge'].includes(admission.phase)) {
        const accepted = task.review?.verdict === 'accepted' && task.review.patchId === admission.patchId;
        admission.phase = event.track === 'ship' || accepted ? 'ready-to-merge' : 'review';
        task.status = admission.phase === 'review' ? 'S7-code-review' : 'S6-in-progress';
        if (admission === state.active) admission.expiresAt = now + duration(admission.phase);
        clearAutomation(task);
      }
      break;
    }
    case 'enqueue': {
      const task = event.task;
      if (!Number.isSafeInteger(task?.issue) || task.issue < 1 || !['ship', 'show', 'ask'].includes(task.track)
        || !['product', 'infra', 'docs'].includes(task.layer) || !sha(task.materialSha)
        || typeof task.branch !== 'string' || !task.branch.length) throw Error('Invalid queued task');
      const existing = state.tasks[task.issue];
      if (existing?.status === 'S8-merged') throw Error('Task is already merged');
      if (state.active?.issue === task.issue) throw Error('Admitted task cannot be replaced');
      if (!state.waiting.includes(task.issue)) state.waiting.push(task.issue);
      const decision = state.ownerDecisions?.[task.issue];
      const authority = decision ? { ownerAssigned: true, ownerDecision: decision } : { ownerAssigned: false, ownerDecision: null };
      state.tasks[task.issue] = { ...existing, ...copy(task), ...authority, ticket: existing?.queued ? existing.ticket : state.nextTicket++, queued: true,
        status: 'S6-in-progress', readyAt: existing?.queued ? existing.readyAt : now,
        reviewEntry: (existing?.reviewEntry ?? 0) + (existing?.queued ? 0 : 1) };
      // Only an explicit new entry grants a new review request after an exhausted round.
      // Automatic continuation and duplicate ready delivery keep their existing request.
      if (!existing?.queued && existing?.review?.verdict !== 'accepted') {
        delete state.tasks[task.issue].reviewRequest; delete state.tasks[task.issue].reviewMaterial; delete state.tasks[task.issue].reviewRetry;
      }
      clearAutomation(state.tasks[task.issue]); delete state.tasks[task.issue].continuation;
      delete state.tasks[task.issue].reason;
      break;
    }
    case 'admit': {
      if (state.active) break; // a newly ready ship never interrupts the current task
      const order = [...state.waiting].sort((a, b) => {
        const first = state.tasks[a], second = state.tasks[b];
        return Number(ownerShip(second)) - Number(ownerShip(first)) || first.ticket - second.ticket;
      });
      if (!order.length) break;
      const task = state.tasks[order[0]], fence = state.nextFence++;
      state.waiting = state.waiting.filter(issue => issue !== task.issue);
      task.queued = false;
      const continuation = task.continuation ?? { expectedBase: null, phase: 'sync' };
      state.active = { issue: task.issue, worker: event.worker ?? null, token: `${fence}:${event.id}`, fence,
        materialSha: task.materialSha, ...continuation, admittedAt: now, expiresAt: now + duration(continuation.phase) };
      delete task.continuation;
      break;
    }
    case 'heartbeat': {
      const active = admitted(); active.expiresAt = now + duration(active.phase);
      if (event.progress) clearAutomation(state.tasks[active.issue]);
      break;
    }
    case 'synchronized': {
      const active = admitted();
      if (active.phase !== 'sync' || !sha(event.expectedBase) || !sha(event.materialSha)) throw Error('Invalid final synchronization');
      active.expectedBase = event.expectedBase; active.materialSha = event.materialSha; active.phase = 'testing'; active.expiresAt = now + duration(active.phase);
      const task = state.tasks[active.issue];
      active.patchId = event.patchId ?? event.materialSha;
      if (task.patchId && task.patchId !== active.patchId) { delete task.review; delete task.reviewRequest; delete task.reviewMaterial; delete task.reviewRetry; }
      task.patchId = active.patchId; task.materialSha = event.materialSha;
      if (event.review?.source === 'published-release' && event.review.patchId === active.patchId)
        task.review = { ...copy(event.review), verdict: 'accepted' };
      if (event.layer) { if (!['docs', 'infra', 'product'].includes(event.layer)) throw Error('Invalid computed layer'); task.layer = event.layer; }
      if (event.changedFiles) task.changedFiles = copy(event.changedFiles);
      clearAutomation(task);
      break;
    }
    case 's6-complete': {
      const active = admitted(), task = state.tasks[active.issue]; material(active);
      if (active.phase !== 'testing' || (task.layer === 'docs' ? event.outcome !== 'not-required' : event.outcome !== 'passed'))
        throw Error('S6 needs its successful selected set; documentation has no runs');
      task.s6 = copy(event.evidence ?? null);
      const ship = ownerShip(task);
      const retainedReview = task.review?.verdict === 'accepted' && task.review.patchId === active.patchId;
      if (task.reviewRequest) active.reviewRequest = task.reviewRequest;
      active.phase = ship || retainedReview ? 'ready-to-merge' : 'review'; task.status = ship || retainedReview ? 'S6-in-progress' : 'S7-code-review';
      active.expiresAt = now + duration(active.phase); clearAutomation(task);
      break;
    }
    case 'review-complete': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || event.verdict !== 'accepted') throw Error('Independent accepted review required');
      state.tasks[active.issue].review = { ...copy(event.review ?? {}), materialSha: active.materialSha, expectedBase: active.expectedBase, patchId: active.patchId, verdict: 'accepted' };
      active.phase = 'ready-to-merge'; active.expiresAt = now + duration(active.phase); clearAutomation(state.tasks[active.issue]); break;
    }
    case 'review-requested': {
      const active = admitted(); material(active);
      if (active.phase !== 'review' || !event.requestId) throw Error('Review request needs the admitted material');
      if (active.reviewRequest && active.reviewRequest !== event.requestId) throw Error('Another review is already requested');
      active.reviewRequest = event.requestId;
      const task = state.tasks[active.issue];
      if (task.reviewRequest !== event.requestId) task.reviewRound = task.reviewRound === null
        || task.reviewRound === undefined && task.reviewEntry > 1 ? null : (task.reviewRound ?? 0) + 1;
      task.reviewRequest = event.requestId;
      task.reviewMaterial = { materialSha: active.materialSha, expectedBase: active.expectedBase, patchId: active.patchId };
      const record = { issue: active.issue, kind: 'code', requestId: event.requestId, ...task.reviewMaterial,
        status: 'pending', presentation: { round: task.reviewRound, occurredAt: new Date(now).toISOString() } };
      state.reviewPublications[presentationKey(record)] ??= record;
      break;
    }
    case 'review-retry': {
      const active = admitted(), task = state.tasks[active.issue];
      if (active.phase !== 'review' || event.requestId !== active.reviewRequest) throw Error('Retry must identify the pending review');
      if (task.reviewRetry?.requestId === event.requestId) break;
      task.reviewRetry = { requestId: event.requestId, eventId: event.id, at: now,
        runId: event.runId ?? null, runAttempt: event.runAttempt ?? null };
      break;
    }
    case 'automation-pending': {
      const active = admitted(), task = state.tasks[active.issue], reason = String(event.reason || 'retry-pending').slice(0, 1000);
      if (task.automationError !== reason) { task.automationError = reason; task.automationSince = now; }
      if (event.detail) task.automationDetail = String(event.detail).slice(0, 1000);
      if (now - task.automationSince >= AUTOMATION_WAIT_MS) returnTask(task, `automation-timeout:${reason}`);
      break;
    }
    case 'resynchronize': {
      const active = admitted(); active.phase = 'sync'; active.expectedBase = null; active.expiresAt = now + duration(active.phase); clearAutomation(state.tasks[active.issue]); break;
    }
    case 'spec-requested': {
      if (!Number.isSafeInteger(event.issue) || !event.request?.requestId) throw Error('Specification review request required');
      const prior = state.specReviews?.[event.issue];
      const round = prior && !Number.isSafeInteger(prior.round) ? null
        : (prior?.round ?? 0) + Number(prior?.requestId !== event.request.requestId);
      (state.specReviews ??= {})[event.issue] = { ...copy(event.request), round, status: 'pending', updatedAt: now };
      if (prior?.requestId && prior.requestId !== event.request.requestId && prior.status === 'pending') {
        state.events[`${event.id}:spec-replaced:${event.issue}`] = { digest: eventDigest, issue: event.issue, message: {
          kind: 'spec-replaced', issue: event.issue, at: now, previousRound: prior.round ?? null, round,
        } };
      }
      const record = { issue: event.issue, kind: 'spec', requestId: event.request.requestId,
        ...(event.request.base ? { materialSha: event.request.base, expectedBase: event.request.base } : {}),
        ...(event.request.contextDigest ? { patchId: event.request.contextDigest } : {}),
        status: 'pending', presentation: { round, occurredAt: new Date(now).toISOString() } };
      state.reviewPublications[presentationKey(record)] ??= record;
      break;
    }
    case 'spec-complete': {
      const current = state.specReviews?.[event.issue];
      if (!current || current.requestId !== event.requestId) throw Error('Specification review identity differs');
      Object.assign(current, { status: event.verdict, reportUrl: event.reportUrl ?? null, updatedAt: now });
      if (event.verdict === 'attention') {
        const publication = state.reviewPublications[presentationKey({ issue: event.issue, kind: 'spec', requestId: event.requestId })];
        if (publication) publication.exhausted = true;
        current.notice = { key: event.requestId, status: 'pending', at: now,
          eventId: `${event.id}:spec-attention:${event.issue}` };
        historyMessages.push([current.notice.eventId, { digest: eventDigest, issue: event.issue, message: {
          kind: 'spec-attention', issue: event.issue, at: now, notice: copy(current.notice),
          ...(current.reportUrl ? { reportUrl: current.reportUrl } : {}),
        } }]);
      }
      else delete current.notice;
      break;
    }
    case 'spec-retry': {
      const current = state.specReviews?.[event.issue];
      if (!current || current.requestId !== event.requestId) throw Error('Specification review identity differs');
      if (current.retry) break;
      current.retry = { eventId: event.id, at: now, runId: event.runId ?? null, runAttempt: event.runAttempt ?? null }; break;
    }
    case 'review-presentation': {
      const record = event.kind === 'spec' ? state.specReviews?.[event.issue] : state.tasks[event.issue];
      if (event.record) {
        if (!record) throw Error('Unknown review presentation');
        if (!event.record.requestId || event.record.issue !== event.issue || event.record.kind !== event.kind)
          throw Error('Review presentation identity required');
        const key = presentationKey(event.record);
        const prior = state.reviewPublications[key] ?? (event.record.resultKey
          ? state.reviewPublications[presentationKey({ ...event.record, resultKey: null })] : null);
        state.reviewPublications[key] = { ...prior, ...copy(event.record),
          presentation: { ...prior?.presentation, ...copy(event.record.presentation ?? {}) }, status: 'pending' };
        // A stored partial attempt is a separate historical result. It must
        // neither replace the canonical pending round nor pin its final report.
        if (!event.record.receipt) delete state.reviewPublications[key].receipt;
      } else {
        const key = presentationKey(event), pending = state.reviewPublications[key];
        if (event.status === 'delivered') delete state.reviewPublications[key];
        else if (pending && event.status === 'pending') {
          if (event.reason) pending.reason = String(event.reason).slice(0, 500);
          else delete pending.reason;
        }
      }
      break;
    }
    case 'message-delivered': {
      const message = state.events[event.messageId]?.message;
      if (message) message.delivered = true;
      break;
    }
    case 'transition-observed': {
      // Presentation only: recording an observed label change never changes task readiness.
      if (event.kind === 'spec-skipped') historyMessages.push([`${event.id}:message`, {
        digest: eventDigest, issue: event.issue, message: { kind: 'spec-skipped', issue: event.issue, at: now,
          track: event.track, fromStatus: event.fromStatus, toStatus: event.toStatus, transitionConfirmed: true },
      }]);
      const message = state.events[event.messageId]?.message;
      if (message) Object.assign(message, { fromStatus: event.fromStatus, toStatus: event.toStatus, transitionConfirmed: true });
      const key = presentationKey(event), presentation = state.reviewPublications[key];
      if (presentation) presentation.presentation = { ...presentation.presentation,
        transition: { from: event.fromStatus, to: event.toStatus, confirmed: true } };
      if (state.tasks[event.issue]?.notice?.requestId === event.requestId && event.toStatus === 'S6-in-progress') {
        const notice = state.tasks[event.issue].notice;
        notice.transitionConfirmed = true;
        const returned = state.events[notice.eventId]?.message;
        if (returned) {
          returned.notice.transitionConfirmed = true;
          Object.assign(returned, { fromStatus: event.fromStatus, toStatus: event.toStatus, transitionConfirmed: true });
        }
      }
      break;
    }
    case 'task-completion': {
      const task = state.tasks[event.issue];
      if (task?.status !== 'S8-merged' || task.mergedSha !== event.materialSha) throw Error('Completion follows an actual merge');
      const result = event.result;
      if (!result || !['pending', 'complete'].includes(result.status)) throw Error('Completion result required');
      task.completion = copy(result); break;
    }
    case 'task-notice': {
      const task = state.tasks[event.issue];
      if (task?.notice?.key === event.key) task.notice.status = event.status;
      break;
    }
    case 'spec-notice': {
      const spec = state.specReviews?.[event.issue];
      if (spec?.notice?.key === event.key) spec.notice.status = event.status;
      break;
    }
    case 'dev-webhook': {
      if (!sha(event.sourceSha) || !['pending', 'delivered', 'not-required'].includes(event.status)) throw Error('Invalid dev webhook result');
      if (event.status === 'pending') {
        if (state.devWebhook?.sourceSha !== event.sourceSha) state.devWebhook = { sourceSha: event.sourceSha, status: 'pending',
          ...(event.integrationTree ? { integrationTree: event.integrationTree } : {}) };
      }
      else if (state.devWebhook?.sourceSha === event.sourceSha) state.devWebhook = { ...state.devWebhook, status: event.status };
      break;
    }
    case 'dev-build': {
      const task = state.tasks[event.issue];
      if (task?.status !== 'S8-merged' || task.mergedSha !== event.materialSha) throw Error('Dev publication must follow an actual merge');
      task.devBuild = { status: event.status, sourceSha: event.materialSha, ...(event.reason ? { reason: String(event.reason).slice(0, 1000) } : {}) }; break;
    }
    case 'return': {
      const active = admitted();
      returnTask(state.tasks[active.issue], event.reason || 'returned'); break;
    }
    case 'merged': {
      const active = admitted(); material(active);
      if (active.phase !== 'ready-to-merge' || event.actualDevSha !== active.materialSha) throw Error('Actual merge is required for S8');
      const old = state.tasks[active.issue];
      state.tasks[active.issue] = { issue: old.issue, branch: old.branch, track: old.track, layer: old.layer,
        status: 'S8-merged', expectedBase: active.expectedBase, mergedSha: event.actualDevSha, mergedAt: now,
        ...(event.fromStatus ? { mergedFromStatus: event.fromStatus } : {}), branchDeleted: event.branchDeleted === true,
        removedToRelease: event.removedToRelease === true, ...(old.reviewRequest ? { reviewRequest: old.reviewRequest } : {}),
        completion: { status: 'pending', labels: false, milestone: false, comment: false },
        ...(old.releaseTag ? { releaseTag: old.releaseTag } : {}),
        devBuild: { status: old.layer === 'product' ? 'pending' : 'not-required' } };
      state.active = null; break;
    }
    case 'expire': break;
    default: throw Error(`Unknown queue event: ${event.type}`);
  }
  // Idle ticks do not create JSON history, revisions or remote commits.
  if (JSON.stringify(state) === JSON.stringify(previous)) return state;
  const number = event.issue ?? event.task?.issue ?? state.active?.issue ?? null;
  const task = state.tasks[number];
  const kind = event.type === 'enqueue' && !previous.tasks[number]?.queued ? 'queued'
    : event.type === 'admit' && !previous.active && state.active ? 'admitted'
    : event.type === 's6-complete' ? 's6-complete'
    : event.type === 'resynchronize' && previous.active?.phase !== 'sync' ? 'resynchronize'
    : event.type === 'dev-build' && event.notify && event.status === 'published' ? 'dev-build' : null;
  for (const [key, record] of historyMessages) state.events[key] = record;
  state.events[event.id] = { digest: eventDigest, issue: number, ...(kind ? { message: {
    kind, issue: number, at: now,
    ...(task?.reviewEntry !== undefined ? { entry: task.reviewEntry } : {}),
    ...(task?.track ? { track: task.track } : {}), ...(task?.layer ? { layer: task.layer } : {}),
    ...(task?.materialSha || task?.mergedSha ? { materialSha: task.materialSha ?? task.mergedSha } : {}),
    ...(state.active?.issue === number ? { phase: state.active.phase } : {}),
    ...(task?.s6 ? { evidence: copy(task.s6) } : {}),
  } } : {}) };
  // Keep undelivered messages in the existing delivery records, including after merge.
  // Delivered records retain the same bounded replay window; no second queue/service.
  const pendingEvents = Object.entries(state.events).filter(([, record]) => record.message && !record.message.delivered);
  const recentEvents = Object.entries(state.events).filter(([, record]) => typeof record !== 'string' && record.issue != null
    && (!record.message || record.message.delivered) && state.tasks[record.issue]?.status !== 'S8-merged').slice(-256);
  state.events = Object.fromEntries([...recentEvents, ...pendingEvents].sort((a, b) => (a[1].message?.at ?? 0) - (b[1].message?.at ?? 0)));
  const pendingPresentations = Object.values(state.reviewPublications);
  const completed = Object.values(state.tasks).filter(task => task.status === 'S8-merged' && task.devBuild?.status !== 'pending'
    && task.completion?.status !== 'pending' && !pendingPresentations.some(record => record.kind === 'code' && record.issue === task.issue) && task.notice?.status !== 'pending')
    .sort((a, b) => b.mergedAt - a.mergedAt);
  for (const task of completed.slice(64)) { delete state.tasks[task.issue]; delete state.ownerDecisions[task.issue]; }
  const specDone = Object.entries(state.specReviews ?? {}).filter(([issue, item]) => ['accepted', 'changes_requested'].includes(item.status)
    && !pendingPresentations.some(record => record.kind === 'spec' && record.issue === Number(issue))).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
  for (const [issue] of specDone.slice(64)) delete state.specReviews[issue];
  state.revision++;
  return state;
}

export class MemoryQueueStore {
  constructor(state = initialQueueState()) { this.state = copy(state); this.version = 0; }
  async read() { return { state: copy(this.state), version: this.version }; }
  async compareAndSwap(version, state) {
    if (version !== this.version) throw new StateConflict();
    this.state = copy(state); return ++this.version;
  }
}

/** Local draft storage: one short exclusive filesystem transaction, no stale-lock stealing. */
export class LocalQueueStore {
  constructor(path, { initial = initialQueueState } = {}) { this.path = path; this.initial = initial; }
  async read() {
    try { const value = JSON.parse(await readFile(this.path, 'utf8')); return { state: value.state, version: value.version }; }
    catch (error) { if (error.code === 'ENOENT') return { state: this.initial(), version: 0 }; throw error; }
  }
  async compareAndSwap(version, state) {
    await mkdir(dirname(this.path), { recursive: true });
    const lockPath = this.path + '.lock'; let lock;
    try { lock = await open(lockPath, 'wx'); }
    catch (error) { if (error.code === 'EEXIST') throw new StateConflict('Local state is being updated'); throw error; }
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const current = await this.read();
      if (current.version !== version) throw new StateConflict();
      const output = await open(temporary, 'wx');
      try { await output.writeFile(JSON.stringify({ version: version + 1, state }, null, 2) + '\n'); await output.sync(); }
      finally { await output.close(); }
      await rename(temporary, this.path); return version + 1;
    } finally {
      await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
      await lock.close(); await unlink(lockPath);
    }
  }
}

export class QueueController {
  constructor(store, { clock = Date.now, leaseMs = 60 * 60_000, retries = 8 } = {}) {
    Object.assign(this, { store, clock, leaseMs, retries });
  }
  async dispatch(event) {
    for (let attempt = 0; attempt < this.retries; attempt++) {
      const { state, version } = await this.store.read();
      const next = reduceQueue(state, event, { now: this.clock(), leaseMs: this.leaseMs });
      if (next.revision === state.revision) return next;
      try { await this.store.compareAndSwap(version, next); return next; }
      catch (error) { if (!(error instanceof StateConflict)) throw error; }
    }
    throw new StateConflict('Queue remained busy; retry the same event ID');
  }
  async assertAdmission({ issue, token, materialSha, phase = 'ready-to-merge' }) {
    const snapshot = await this.store.read(), active = snapshot.state.active;
    if (!active || active.issue !== issue || active.token !== token || active.expiresAt <= this.clock()) throw new LeaseLost();
    if (active.materialSha !== materialSha || active.phase !== phase) throw Error('Queue material/phase differs');
    return snapshot;
  }
}
